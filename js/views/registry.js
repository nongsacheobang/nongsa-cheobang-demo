// 화면 모듈 등록소 (Aside 담당). 화면 계약은 docs/plan/06_Aside프롬프트_v01.md 6절.
//
// 화면 모듈 모양:
//   export default {
//     route: 'record',            // #/record 또는 #/record/<param>
//     tab: 'journal',             // home | journal | coverage | info | settings
//     title: '기록 쓰기',
//     render(ctx) { return '<html 문자열>'; },   // 순수 함수
//     actions: { recordSave(el, ctx) {} },       // data-act 이름. 앞에 화면 이름을 붙여 겹치지 않게
//   };
// ctx: { S, session, profile, records, readiness, param, go, toast, store, esc, reload, rerender }
// 저장은 ctx.store.saveRecord(계약 변환 경유)만. 점수는 ctx.readiness만 읽는다.

export const TABS = [
  ['home', '홈'],
  ['journal', '일지'],
  ['coverage', '재해보험'],
  ['info', '정보'],
  ['settings', '설정'],
];
const TAB_KEYS = new Set(TABS.map(([k]) => k));

const views = new Map();
const actions = new Map();

export function registerView(v, { reservedActions = [] } = {}) {
  const errs = [];
  if (!v || typeof v !== 'object') errs.push('화면 모듈이 비었어요');
  else {
    if (!/^[a-z][a-z0-9-]*$/.test(v.route || '')) errs.push(`route 형식: ${v.route}`);
    if (views.has(v.route)) errs.push(`route 중복: ${v.route}`);
    if (!TAB_KEYS.has(v.tab)) errs.push(`tab 값: ${v.tab}`);
    if (typeof v.render !== 'function') errs.push(`render 없음: ${v.route}`);
    for (const name of Object.keys(v.actions || {})) {
      if (actions.has(name) || reservedActions.includes(name)) errs.push(`action 이름 중복: ${name}`);
      if (typeof v.actions[name] !== 'function') errs.push(`action이 함수가 아님: ${name}`);
    }
  }
  if (errs.length) throw new Error('화면 등록 실패: ' + errs.join(', '));
  views.set(v.route, v);
  for (const [name, fn] of Object.entries(v.actions || {})) actions.set(name, { fn, route: v.route });
  return v;
}

export const getView = (route) => views.get(route) || null;
export const getAction = (name) => actions.get(name) || null;
export const allViews = () => [...views.values()];
export const tabOf = (route) => views.get(route)?.tab || null;

// 시험용: 등록을 비운다
export function resetRegistry() {
  views.clear();
  actions.clear();
}

export function runRegistryTests() {
  const cases = [];
  const check = (name, ok) => cases.push({ name, pass: !!ok });
  const saved = [...views.values()];
  resetRegistry();
  const v = { route: 'sample', tab: 'home', title: '시험', render: () => '<p>ok</p>', actions: { sampleGo() {} } };
  registerView(v);
  check('등록하면 찾을 수 있음', getView('sample') === v && getAction('sampleGo').route === 'sample' && tabOf('sample') === 'home');
  const bad = (x, opts) => { try { registerView(x, opts); return false; } catch (e) { return true; } };
  check('route 중복 거부', bad({ ...v, actions: {} }));
  check('action 이름 중복 거부', bad({ route: 'other', tab: 'home', render: () => '', actions: { sampleGo() {} } }));
  check('예약된 action 이름 거부', bad({ route: 'other2', tab: 'home', render: () => '', actions: { go() {} } }, { reservedActions: ['go'] }));
  check('없는 탭 거부', bad({ route: 'other3', tab: 'chat', render: () => '' }));
  check('render 없으면 거부', bad({ route: 'other4', tab: 'home' }));
  check('route 형식 거부', bad({ route: 'Bad/Route', tab: 'home', render: () => '' }));
  resetRegistry();
  for (const s of saved) registerView(s);
  const pass = cases.filter((c) => c.pass).length;
  return { total: cases.length, pass, cases };
}
