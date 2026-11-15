// 선택지 목록. 출처: 영농일지 입력 항목표 v0.1 3장 (효신 검토 전, "확인 필요" 항목 포함)
// 효신 검토 결과가 나오면 이 파일만 고치면 된다.

export const APP_VERSION = '0.3.0';

export const CROPS = ['토마토', '방울토마토', '딸기'];

export const STAGES = ['사전준비', '경운·토양관리', '육묘·정식', '작물관리', '수확·출하', '정리'];

// 토마토·방울토마토 세부 작업
export const TASKS_TOMATO = {
  '사전준비': ['하우스 정비'],
  '경운·토양관리': ['경운·로터리', '밑거름·퇴비', '토양소독', '이랑·멀칭'],
  '육묘·정식': ['정식'],
  '작물관리': ['관수·양액', '환기·온도관리', '유인·곁순 제거', '적엽(잎 따기)', '적화·적과', '수정(수정벌·착과제)', '병해충 방제', '웃거름(추비)'],
  '수확·출하': ['수확 개시', '수확', '수확 종료', '출하'],
  '정리': ['작물 철거·폐기물 처리'],
};

// 딸기 세부 작업
export const TASKS_STRAWBERRY = {
  '사전준비': ['육묘(런너 받기)'],
  '경운·토양관리': ['경운·로터리', '밑거름·퇴비', '두둑·멀칭'],
  '육묘·정식': ['정식'],
  '작물관리': ['보온(커튼·난방)', '꿀벌 투입', '관수·양액', '적엽·런너 제거', '적화·적과', '병해충 방제', '웃거름(추비)'],
  '수확·출하': ['수확 개시', '수확', '수확 종료', '출하'],
  '정리': ['작물 철거'],
};

export const PESTS_TOMATO = ['잿빛곰팡이병', '잎곰팡이병', '흰가루병', '역병', '담배가루이', '진딧물', '토마토뿔나방', '기타'];
export const PESTS_STRAWBERRY = ['잿빛곰팡이병', '흰가루병', '탄저병', '응애', '진딧물', '총채벌레', '기타'];

export const PESTICIDE_TYPES = ['살충제', '살균제', '살균살충제', '제초제', '생장조정제', '기타'];
export const FERTILIZER_TYPES = ['유기질(퇴비·유박)', '화학(복합·단비)', '양액 비료', '엽면시비·미량요소', '토양개량제', '기타'];

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
export const PERILS = ['강풍·태풍', '우박', '냉해·동상해', '호우', '폭설', '폭염', '짐승·새', '화재', '기타'];
export const FACILITY_DAMAGES = ['비닐 찢어짐', '골조 휨·파손', '보온커튼·난방기 등 설비', '시설 피해 없음'];
export const CROP_SYMPTOMS = ['잎·줄기 상함', '열매 상처', '얼어서 시듦', '쓰러짐·꺾임', '죽음'];
export const PHOTO_NOTICE = '수리·철거 전에 사진 먼저 찍어두세요';

// 엑셀 시트3 "재해 기록"
export const DISASTER_HEADERS = [
  '기록ID', '사고일', '작성시각', '사후입력 여부', '재해 종류', '피해 동(필지)', '작목', '시설 피해', '작물 피해',
  '연속 재해', '메모', '원문 발화', '입력 방식', '작성자', '가상(데모) 데이터',
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
