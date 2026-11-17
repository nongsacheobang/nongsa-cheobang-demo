import { accidentChecklist } from '../accident-checklist.js';

export default {
  route: 'coverage', tab: 'coverage', title: '재해보험',
  render(ctx = {}) {
    const e = ctx.esc || String;
    const latest = (ctx.records || []).filter(r => r.type === 'disaster' && !r.closed).sort((a,b) => String(b.accident_date || '').localeCompare(String(a.accident_date || '')))[0];
    const count = latest ? accidentChecklist(latest, ctx.profile).remaining : 0;
    return `<section class="scr" data-screen-id="S-INS"><div class="hd"><h1>재해보험</h1></div><div class="bd">
    ${latest ? `<div class="card"><p>보험금 지급 여부는 가입한 농축협에 확인해 주세요.</p><button class="ghost" data-act="go" data-v="accident/${e(latest.id)}" data-spec-id="B-INS-03">피해 기록 ${e(latest.accident_date || '날짜 미입력')} <span>할 일 ${e(count)}개 남았어요</span></button></div>` : ''}
    <p>기록을 바탕으로 준비 상태를 살펴보세요.</p>
    <button class="big" data-act="go" data-v="factors" data-spec-id="B-INS-01">기록 준비도 자세히 보기</button>
    <button class="ghost" data-act="go" data-v="accident" data-spec-id="B-INS-02">사고 났어요</button>
    <button class="ghost" data-act="go" data-v="report" data-spec-id="B-INS-04">기록 모아보기</button><button class="ghost" data-act="go" data-v="insurance" data-spec-id="B-INS-05">내 보험 정보</button>
    ${ctx.features?.claimCalc && ctx.session?.demo && ctx.session.uid === 'demo' && ctx.profile?.demo ? '<button class="ghost" data-act="claimOpen" data-spec-id="B-INS-09">약관 산식으로 계산해 보기</button>' : ''}
    ${ctx.features?.premiumCalc ? '<button class="ghost" data-act="go" data-v="premium" data-spec-id="B-INS-06">보험료 대략 확인</button>' : ''}
    ${!(ctx.features?.claimCalc && ctx.session?.demo && ctx.session.uid === 'demo' && ctx.profile?.demo) ? `<details class="card"><summary>보험금이 정해지는 과정</summary><p>시설작물 보험금은 피해 작물 재배면적, 단위면적당 보장생산비, 경과비율, 피해율을 살펴 정해요.</p><p>경과비율은 정식일부터 사고일까지 키운 기간을 살펴 정해요.</p><p>피해 정도는 보험사 현장 조사에서 동마다 확인해요.</p><p>설명은 이해를 돕는 예시예요. 지급 여부와 금액은 가입 내용과 보험사 현장 조사에 따라 정해져요.</p></details>` : ''}
    </div></section>`;
  }, actions: {}
};
