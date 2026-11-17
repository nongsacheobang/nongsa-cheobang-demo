// 작물별 보험 기준표 (기획안 v02 3-5)
// 대상 상품: NH농협손해보험 농작물재해보험(원예시설), 시설작물 담보.
// 2026 약관과 이론서 대조 값. 점수나 보험금 계산에는 사용하지 않는다.

export const PRODUCT = {
  name: '농작물재해보험(원예시설)',
  insurer: 'NH농협손해보험',
  source: 'https://www.nhfire.co.kr/product/retrieveProduct.nhfire?pdtCd=H720110',
  covered_perils: ['자연재해', '조수해', '화재(특약 가입 시)'],
};

export const CROP_INSURANCE = {
  토마토: {
    item: '토마토',
    facility_crop: true,
    standard_grow_days: 80,
    winter_grow_days: 120,
    standard_harvest_days: null, // 실제 수확 개시일부터 종료일까지
    prep_cost_coef: 0.4,
    status: '시설작물 대상이에요',
  },
  방울토마토: {
    item: '토마토',
    facility_crop: true,
    standard_grow_days: 80,
    winter_grow_days: 120,
    standard_harvest_days: null,
    prep_cost_coef: 0.4,
    status: '토마토 품목으로 확인해요',
  },
  딸기: {
    item: '딸기',
    facility_crop: true,
    standard_grow_days: 90,
    standard_harvest_days: 182,
    prep_cost_coef: 0.4,
    status: '시설작물 대상이에요',
  },
};

export function cropInsurance(crop) {
  return CROP_INSURANCE[crop] || { item: null, facility_crop: null, standard_grow_days: null, prep_cost_coef: null, status: '대상 작물이 아니에요' };
}

// 2026년에 확인된 판매 일정만 표시하며, 이후 연도의 일정을 추측하지 않는다.
export function salesPeriodNotice(today) {
  return today >= '2026-02-19' && today <= '2026-11-27'
    ? '2026년 원예시설 가입 기간은 11월 27일까지예요. 판매가 일찍 끝날 수 있으니 농축협에 확인해 주세요.'
    : '';
}
