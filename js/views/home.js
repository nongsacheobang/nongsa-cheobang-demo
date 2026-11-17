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
  return `<div class="rd-sig ${esc(r.signal.color)}" role="status" aria-label="준비도 ${r.score}점, ${esc(r.signal.label)}">
    <p class="rd-sig-cap">준비도</p>
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
    const todo = r.todo.length
      ? r.todo.map((t) => `<button class="rd-todo" data-act="go" data-v="${esc(t.go)}"><span>${esc(t.label)}</span><small>${esc(t.title)}</small></button>`).join('')
      : '<p class="mut">지금 할 일이 없어요. 기록을 꾸준히 남겨 주세요.</p>';
    const w = S.todayWx;
    const demo = ctx.session?.demo
      ? `<div class="card rd-demo"><h3>시연 시나리오</h3><p class="mut">가상 데이터로 바꿔요. 지금 기록은 지워져요.</p>
          <div class="chips">${Object.entries(DEMO_SCENARIOS).map(([k, label]) => `<button class="chip" data-act="homeScenario" data-v="${k}">${esc(label)}</button>`).join('')}</div></div>`
      : '';
    return `<section class="scr">
      <div class="hd"><h1>${esc(p.farmName || '내 농장')}</h1><button class="ic" data-act="go" data-v="me" aria-label="내 농장">내</button></div>
      <div class="bd">
        ${signalCard(r, esc)}
        ${!r.gate_open && salesPeriodNotice(todayStr()) ? `<p class="mut">${esc(salesPeriodNotice(todayStr()))}</p>` : ''}
        ${why ? `<p class="rd-why">${esc(why)}</p>` : ''}
        <p class="rd-notice">${esc(r.notice)}</p>
        ${warn}
        <div class="card"><h3>지금 할 일</h3>${todo}</div>
        ${r.gate_open ? '<button class="ghost" data-act="go" data-v="factors">왜 이 점수인가요?</button>' : '<button class="ghost" data-act="go" data-v="insurance/guide">가입 안내 보기</button>'}
        <div class="rd-quick">
          <button class="big" data-act="go" data-v="record">기록하기</button><button class="ghost" data-act="fieldEnter">현장 모드로 보기</button>
          <button class="big rd-acc" data-act="go" data-v="accident">사고 났어요</button>
        </div>
        <div class="card"><h3>새 소식</h3><p class="mut">가상 예시예요</p>${DEMO_NEWS.filter(item=>isNewNews(item,readNews())).sort((a,b)=>(a[1]==='재해보험 변경'?0:1)-(b[1]==='재해보험 변경'?0:1)||b[3].localeCompare(a[3])).slice(0,2).map(item=>{const [id,category,title]=item;return `<button class="ghost info-item" data-act="infoRead" data-v="${esc(id)}"><span>${esc(category)}</span><strong>${esc(title)}</strong><span>새 소식</span></button>`}).join('') || '<p>새 소식이 없어요</p>'}<button class="ghost" data-act="go" data-v="info">소식 모두 보기</button></div><div class="card"><div class="kv"><span class="k">오늘 날씨</span><span class="v">${esc(weatherText(w))}</span></div>
          <div class="kv"><span class="k">보험 정보</span><span class="v"><button class="lnk" data-act="go" data-v="insurance">보기</button></span></div></div>
        ${demo}
      </div></section>`;
  },
  actions: {
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
