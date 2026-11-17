import { accidentChecklist } from '../accident-checklist.js';

export default {
  route: 'coverage', tab: 'coverage', title: '재해보험',
  render(ctx = {}) {
    const e = ctx.esc || String;
    const latest = (ctx.records || []).filter(r => r.type === 'disaster' && !r.closed).sort((a,b) => String(b.accident_date || '').localeCompare(String(a.accident_date || '')))[0];
    const count = latest ? accidentChecklist(latest, ctx.profile).remaining : 0;
    return `<section class="scr"><div class="hd"><h1>재해보험</h1></div><div class="bd">
    ${latest ? `<div class="card"><p>보험금 지급 여부는 가입한 농축협에 확인해 주세요.</p><button class="ghost" data-act="go" data-v="accident/${e(latest.id)}">피해 기록 ${e(latest.accident_date || '날짜 미입력')} <span>할 일 ${e(count)}개 남았어요</span></button></div>` : ''}
    <p>기록을 바탕으로 준비 상태를 살펴보세요.</p>
    <button class="big" data-act="go" data-v="factors">준비도 자세히 보기</button>
    <button class="ghost" data-act="go" data-v="accident">사고 났어요</button>
    <button class="ghost" data-act="go" data-v="report">준비도 보고서 보기</button><button class="ghost" data-act="go" data-v="insurance">내 보험 정보</button>
    <details class="card"><summary>보험금이 정해지는 과정</summary><p>시설작물 보험금은 피해 작물 재배면적, 단위면적당 보장생산비, 경과비율, 피해율을 살펴 정해요.</p><p>경과비율은 정식일부터 사고일까지 키운 기간을 살펴 정해요.</p><p>피해율은 손해평가사가 현장에서 동마다 조사해요.</p><p>설명은 이해를 돕는 예시예요. 지급 여부와 금액은 가입 내용과 손해평가에 따라 정해집니다.</p></details>
    </div></section>`;
  }, actions: {}
};
