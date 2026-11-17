// M-04 홈: 준비도 [Aside 담당]
// 신호등, 점수, 고지(U-12), 바뀐 이유, 경고, 지금 할 일 3개, 빠른 이동, 시연 시나리오(데모 계정)
// 보험금 액수와 지급 여부는 말하지 않는다(U-11).

import { explainChange } from '../insurance/score.js';
import { salesPeriodNotice } from '../insurance/crops.js';
import { todayStr } from '../records.js';
import { DEMO_SCENARIOS, buildDemoScenario } from '../demo.js';
import { weatherText } from '../weather.js';
import { DEMO_NEWS, readNews, isNewNews } from './info.js';

const STATE_LABEL = { met: '충족', unmet: '부족', unknown: '모름', na: '해당 없음' };

export function signalCard(r, esc) {
  if (!r) return '';
  if (!r.gate_open) {
    return `<div class="rd-sig gray" role="status">
      <p class="rd-sig-label">${esc(r.signal.label)}</p>
      <p class="rd-sig-sub">보험 가입 정보를 확인하면 준비도를 볼 수 있어요</p></div>`;
  }
  return `<div class="rd-sig ${esc(r.signal.color)}" role="status" aria-label="기록 준비도 ${r.score}점, ${esc(r.signal.label)}">
    <p class="rd-sig-cap">기록 준비도</p>
    <p class="rd-sig-score"><b>${r.score}</b><span>점</span></p>
    <p class="rd-sig-label">${esc(r.signal.label)}</p>
    <p class="rd-sig-sub">${esc(r.stage.label)}</p></div>`;
}

export default {
  route: 'home',
  tab: 'home',
  title: '홈',
  render(ctx) {
    const { esc, readiness: r, profile: p, S } = ctx;
    if (!r) return '<section class="scr"><div class="bd"><p class="empty">불러오는 중</p></div></section>';
    const why = explainChange(S.readinessPrev, r);
    const warn = r.warnings.map((f) => `<div class="rd-warn"><b>${esc(f.title)}</b><p>${esc(f.reason)}</p></div>`).join('');
    const openDamage = (ctx.records || []).filter(x=>x.type==='disaster' && !x.closed).sort((a,b)=>String(b.accident_date||b.workDate||'').localeCompare(String(a.accident_date||a.workDate||'')))[0];
    const todos = openDamage ? [{id:'open_damage',label:'피해 기록 확인하기',title:'사고 때 할 일',go:'accident/'+openDamage.id},...r.todo] : r.todo;
    const todo = todos.length
      ? todos.slice(0,1).map((t) => `<button class="rd-todo" data-act="go" data-v="${esc(t.go)}"><span>${esc(t.label)}</span><small>${esc(t.title)}</small></button>`).join('')
      : '<p class="mut">지금 할 일이 없어요. 기록을 꾸준히 남겨 주세요.</p>';
    const notice = p.settings?.disclaimer_seen_at ? `<details class="rd-notice"><summary>이 점수는 기록 상태만 보여줘요. 안내 보기</summary><p>${esc(r.notice)}</p></details>` : `<div class="rd-notice"><p>${esc(r.notice)}</p><button type="button" class="ghost" data-act="homeNoticeSeen">확인했어요</button></div>`;
    const w = S.todayWx;
    // 사고일 전후 이력은 오늘의 활성 특보가 아니므로 홈 날씨에 쓰지 않는다.
    const todayAlertText = Array.isArray(S.todayAlerts) ? (S.todayAlerts.length ? S.todayAlerts.map(x=>x.kind).filter(Boolean).join(', ') || '특보 정보 미수집' : '오늘 특보 없음') : '특보 정보 미수집';
    const demo = ctx.session?.demo
      ? `<div class="card rd-demo"><h3>시연 시나리오</h3><p class="mut">가상 데이터로 바꿔요. 지금 기록은 지워져요.</p>
          <div class="chips">${Object.entries(DEMO_SCENARIOS).map(([k, label]) => `<button class="chip" data-act="homeScenario" data-v="${k}">${esc(label)}</button>`).join('')}</div></div>`
      : '';
    const news = DEMO_NEWS.filter(item=>isNewNews(item,readNews())).sort((a,b)=>(a[1]==='재해보험 변경'?0:1)-(b[1]==='재해보험 변경'?0:1)||b[3].localeCompare(a[3]));
    const first = news[0];
    const crops = [...new Set((p.houses||[]).filter(h=>!h.hidden && h.crop).map(h=>h.crop))].join(', ');
    const date = new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(new Date());
    return `<section class="scr home-b">
      <div class="hd home-b-bar"><h1>${esc(p.farmName || '내 농장')}</h1><button class="ghost" data-act="fieldEnter">현장 모드</button><button class="ghost" data-act="go" data-v="accident">사고 났어요</button></div>
      <div class="bd">
        <p class="mut">${esc(date)}, ${crops ? esc(crops)+' ' : ''}${esc((p.houses||[]).filter(h=>!h.hidden&&h.crop).length)}동</p><h2>오늘 한 일을 기록해 볼까요?</h2>
        <button class="big" data-act="go" data-v="record">기록하기</button>
        <div class="home-b-weather">오늘 날씨 ${esc(weatherText(w))}, ${esc(todayAlertText)}</div>
        <div class="home-b-score">${signalCard(r,esc)}<p>피해가 나면 확인하는 기록(정식일, 관리, 출하)을 얼마나 남겼는지예요</p>${why?`<p class="rd-why">${esc(why)}</p>`:''}${notice}${warn}${r.gate_open?'<button class="ghost" data-act="go" data-v="factors">자세히 보기</button>':'<button class="ghost" data-act="go" data-v="insurance/guide">가입 안내 보기</button>'}</div>
        <div class="card home-b-todo"><h3>지금 할 일</h3>${todo}${todos.length>1?`<button class="ghost" data-act="go" data-v="factors">${todos.length-1}개 더</button>`:''}</div>
        <div class="card"><h3>새 소식</h3><p class="mut">가상 예시예요</p>${first?`<button class="ghost info-item" data-act="infoRead" data-v="${esc(first[0])}"><span>${esc(first[1])}</span><strong>${esc(first[2])}</strong></button>`:'<p>새 소식이 없어요</p>'}<button class="ghost" data-act="go" data-v="info">${news.length>1?`${news.length-1}건 더`:'소식 보기'}</button></div>
        ${demo}
      </div></section>`;
  },
  actions: {
    async homeNoticeSeen(el,ctx) { if (el.disabled) return; el.disabled=true; try { ctx.S.profile=await ctx.store.saveProfile(ctx.session.uid,{...ctx.profile,settings:{...(ctx.profile.settings||{}),disclaimer_seen_at:new Date().toISOString()}}); ctx.rerender(); } catch { el.disabled=false; ctx.toast('안내 확인을 저장하지 못했어요'); } },
    async homeScenario(el, ctx) {
      const key = el.dataset.v;
      if (!ctx.session?.demo || ctx.session.uid !== 'demo' || !ctx.profile?.demo || !Object.hasOwn(DEMO_SCENARIOS,key)) { ctx.toast('시연 계정에서만 바꿀 수 있어요'); return; }
      const uid = ctx.session.uid;
      const sc = buildDemoScenario(key);
      const keep = ctx.profile;
      // 프로필의 이름, 농장 이름은 그대로 두고 동과 보험만 시나리오로
      await ctx.store.clearAll(uid);
      await ctx.store.saveProfile(uid, { ...keep, houses: sc.profile.houses, insurance: sc.profile.insurance, settings: { ...(keep.settings || {}), field_mode: false }, demo: true });
      if (sc.records.length) await ctx.store.saveRecordsBulk(uid, sc.records);
      ctx.S.profile = await ctx.store.getProfile(uid);
      ctx.S.field = null;
      ctx.S.readinessPrev = null;
      await ctx.reload({ resetPrev: true });
      ctx.toast(`시연: ${DEMO_SCENARIOS[key]}`);
      if (ctx.S.route && ctx.S.route !== 'home') ctx.go('home'); else ctx.rerender();
    },
  },
};

export { STATE_LABEL };
