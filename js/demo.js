// 가상 데모 데이터 (시설 토마토, 방울토마토, 딸기). 모든 값은 가상이며 demo: true 로 표시된다.
// 효신이 11/22까지 준비하는 실제 데모 농가 데이터가 오면 이 파일을 교체한다.

import { todayStr } from './records.js';

export const DEMO_PROFILE = {
  name: '김데모',
  farmName: '가상농가',
  location: '경상남도 가상군 가상면',
  houses: [
    { id: 'h1', name: '1동', lot: '가상리 123', crop: '토마토', area_m2: 660, plant_count: 1800 },
    { id: 'h2', name: '2동', lot: '가상리 124', crop: '방울토마토', area_m2: 500, plant_count: 2500 },
    { id: 'h3', name: '3동', lot: '가상리 130-2', crop: '딸기', area_m2: 500, plant_count: 4000 },
  ],
  // 가상 보험 정보(기획안 v02 4장). 시연 시나리오가 바꿔 쓴다
  insurance: { facility_insured: true, crop_insured: true, year: 2026, insured_area_m2: 1660, fire_rider: false, no_flood_rider: false, coop_name: '가상농협' },
  demo: true,
};

const SKIES = ['맑음', '맑음', '구름많음', '흐림', '맑음', '구름많음', '비'];

// [며칠 전, 동, 작목, 단계, 작업, 자재[], 메모]
const PLAN = [
  [1, ['h1'], '토마토', '작물관리', '병해충 방제', [{ kind: '농약', action: '사용', type: '살균제', name: '가상곰팡이 액상', qty: '100', unit: 'mL', dilution: '1000', pest: '잿빛곰팡이병' }], '아랫잎 위주'],
  [2, ['h3'], '딸기', '작물관리', '적엽과 런너 제거', [], ''],
  [3, ['h1'], '토마토', '작물관리', '웃거름(추비)', [{ kind: '비료', action: '사용', type: '화학(복합과 단비)', name: '가상 복합비료 21-17-17', qty: '', unit: 'kg', dilution: '', pest: '' }], ''],
  [4, ['h2'], '방울토마토', '수확과 출하', '수확', [], '약 120kg'],
  [5, ['h3'], '딸기', '작물관리', '꿀벌 투입', [], ''],
  [7, ['h1'], '토마토', '작물관리', '유인과 곁순 제거', [], ''],
  [9, ['h3'], '딸기', '', '', [{ kind: '농약', action: '구입', type: '살충제', name: '가상충 유제', qty: '2', unit: '병', dilution: '', pest: '' }], ''],
  [11, ['h1'], '토마토', '작물관리', '관수와 양액', [{ kind: '비료', action: '사용', type: '양액 비료', name: '가상 양액 A', qty: '20', unit: 'kg', dilution: '', pest: '' }], ''],
  [13, ['h3'], '딸기', '작물관리', '보온(커튼과 난방)', [], ''],
  [15, ['h1'], '토마토', '작물관리', '적엽(잎 따기)', [], ''],
  [17, ['h3'], '딸기', '작물관리', '병해충 방제', [{ kind: '농약', action: '사용', type: '살충제', name: '가상충 유제', qty: '20', unit: 'mL', dilution: '2000', pest: '응애' }], ''],
  [20, ['h2'], '방울토마토', '작물관리', '수정(수정벌과 착과제)', [], ''],
  [23, ['h1'], '토마토', '작물관리', '환기와 온도관리', [], ''],
  [26, ['h3'], '딸기', '육묘와 정식', '정식', [{ kind: '비료', action: '구입', type: '유기질(퇴비와 유박)', name: '가상 유박', qty: '10', unit: '포대', dilution: '', pest: '' }], '정식 4,000주'],
  [30, ['h3'], '딸기', '경운과 토양관리', '두둑과 멀칭', [], ''],
  [34, ['h3'], '딸기', '경운과 토양관리', '밑거름과 퇴비', [{ kind: '비료', action: '사용', type: '유기질(퇴비와 유박)', name: '가상 유박', qty: '8', unit: '포대', dilution: '', pest: '' }], ''],
  [38, ['h1'], '토마토', '수확과 출하', '출하', [], '공판장'],
  [42, ['h2'], '방울토마토', '작물관리', '병해충 방제', [{ kind: '농약', action: '사용', type: '살충제', name: '가상가루이 수화제', qty: '50', unit: 'g', dilution: '1000', pest: '담배가루이' }], ''],
  [47, ['h3'], '딸기', '사전준비', '육묘(런너 받기)', [], ''],
  [52, ['h1'], '토마토', '사전준비', '하우스 정비', [], ''],
  // 작목이 다른 동은 한 기록에 넣지 않는다(계약 C-6). 1동과 함께 했던 2동 작업을 따로 둔다
  [3, ['h2'], '방울토마토', '작물관리', '웃거름(추비)', [{ kind: '비료', action: '사용', type: '화학(복합과 단비)', name: '가상 복합비료 21-17-17', qty: '', unit: 'kg', dilution: '', pest: '' }], ''],
  [11, ['h2'], '방울토마토', '작물관리', '관수와 양액', [{ kind: '비료', action: '사용', type: '양액 비료', name: '가상 양액 A', qty: '20', unit: 'kg', dilution: '', pest: '' }], ''],
  [23, ['h2'], '방울토마토', '작물관리', '환기와 온도관리', [], ''],
  [52, ['h2'], '방울토마토', '사전준비', '하우스 정비', [], ''],
];

function shift(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export function buildDemoRecords(profile = DEMO_PROFILE, author = '김데모', email = 'demo@nongsa.example') {
  return PLAN.map(([ago, houseIds, crop, stage, task, mats, memo], i) => {
    const d = shift(ago);
    const workDate = todayStr(d);
    const created = new Date(d);
    created.setHours(19, 10 + (i % 40), 0, 0);
    // 2건은 다음 날 사후입력
    if (i === 4 || i === 12) created.setDate(created.getDate() + 1);
    const tmin = 2 + ((i * 3) % 7);
    const weather = i === 6
      ? { status: 'missing', sky: '', tmin: null, tmax: null, rain: null, source: '', reason: '미수집 (가상)', fetchedAt: created.toISOString() }
      : { status: 'ok', sky: SKIES[i % SKIES.length], tmin, tmax: tmin + 9 + (i % 3), rain: SKIES[i % SKIES.length] === '비' ? 4.5 : 0, source: 'mock', reason: '', fetchedAt: created.toISOString() };
    // 내 농장 동에 맞춰 붙인다: 같은 id -> 같은 작목 -> (토마토류끼리) -> 첫 동
    const hs = profile.houses || [];
    const pick = (hid) => {
      const want = DEMO_PROFILE.houses.find((h) => h.id === hid)?.crop || crop;
      return hs.find((h) => h.id === hid && h.crop === want) || hs.find((h) => h.crop === want)
        || (want !== '딸기' && hs.find((h) => h.crop !== '딸기')) || hs[0];
    };
    const mapped = [...new Set(houseIds.map(pick).filter(Boolean).map((h) => h.id))];
    const firstCrop = hs.find((h) => h.id === mapped[0])?.crop || crop;
    return {
      workDate,
      houseIds: mapped,
      crop: crop === firstCrop || (crop !== '딸기' && firstCrop !== '딸기') ? crop : firstCrop,
      cropManual: false,
      weather,
      stage,
      task,
      materials: mats.map((m) => ({ ...m })),
      area: { value: '', unit: '㎡' },
      detail: '',
      detailEdited: false,
      memo,
      author,
      authorEmail: email,
      createdAt: created.toISOString(),
      updatedAt: null,
      demo: true,
    };
  });
}

// ---------- 시연 시나리오 (기획안 v02 3-6, 작업 지시 v03 A2) ----------
// 오늘 기준 며칠 전으로 만든다. (가) 가입만, 기록 없음 (나) 정식, 관리, 점검, 사진 (다) (나) + 강풍 사고 대응
// 모든 값은 가상. 화면의 시연 버튼(11/19 M-04)에서 고른다.
export const DEMO_SCENARIOS = {
  ga: '(가) 위험',
  na: '(나) 준비됨',
  da: '(다) 사고 직후',
};

export function buildDemoScenario(key, today = new Date()) {
  const base = new Date(today);
  base.setHours(12, 0, 0, 0);
  const ago = (n) => { const d = new Date(base); d.setDate(d.getDate() - n); return todayStr(d); };
  const at = (n) => { const d = new Date(base); d.setDate(d.getDate() - n); d.setHours(19, 0, 0, 0); return d.toISOString(); };
  const profile = JSON.parse(JSON.stringify(DEMO_PROFILE));
  const W = (n, houseIds, crop, stage, task, extra = {}) => ({
    workDate: ago(n), houseIds, crop, cropManual: false, stage, task, materials: [], area: { value: '', unit: '㎡' },
    detail: '', detailEdited: false, memo: '', author: profile.name, createdAt: at(n), updatedAt: null, demo: true,
    weather: { status: 'ok', sky: '맑음', tmin: 4, tmax: 15, rain: 0, source: 'mock', reason: '', fetchedAt: at(n) }, ...extra,
  });
  if (key === 'ga') {
    // 시연 첫 정식의 실제 점수 차이를 보여 주기 위해 한 동으로 시작한다.
    profile.houses = profile.houses.filter(h => h.id === 'h1');
    profile.insurance.insured_area_m2 = profile.houses[0].area_m2;
    return { profile, records: [], alerts: [] };
  }
  const grow = [
    W(48, ['h1'], '토마토', '육묘와 정식', '정식', { photo_count: 2 }),
    W(47, ['h2'], '방울토마토', '육묘와 정식', '정식', { photo_count: 1 }),
    W(46, ['h3'], '딸기', '육묘와 정식', '정식', { materials: [{ kind: '종묘(모종)', action: '구입', type: '모종', name: '가상 설향 모종', qty: '4000', unit: '주', dilution: '', pest: '' }] }),
    W(60, ['h1'], '토마토', '사전준비', '하우스 점검'),
    W(8, ['h1'], '토마토', '작물관리', '관수와 양액', { photo_count: 1 }),
    W(5, ['h2'], '방울토마토', '작물관리', '환기와 온도관리', { photo_count: 1 }),
    W(2, ['h3'], '딸기', '작물관리', '보온(커튼과 난방)', { photo_count: 1 }),
  ];
  if (key === 'na') return { profile, records: grow, alerts: [] };
  if (key === 'da') {
    // 계산 장면만 토마토 세 동으로 구성한다. 위험 시나리오는 한 동을 유지한다.
    profile.houses = profile.houses.map(h => ({ ...h, crop: '토마토', area_m2: 660 }));
    profile.insurance.insured_area_m2 = 1980;
    profile.insurance.houses = profile.houses.map(h => ({ house_id: h.id, insured_area_m2: 660, crop_sum_insured_krw: 9900000, crop_basis: '토마토', facility_sum_insured_krw: 15000000, harvest_end_plan: `${base.getFullYear()+1}-05-31` }));
    profile.insurance.crop_coverage_ratio = null;
    profile.insurance.replacement_rider = true;
    const cropRecords = grow.filter(r => !(r.task === '정식' && r.houseIds.includes('h3'))).map(r => ({ ...r, crop: '토마토', task: r.task === '보온(커튼과 난방)' ? '환기와 온도관리' : r.task }));
    cropRecords.push(W(73, ['h3'], '토마토', '육묘와 정식', '정식'), W(72, ['h3'], '토마토', '육묘와 정식', '정식'));
    const acc = {
      type: 'disaster', workDate: ago(1), accident_date: ago(1), continuing: false, houseIds: ['h3'], crop: '토마토',
      cause_text: '밤새 바람이 세게 불어서 비닐이 찢어졌어요', peril: [], facility_damage: '비닐 찢어짐', crop_symptom: '잎과 줄기 상함',
      reported_at: ago(0), photo_count: 4, closed: false, memo: '', source_text: '밤새 바람이 세게 불어서 비닐이 찢어졌어요', author: profile.name, createdAt: at(1), updatedAt: null, demo: true,
      alert_check: { source: 'demo', sigungu: '가상군', from: ago(2), to: ago(0), items: [{ date: ago(2), kind: '강풍주의보' }] },
    };
    return { profile, records: [...cropRecords, acc], alerts: [{ date: ago(2), kind: '강풍주의보' }] };
  }
  throw new Error('없는 시연 시나리오: ' + key);
}