// 작물별 보험 기준표 (기획안 v02 3-5)
// 대상 상품: NH농협손해보험 농작물재해보험(원예시설), 시설작물 담보.
// 계수와 일수는 약관 원문 확인 전에는 null로 두고 점수에 쓰지 않는다(U-13, v01 AGR-15).

export const PRODUCT = {
  name: '농작물재해보험(원예시설)',
  insurer: 'NH농협손해보험',
  source: 'https://www.nhfire.co.kr/product/retrieveProduct.nhfire?pdtCd=H720110',
  covered_perils: ['자연재해', '조수해', '화재(특약 가입 시)'],
  min_payout_note: '시설작물은 약관에 따라 계산한 보험금이 10만 원을 넘을 때 지급',
};

export const CROP_INSURANCE = {
  토마토: {
    item: '토마토',
    facility_crop: true,
    standard_grow_days: null, // v01 AGR-15: 80일(월동 연 1기작 120일), 연도 확인 필요
    prep_cost_coef: null, // v01 AGR-15: 47.6%, 연도 확인 필요
    status: '시설작물 대상 확인. 계수는 약관 원문 확인 중',
  },
  방울토마토: {
    item: null, // 토마토 품목에 포함되는지 확인 필요
    facility_crop: null,
    standard_grow_days: null,
    prep_cost_coef: null,
    status: '토마토 품목에 포함되는지 확인 중',
  },
  딸기: {
    item: '딸기',
    facility_crop: true,
    standard_grow_days: null, // v01 AGR-15: 90일, 연도 확인 필요
    prep_cost_coef: null, // v01 AGR-15: 62.9%, 연도 확인 필요
    status: '시설작물 대상 확인. 계수는 약관 원문 확인 중',
  },
};

export function cropInsurance(crop) {
  return CROP_INSURANCE[crop] || { item: null, facility_crop: null, standard_grow_days: null, prep_cost_coef: null, status: '대상 작물이 아니에요' };
}
