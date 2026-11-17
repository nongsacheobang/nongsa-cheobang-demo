// M-03 보험 정보 [Aside 담당]. #/insurance 입력, #/insurance/guide 가입 안내
// profile.insurance: facility_insured, crop_insured(참, 거짓, null=모름), year, insured_area_m2, fire_rider, no_flood_rider, coop_name
// 가입을 권유하거나 상품을 파는 화면이 아니다. 공식 창구(가입한 지역 농축협) 안내만 한다.

import { PRODUCT, cropInsurance } from '../insurance/crops.js';

const TRI = [['yes', '가입했어요', true], ['no', '안 했어요', false], ['unk', '몰라요', null]];
const triKey = (v) => (v === true ? 'yes' : v === false ? 'no' : 'unk');

function tri(name, v, esc) {
  return `<div class="chips">${TRI.map(([k, label]) => `<button class="chip${triKey(v) === k ? ' on' : ''}" data-act="insurancePick" data-f="${name}" data-v="${k}">${esc(label)}</button>`).join('')}</div>`;
}

function guide(ctx) {
  const { esc, profile } = ctx;
  const crops = [...new Set((profile.houses || []).map((h) => h.crop).filter(Boolean))];
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="go" data-v="insurance" aria-label="뒤로">&lt;</button><h1>가입 안내</h1></div>
    <div class="bd">
      <div class="card"><h3>${esc(PRODUCT.name)}</h3>
        <p>하우스(농업용시설물)를 먼저 가입해야 작물(시설작물)을 가입할 수 있어요.</p>
        <p>보장하는 재해: ${esc(PRODUCT.covered_perils.join(', '))}</p>
        </div>
      <div class="card"><h3>내 작물</h3>${crops.map((c) => `<div class="kv"><span class="k">${esc(c)}</span><span class="v">${esc(cropInsurance(c).status)}</span></div>`).join('') || '<p class="mut">농장 정보에서 작물을 먼저 넣어 주세요</p>'}</div>
      <div class="card"><h3>어디서 가입하나요?</h3><p>가까운 지역 농축협이나 품목농협에서 가입해요. 가입 시기는 작물마다 달라요.</p>
        <p class="mut">이 앱은 보험을 팔거나 가입을 대신하지 않아요.</p></div>
      <p class="mut ctr">출처: NH농협손해보험 상품 안내</p>
    </div></section>`;
}

export default {
  route: 'insurance',
  tab: 'coverage',
  title: '보험 정보',
  render(ctx) {
    if (ctx.param === 'guide') return guide(ctx);
    const { esc, S } = ctx;
    const ins = S.insEdit || { ...(ctx.profile.insurance || {}) };
    const realArea = (ctx.profile.houses || []).reduce((s, h) => s + (Number(h.area_m2) || 0), 0);
    return `<section class="scr">
      <div class="hd"><button class="bk" data-act="go" data-v="home" aria-label="뒤로">&lt;</button><h1>보험 정보</h1></div>
      <div class="bd">
        <div class="fld"><label>하우스 보험(농업용시설물)<span class="req">*</span></label>${tri('facility_insured', ins.facility_insured, esc)}</div>
        <div class="fld"><label>작물 보험(시설작물)<span class="req">*</span></label>${tri('crop_insured', ins.crop_insured, esc)}</div>
        <div class="fld"><label for="insYear">가입 연도<span class="opt">선택</span></label><input class="inp" id="insYear" inputmode="numeric" value="${esc(ins.year ?? '')}" placeholder="예: 2026"></div>
        <div class="fld"><label for="insArea">가입 면적(㎡)<span class="opt">선택, 실제 재배 면적 ${realArea || '미입력'}㎡</span></label><input class="inp" id="insArea" inputmode="numeric" value="${esc(ins.insured_area_m2 ?? '')}" placeholder="예: 1660"></div>
        <div class="fld"><label>화재 특약<span class="opt">선택</span></label><div class="chips"><button class="chip${ins.fire_rider ? ' on' : ''}" data-act="insuranceToggle" data-f="fire_rider">가입</button></div></div>
        <div class="fld"><label>물 피해 빼는 특약(수재위험부보장)<span class="opt">선택. 해당 특약의 물 피해 조건은 가입한 농축협에 확인해 주세요</span></label><div class="chips"><button class="chip${ins.no_flood_rider ? ' on' : ''}" data-act="insuranceToggle" data-f="no_flood_rider">가입</button></div></div>
        <div class="fld"><label for="insCoop">가입한 농축협<span class="opt">선택</span></label><input class="inp" id="insCoop" value="${esc(ins.coop_name ?? '')}" placeholder="예: 가상농협"></div>
        <button class="big" data-act="insuranceSave" ${S.busy ? 'disabled' : ''}>저장</button>
        <button class="ghost" data-act="go" data-v="insurance/guide">가입 안내 보기</button>
      </div></section>`;
  },
  actions: {
    insurancePick(el, ctx) {
      const v = { yes: true, no: false, unk: null }[el.dataset.v];
      ctx.S.insEdit = { ...(ctx.S.insEdit || ctx.profile.insurance || {}), [el.dataset.f]: v };
      ctx.rerender();
    },
    insuranceToggle(el, ctx) {
      const f = el.dataset.f;
      const cur = ctx.S.insEdit || ctx.profile.insurance || {};
      ctx.S.insEdit = { ...cur, [f]: !cur[f] };
      ctx.rerender();
    },
    async insuranceSave(el, ctx) {
      const val = (id) => (document.getElementById(id)?.value ?? '').trim();
      const num = (s) => (s === '' ? null : Number.isFinite(Number(s)) ? Number(s) : null);
      const ins = { ...(ctx.S.insEdit || ctx.profile.insurance || {}), year: num(val('insYear')), insured_area_m2: num(val('insArea')), coop_name: val('insCoop') };
      ctx.S.profile = await ctx.store.saveProfile(ctx.session.uid, { ...ctx.profile, insurance: ins });
      ctx.S.insEdit = null;
      ctx.toast('보험 정보를 저장했어요');
      ctx.go('home');
    },
  },
};
