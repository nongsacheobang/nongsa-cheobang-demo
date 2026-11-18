// 선택지 목록. 출처: 영농일지 입력 항목표 v0.1 3장 (효신 검토 전, "확인 필요" 항목 포함)
// 효신 검토 결과가 나오면 이 파일만 고치면 된다.

export const APP_VERSION = '0.4.0';

export const CROPS = ['토마토', '방울토마토', '딸기'];

export const STAGES = ['사전준비', '경운과 토양관리', '육묘와 정식', '작물관리', '수확과 출하', '정리'];

// 토마토, 방울토마토 세부 작업
export const TASKS_TOMATO = {
  '사전준비': ['하우스 정비', '하우스 점검'],
  '경운과 토양관리': ['경운과 로터리', '밑거름과 퇴비', '토양소독', '이랑과 멀칭'],
  '육묘와 정식': ['정식', '모종 구입'],
  '작물관리': ['관수와 양액', '환기와 온도관리', '유인과 곁순 제거', '적엽(잎 따기)', '적화와 적과', '수정(수정벌과 착과제)', '병해충 방제', '웃거름(추비)'],
  '수확과 출하': ['수확 개시', '수확', '수확 종료', '출하'],
  '정리': ['작물 철거와 폐기물 처리'],
};

// 딸기 세부 작업
export const TASKS_STRAWBERRY = {
  '사전준비': ['육묘(런너 받기)', '하우스 점검'],
  '경운과 토양관리': ['경운과 로터리', '밑거름과 퇴비', '두둑과 멀칭'],
  '육묘와 정식': ['정식', '모종 구입'],
  '작물관리': ['보온(커튼과 난방)', '환기와 온도관리', '꿀벌 투입', '관수와 양액', '적엽과 런너 제거', '적화와 적과', '병해충 방제', '웃거름(추비)'],
  '수확과 출하': ['수확 개시', '수확', '수확 종료', '출하'],
  '정리': ['작물 철거'],
};

export const PESTS_TOMATO = ['잿빛곰팡이병', '잎곰팡이병', '흰가루병', '역병', '담배가루이', '진딧물', '토마토뿔나방', '기타'];
export const PESTS_STRAWBERRY = ['잿빛곰팡이병', '흰가루병', '탄저병', '응애', '진딧물', '총채벌레', '기타'];

export const PESTICIDE_TYPES = ['살충제', '살균제', '살균살충제', '제초제', '생장조정제', '기타'];
export const FERTILIZER_TYPES = ['유기질(퇴비와 유박)', '화학(복합과 단비)', '양액 비료', '엽면시비와 미량요소', '토양개량제', '기타'];

export const UNITS_PESTICIDE = ['mL', 'L', 'g', 'kg', '병', '봉지'];
export const UNITS_FERTILIZER = ['kg', '포대', 'L', '톤'];

// 자재 구분 (v0.3: 손해평가사 검토 반영, 모종 구매내역은 재배 일정 증빙서류)
export const SEED = '종묘(모종)';
export const MATERIAL_KINDS = ['농약', '비료', SEED];
export const SEED_TYPES = ['모종', '접목묘', '종자', '기타'];
export const UNITS_SEED = ['주', '포기', '판', '봉지'];

export function typesFor(kind) {
  if (kind === SEED) return SEED_TYPES;
  return kind === '비료' ? FERTILIZER_TYPES : PESTICIDE_TYPES;
}
export function unitsFor(kind) {
  if (kind === SEED) return UNITS_SEED;
  return kind === '비료' ? UNITS_FERTILIZER : UNITS_PESTICIDE;
}
export function defaultUnit(kind) {
  if (kind === SEED) return '주';
  return kind === '비료' ? 'kg' : 'mL';
}

// 재해 기록 (손해평가사 관점 평가 v1 3장 재해 확인 카드, P0 최소 필드)
export const PERILS = ['강풍과 태풍', '우박', '냉해와 동상해', '호우', '폭설', '폭염', '짐승과 새', '화재', '기타'];
export const FACILITY_DAMAGES = ['비닐 찢어짐', '골조 휨과 파손', '보온커튼과 난방기 등 설비', '시설 피해 없음'];
export const CROP_SYMPTOMS = ['잎과 줄기 상함', '열매 상처', '얼어서 시듦', '쓰러짐과 꺾임', '죽음'];
export const PHOTO_NOTICE = '수리나 철거 전에 사진 먼저 찍어두세요';

// 엑셀 시트3 "재해 기록"
export const DISASTER_HEADERS = [
  '기록ID', '사고일', '작성시각', '사후입력 여부', '재해 종류', '피해 동(필지)', '작목', '시설 피해', '작물 피해',
  '연속 재해', '메모', '원문 발화', '입력 방식', '작성자', '가상(데모) 데이터', '직접 선택한 재해 종류', '접수일', '사진 수', '처리 끝',
];

export const DILUTIONS = ['500', '1000', '2000'];
export const AREA_UNITS = ['㎡', '평', '동 전체'];

export const SKY = ['맑음', '구름많음', '흐림', '비', '눈'];

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 표준 영농기록장 A~M열 (영농일지 입력 항목표 v0.1 4장)
export const EXCEL_HEADERS = [
  '작업일', '필지', '작목', '날씨', '구입/사용',
  '농약 종류', '농약 제품명', '농약 구입량/사용량',
  '비료 종류', '비료 제품명', '비료 구입량/사용량',
  '작업단계(작업명)', '세부작업내용',
];

export function tasksFor(crop) {
  return crop === '딸기' ? TASKS_STRAWBERRY : TASKS_TOMATO;
}
export function pestsFor(crop) {
  return crop === '딸기' ? PESTS_STRAWBERRY : PESTS_TOMATO;
}

// D2-09(11/16): 코드 값의 가운뎃점을 '와/과'로 바꿨다. 예전 기록은 읽을 때 이 표로 새 이름으로 바꾼다(js/contract.js).
// 쉼표는 여러 값을 잇는 칸과 섞여서 쓰지 않는다.
export const LEGACY_VALUES = [
  ['보온커튼\u00b7난방기 등 설비', '보온커튼과 난방기 등 설비'],
  ['작물 철거\u00b7폐기물 처리', '작물 철거와 폐기물 처리'],
  ['수리\u00b7철거 전에', '수리나 철거 전에'],
  ['보온(커튼\u00b7난방)', '보온(커튼과 난방)'],
  ['수정(수정벌\u00b7착과제)', '수정(수정벌과 착과제)'],
  ['유기질(퇴비\u00b7유박)', '유기질(퇴비와 유박)'],
  ['화학(복합\u00b7단비)', '화학(복합과 단비)'],
  ['엽면시비\u00b7미량요소', '엽면시비와 미량요소'],
  ['경운\u00b7토양관리', '경운과 토양관리'],
  ['환기\u00b7온도관리', '환기와 온도관리'],
  ['유인\u00b7곁순 제거', '유인과 곁순 제거'],
  ['적엽\u00b7런너 제거', '적엽과 런너 제거'],
  ['골조 휨\u00b7파손', '골조 휨과 파손'],
  ['잎\u00b7줄기 상함', '잎과 줄기 상함'],
  ['쓰러짐\u00b7꺾임', '쓰러짐과 꺾임'],
  ['강풍\u00b7태풍', '강풍과 태풍'],
  ['냉해\u00b7동상해', '냉해와 동상해'],
  ['짐승\u00b7새', '짐승과 새'],
  ['경운\u00b7로터리', '경운과 로터리'],
  ['관수\u00b7양액', '관수와 양액'],
  ['두둑\u00b7멀칭', '두둑과 멀칭'],
  ['밑거름\u00b7퇴비', '밑거름과 퇴비'],
  ['수확\u00b7출하', '수확과 출하'],
  ['육묘\u00b7정식', '육묘와 정식'],
  ['이랑\u00b7멀칭', '이랑과 멀칭'],
  ['적화\u00b7적과', '적화와 적과'],
];
export function renameLegacy(v) {
  if (typeof v !== 'string' || !v.includes('\u00b7')) return v;
  let s = v;
  for (const [a, b] of LEGACY_VALUES) s = s.split(a).join(b);
  return s.split('\u00b7').join(', ');
}

