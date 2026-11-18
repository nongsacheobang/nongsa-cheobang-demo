// M-02 작물과 농장 정보 [Aside 담당]. 동별 재배 면적과 주수, 시군구.
// 동 추가와 삭제, 이름과 작목 변경은 기존 설정 화면(#/setup, editSetup)을 쓴다.

export default {
  route: 'farm',
  tab: 'settings',
  title: '작물과 농장',
  render(ctx) {
    const { esc, profile: p } = ctx;
    const hs = p.houses || [];
    return `<section class="scr">
      <div class="hd"><button class="bk" data-act="go" data-v="home" aria-label="뒤로">&lt;</button><h1>작물과 농장</h1></div>
      <div class="bd">
        <div class="fld"><label for="farmLoc">농장 위치(시군구)<span class="req">*</span><span class="opt">날씨와 기상특보에 써요</span></label><input class="inp" id="farmLoc" value="${esc(p.location || '')}" placeholder="예: 경상남도 가상군 가상면"></div>
        ${hs.map((h, i) => `<div class="card"><div class="row"><b>${esc(h.name)}</b><span class="sp"></span><span class="tag ac">${esc(h.crop)}</span></div>
          <div class="fld"><label for="farmArea${i}">재배 면적(㎡)<span class="req">*</span></label><input class="inp" id="farmArea${i}" inputmode="numeric" value="${esc(h.area_m2 ?? '')}" placeholder="예: 660"></div>
          <div class="fld"><label for="farmFacilityArea${i}">시설 면적(㎡)<span class="opt">선택, 재배 면적과 구분해 주세요</span></label><input class="inp" id="farmFacilityArea${i}" inputmode="numeric" value="${esc(h.facility_area_m2 ?? '')}" placeholder="예: 700"></div>
          <div class="fld"><label for="farmCount${i}">주수<span class="opt">선택</span></label><input class="inp" id="farmCount${i}" inputmode="numeric" value="${esc(h.plant_count ?? '')}" placeholder="예: 1800"></div></div>`).join('')}
        <button class="big" data-act="farmSave">저장</button>
        <button class="ghost" data-act="editSetup">동 추가, 이름과 작목 바꾸기</button>
      </div></section>`;
  },
  actions: {
    async farmSave(el, ctx) {
      const val = (id) => (document.getElementById(id)?.value ?? '').trim();
      const valid = (s, max = Infinity) => s === '' || (/^(?:\d+)(?:\.\d+)?$/.test(s) && Number.isFinite(Number(s)) && Number(s) > 0 && Number(s) <= max);
      const invalid = (ctx.profile.houses || []).some((_, i) => !valid(val(`farmArea${i}`), 100000) || !valid(val(`farmFacilityArea${i}`)) || !valid(val(`farmCount${i}`)));
      if (invalid) { ctx.toast('면적과 주수를 확인해 주세요'); return; }
      const num = (s) => s === '' ? null : Number(s);
      const houses = (ctx.profile.houses || []).map((h, i) => ({ ...h, area_m2: num(val(`farmArea${i}`)), facility_area_m2: num(val(`farmFacilityArea${i}`)), plant_count: num(val(`farmCount${i}`)) }));
      const location = val('farmLoc') || ctx.profile.location;
      ctx.S.profile = await ctx.store.saveProfile(ctx.session.uid, { ...ctx.profile, location, houses });
      ctx.toast('농장 정보를 저장했어요');
      ctx.go('home');
    },
  },
};
