// 요율을 확인하기 전에는 계산하지 않는다.
export default {
  route: 'premium', tab: 'coverage', title: '보험료 대략 확인',
  render(ctx = {}) {
    if (!ctx.features?.premiumCalc) return `<section class="scr"><div class="hd"><button class="bk" data-act="go" data-v="coverage" aria-label="뒤로">&lt;</button><h1>보험료 대략 확인</h1></div><div class="bd"><p>아직 준비 중이에요.</p></div></section>`;
    return `<section class="scr"><div class="hd"><button class="bk" data-act="go" data-v="coverage" aria-label="뒤로">&lt;</button><h1>보험료 대략 확인</h1></div><div class="bd"><div class="card"><label class="fld">재배 면적<input class="inp" type="number" min="0" inputmode="decimal" placeholder="제곱미터"></label><label class="fld">작물<select class="inp"><option value="">선택해 주세요</option><option>토마토</option><option>방울토마토</option><option>딸기</option></select></label><label class="fld">시설 종류<select class="inp"><option value="">선택해 주세요</option><option>비닐하우스</option><option>유리온실</option><option>기타</option></select></label><p>보험료 요율 확인 중</p><p>대략값이에요. 정확한 보험료는 가입한 농축협에서 확인하세요.</p></div></div></section>`;
  }, actions: {}
};
