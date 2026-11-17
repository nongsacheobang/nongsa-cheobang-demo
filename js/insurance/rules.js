// 보험금 받을 준비도: 요인 규칙 R-01~R-15 (기획안 v02 3-2)
// 각 규칙은 순수 함수다. 보험금 액수나 지급 여부를 판단하지 않는다(U-11).
// 입력 ctx: { profile, records(화면 상태 모양), today('YYYY-MM-DD'), alerts(시군구 특보 [{date, kind}] 또는 null=조회 못함) }
// 출력: { state: 'met' | 'unmet' | 'na' | 'unknown', reason, todo: { label, go } | null }
// go 경로: record/<할 일>(M-06), accident/<id>(M-07), insurance, insurance/guide(M-03), farm(M-02)
// 가중치는 MVP 임시값 [제안, 효신 확인 D2-03]. 'gate'는 관문, 'warn'은 점수에 안 넣고 경고로만.

import { SEED } from '../constants.js';

export const MET = 'met';
export const UNMET = 'unmet';
export const NA = 'na';
export const UNKNOWN = 'unknown';

// ---------- 날짜 ----------
const dayNum = (s) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').slice(0, 10));
  if (!match) return null;
  const [, ys, ms, ds] = match, y = Number(ys), m = Number(ms), d = Number(ds);
  const time = Date.UTC(y, m - 1, d), date = new Date(time);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return time / 86400000;
};
export const daysBetween = (a, b) => {
  const x = dayNum(a);
  const y = dayNum(b);
  return x == null || y == null ? null : y - x;
};
const within = (date, today, days) => {
  const d = daysBetween(date, today);
  return d != null && d >= 0 && d <= days;
};

// ---------- 기록 고르기 ----------
const works = (ctx) => (ctx.records || []).filter((r) => r.type !== 'disaster');
const disasters = (ctx) => (ctx.records || []).filter((r) => r.type === 'disaster');
const cropHouses = (ctx) => (ctx.profile?.houses || []).filter((h) => h.crop && !h.hidden);
const onHouse = (r, h) => (r.houseIds || []).includes(h.id);
const isTask = (r, ...names) => names.includes(r.task);

export const PLANTING = '정식';
export const HARVEST_START = '수확 개시';
export const HARVEST_TASKS = ['수확 개시', '수확', '수확 종료', '출하'];
// 하우스 점검과 보수. 기존 '하우스 정비'(사전준비)도 인정
export const FACILITY_CHECK_TASKS = ['하우스 점검', '하우스 정비'];
export const PEST_CONTROL = '병해충 방제';

export function planted(ctx) {
  return works(ctx).some((r) => isTask(r, PLANTING));
}
export function latestDisaster(ctx) {
  const ds = disasters(ctx).slice().sort((a, b) => String(b.accident_date || b.workDate || '').localeCompare(String(a.accident_date || a.workDate || '')));
  return ds[0] || null;
}

// 보장 재해에 해당하는 말(농민이 말한 원인 낱말 기준). 판정이 아니라 확인 안내용이다
const COVERED_WORDS = /강풍|태풍|돌풍|회오리|바람|우박|저온|냉해|동해|동상해|한파|서리|얼어|얼었|호우|폭우|큰\s*비|장맛비|침수|폭설|대설|눈|폭염|고온|일조|짐승|멧돼지|고라니|노루|조수|까치|까마귀|새|화재|불/;
const PEST_WORDS = /병해충|병충해|벌레|곰팡이|흰가루|잿빛|역병|탄저|진딧물|응애|가루이|총채|나방|바이러스|병$|병\s/;

// ---------- 규칙 ----------
export const FACTORS = [
  {
    id: 'R-01', group: '가입', weight: 'gate', title: '농업용시설물(하우스) 보험 가입',
    basis: '대부분은 시설물과 작물을 함께 가입해요. 유리온실에서 재배하는 시설작물은 단독 가입을 확인할 수 있어요',
    evaluate(ctx) {
      if (ctx.profile?.insurance?.facility_type === 'glass_only') return { state: NA, reason: '유리온실에서 재배하는 작물은 시설물 없이 단독 가입이 가능해요. 가입 내용을 농축협에 확인해 주세요', todo: null };
      const v = ctx.profile?.insurance?.facility_insured;
      if (v === true) return { state: MET, reason: '하우스 보험에 가입했어요', todo: null };
      if (v === false) return { state: UNMET, reason: '하우스 보험이 없으면 작물 보험도 가입할 수 없어요', todo: { label: '가입 안내 보기', go: 'insurance/guide' } };
      return { state: UNKNOWN, reason: '하우스 보험 가입 여부를 알려 주세요', todo: { label: '보험 정보 입력', go: 'insurance' } };
    },
  },
  {
    id: 'R-02', group: '가입', weight: 'gate', title: '시설작물 보험 가입',
    basis: '작물 피해는 시설작물 담보에 가입한 경우에 살펴봐요',
    evaluate(ctx) {
      const v = ctx.profile?.insurance?.crop_insured;
      if (v === true) return { state: MET, reason: '작물 보험에 가입했어요', todo: null };
      if (v === false) return { state: UNMET, reason: '작물 보험에 가입하지 않았어요', todo: { label: '가입 안내 보기', go: 'insurance/guide' } };
      return { state: UNKNOWN, reason: '작물 보험 가입 여부를 알려 주세요', todo: { label: '보험 정보 입력', go: 'insurance' } };
    },
  },
  {
    id: 'R-03', group: '가입', weight: 10, title: '가입 면적과 실제 재배 면적이 맞음',
    basis: '가입할 때 사실대로 알려야 해요. 면적 차이 10%는 약관 기준이 아닌 앱의 임시 점검 기준이에요',
    evaluate(ctx) {
      const ins = Number(ctx.profile?.insurance?.insured_area_m2);
      const hs = cropHouses(ctx);
      const real = hs.reduce((s, h) => s + (Number(h.area_m2) || 0), 0);
      if (!ins || !real || hs.some((h) => !Number(h.area_m2))) return { state: UNKNOWN, reason: '가입 면적과 동별 재배 면적을 넣어 주세요', todo: { label: '면적 입력', go: 'farm' } };
      const missingFacility = hs.filter(h => !(Number(h.facility_area_m2) > 0));
      const invalidArea = hs.filter(h => Number(h.facility_area_m2) > 0 && Number(h.area_m2) > Number(h.facility_area_m2));
      if (invalidArea.length) return { state: UNKNOWN, reason: `${invalidArea.map(h=>h.name).join(', ')} 재배 면적이 시설 면적보다 커요. 입력한 면적을 확인해 주세요.`, todo: { label: '면적 입력', go: 'farm' } };
      const lowCropArea = hs.filter(h => Number(h.facility_area_m2) > 0 && Number(h.area_m2) / Number(h.facility_area_m2) < 0.5);
      const areaNote = lowCropArea.length ? `${lowCropArea.map(h=>h.name).join(', ')} 재배 면적이 시설 면적의 절반보다 적어요. 가입 조건을 농축협에 확인해 주세요.` : missingFacility.length ? '시설 면적이 없는 동은 재배 면적 비율을 확인하지 못했어요.' : '모든 동의 재배 면적이 시설 면적의 절반 이상이에요.';
      const gap = Math.abs(ins - real) / real;
      if (gap <= 0.1) return { state: MET, reason: `가입 면적과 재배 면적이 비슷해요. ${areaNote}`, todo: null };
      return { state: UNMET, reason: `가입 면적(${ins}㎡)과 재배 면적(${real}㎡) 차이가 커요. ${areaNote}`, todo: { label: '가입한 농축협에 면적 확인', go: 'insurance' } };
    },
  },
  {
    id: 'R-04', group: '재배 기록', weight: 15, title: '동별 정식일 기록',
    basis: '정식일이 보험증권의 재배 일정과 다르면 가입한 농축협에 알려 주세요',
    evaluate(ctx) {
      const hs = cropHouses(ctx);
      if (!hs.length) return { state: UNKNOWN, reason: '동과 작물을 먼저 넣어 주세요', todo: { label: '농장 정보 입력', go: 'farm' } };
      const missing = hs.filter((h) => !works(ctx).some((r) => isTask(r, PLANTING) && onHouse(r, h)));
      if (!missing.length) return { state: MET, reason: '모든 동의 정식일이 있어요', todo: null };
      return { state: UNMET, progress: (hs.length - missing.length) / hs.length, reason: `${missing.map((h) => h.name).join(', ')} 정식일이 없어요`, todo: { label: '정식일 기록하기', go: 'record/정식' } };
    },
  },
  {
    id: 'R-05', group: '재배 기록', weight: 5, title: '수확 개시일 기록',
    basis: '수확 중 사고는 수확을 시작한 날을 기준으로 계산해요',
    evaluate(ctx) {
      const hv = works(ctx).filter((r) => HARVEST_TASKS.includes(r.task));
      if (!hv.length) return { state: NA, reason: '아직 수확 전이에요', todo: null };
      const hs = cropHouses(ctx);
      if (!hs.length) return { state: UNKNOWN, reason: '동과 작물을 먼저 넣어 주세요', todo: { label: '농장 정보 입력', go: 'farm' } };
      const missing = hs.filter(h => !hv.some(r => isTask(r, HARVEST_START) && onHouse(r, h)));
      if (!missing.length) return { state: MET, reason: '동마다 수확 개시일이 있어요', todo: null };
      return { state: UNMET, progress: (hs.length - missing.length) / hs.length, reason: `${missing.map(h => h.name).join(', ')} 수확 개시일이 없어요`, todo: { label: '수확 개시일 기록', go: 'record/수확 개시' } };
    },
  },
  {
    id: 'R-06', group: '재배 기록', weight: 5, title: '모종 구입 증빙',
    basis: '재배 일정을 확인할 때 모종 구입 내역, 정식 사진이나 출하 기록을 볼 수 있어요',
    evaluate(ctx) {
      const shipped = works(ctx).some((r) => isTask(r, '출하'));
      if (!planted(ctx) && !shipped) return { state: NA, reason: '정식 전이에요', todo: null };
      const ok = shipped || works(ctx).some((r) => (r.materials || []).some((m) => m.kind === SEED && m.action === '구입') || (isTask(r, PLANTING) && Number(r.photo_count) > 0));
      if (ok) return { state: MET, reason: '모종 구입 기록, 정식 사진이나 출하 기록이 있어요', todo: null };
      return { state: UNMET, reason: '모종 구입 영수증이나 정식 사진이 없어요', todo: { label: '모종 구입 기록', go: 'record/모종 구입' } };
    },
  },
  {
    id: 'R-07', group: '관리', weight: 15, title: '꾸준한 관리 기록',
    basis: '평소 해야 할 관리를 하지 않아 생긴 손해는 보상하지 않을 수 있어요. 14일에 2건은 앱 기준이에요',
    evaluate(ctx) {
      if (!planted(ctx)) return { state: NA, reason: '정식 전이에요', todo: null };
      const n = works(ctx).filter((r) => r.stage === '작물관리' && within(r.workDate, ctx.today, 14)).length;
      if (n >= 2) return { state: MET, reason: `최근 2주 관리 기록 ${n}건`, todo: null };
      return { state: UNMET, reason: `최근 2주 관리 기록이 ${n}건이에요(2건 이상 권장)`, todo: { label: '관리 기록하기', go: 'record/작물관리' } };
    },
  },
  {
    id: 'R-08', group: '관리', weight: 10, title: '병해충 발견 뒤 방제',
    basis: '병해충 피해와 방제 기록은 구분해요. 7일은 앱 기준이며 방제 기록이 보상을 뜻하지 않아요',
    evaluate(ctx) {
      const seen = works(ctx).filter((r) => r.pest_seen && within(r.workDate, ctx.today, 30));
      if (!seen.length) return { state: NA, reason: '최근 병해충 발견 기록이 없어요', todo: null };
      const late = seen.filter((s) => !works(ctx).some((r) => isTask(r, PEST_CONTROL) && (() => { const d = daysBetween(s.workDate, r.workDate); return d != null && d >= 0 && d <= 7; })()));
      if (!late.length) return { state: MET, reason: '병해충을 본 뒤 7일 안에 방제했어요', todo: null };
      const previouslyAddressed = late.length < seen.length;
      return { state: UNMET, progress: previouslyAddressed ? 1 : 0, reason: previouslyAddressed ? '이전에 대응한 기록은 점수에 반영했어요. 새로 발견한 병해충의 방제 기록을 확인해 주세요' : '병해충을 본 뒤 방제 기록이 없어요', todo: { label: '방제 기록하기', go: 'record/병해충 방제' } };
    },
  },
  {
    id: 'R-09', group: '시설', weight: 10, title: '하우스 점검과 보수',
    basis: '하우스가 낡거나 고장 나서 생긴 손해는 보상하지 않을 수 있어요. 90일은 앱 기준이에요',
    evaluate(ctx) {
      const ok = works(ctx).some((r) => FACILITY_CHECK_TASKS.includes(r.task) && within(r.workDate, ctx.today, 90));
      if (ok) return { state: MET, reason: '최근 3개월 안에 하우스 점검 기록이 있어요', todo: null };
      return { state: UNMET, reason: '최근 3개월 하우스 점검 기록이 없어요', todo: { label: '하우스 점검 기록', go: 'record/하우스 점검' } };
    },
  },
  {
    id: 'R-10', group: '관리', weight: 5, title: '생육 사진',
    basis: '피해 전 작물 상태를 보여 줄 수 있어요. 30일은 앱 기준이에요',
    evaluate(ctx) {
      if (!planted(ctx)) return { state: NA, reason: '정식 전이에요', todo: null };
      // 동별로 본다(기획안 v02 3-2). 작물이 있는 동마다 최근 30일 사진이 있어야 충족(Codex 반례 11/16)
      const houses = cropHouses(ctx);
      if (!houses.length) return { state: UNKNOWN, reason: '동과 작물을 먼저 넣어 주세요', todo: { label: '농장 정보 입력', go: 'farm' } };
      const noPhoto = houses.filter((h) => !works(ctx).some((r) => onHouse(r, h) && Number(r.photo_count) > 0 && within(r.workDate, ctx.today, 30)));
      if (!noPhoto.length) return { state: MET, reason: '동마다 최근 한 달 안에 작물 사진이 있어요', todo: null };
      return { state: UNMET, progress: (houses.length - noPhoto.length) / houses.length, reason: `${noPhoto.map((h) => h.name).join(', ')} 최근 한 달 작물 사진이 없어요`, todo: { label: '사진과 함께 기록', go: 'record/작물관리' } };
    },
  },
  {
    id: 'R-11', group: '사고 대응', weight: 10, title: '사고 바로 접수',
    basis: '피해가 나면 지체 없이 알려야 해요. 3일 이내는 앱의 임시 점검 기준이며 약관상 기한이 아니에요',
    evaluate(ctx) {
      const d = latestDisaster(ctx);
      if (!d) return { state: NA, reason: '사고 기록이 없어요', todo: null };
      if (!d.accident_date) return { state: UNKNOWN, reason: '사고 날짜를 넣어 주세요', todo: { label: '사고 기록 고치기', go: `accident/${d.id}` } };
      if (!d.reported_at) return { state: UNMET, reason: '가입한 농축협에 아직 접수하지 않았어요', todo: { label: '접수했어요 표시', go: `accident/${d.id}` } };
      const gap = daysBetween(d.accident_date, d.reported_at);
      // 접수일이 사고일보다 빠르면 날짜 오류로 보고 모름(Codex 반례 11/16, 허간 확인 전 임시)
      if (gap == null || gap < 0) return { state: UNKNOWN, reason: '접수일이 사고일보다 빠르거나 날짜가 이상해요. 날짜를 확인해 주세요', todo: { label: '날짜 고치기', go: `accident/${d.id}` } };
      if (gap <= 3) return { state: MET, reason: gap === 0 ? '사고 당일에 접수했어요' : `사고 ${gap}일 만에 접수했어요`, todo: null };
      return { state: UNMET, reason: `사고 뒤 ${gap}일이 지나 접수했어요`, todo: null };
    },
  },
  {
    id: 'R-12', group: '사고 대응', weight: 5, title: '피해 사진',
    basis: '손해평가를 위해 고치기 전에 사진을 찍어 두세요. 결과에 이견이 있으면 설명을 들은 날부터 7일 안에 서류나 사진을 내고 재평가를 요청할 수 있어요',
    evaluate(ctx) {
      const d = latestDisaster(ctx);
      if (!d) return { state: NA, reason: '사고 기록이 없어요', todo: null };
      if (Number(d.photo_count) > 0) return { state: MET, reason: `피해 사진 ${d.photo_count}장`, todo: null };
      return { state: UNMET, reason: '피해 사진이 없어요', todo: { label: '사진 찍기', go: `accident/${d.id}` } };
    },
  },
  {
    id: 'R-13', group: '사고 대응', weight: 'warn', title: '보장하는 재해인지 확인',
    basis: '보장하는 재해는 자연재해, 조수해, 화재(특약)예요. 병해충 피해는 보상하지 않을 수 있어요',
    evaluate(ctx) {
      const d = latestDisaster(ctx);
      if (!d) return { state: NA, reason: '사고 기록이 없어요', todo: null };
      const p = [d.cause_text, ...(Array.isArray(d.peril) ? d.peril : [d.peril])].filter(Boolean).join(', ');
      if (!p) return { state: UNKNOWN, reason: '피해 원인을 적어 주세요', todo: { label: '원인 적기', go: `accident/${d.id}` } };
      if (PEST_WORDS.test(p) && !COVERED_WORDS.test(p)) return { state: UNMET, reason: `"${p}"는 병해충 피해로 보여요. 보상하지 않을 수 있어요`, todo: { label: '가입한 농축협에 확인', go: 'insurance' } };
      if (COVERED_WORDS.test(p)) return { state: UNKNOWN, reason: `"${p}"에 대한 보장 여부는 계약과 사고 내용에 따라 달라요. 가입한 농축협에 확인하세요`, todo: { label: '가입한 농축협에 확인', go: 'insurance' } };
      return { state: UNKNOWN, reason: `"${p}"가 보장하는 재해인지 확인이 필요해요`, todo: { label: '가입한 농축협에 확인', go: 'insurance' } };
    },
  },
  {
    id: 'R-14', group: '사고 대응', weight: 5, title: '기상특보와 사고일이 맞음',
    basis: '사고일 무렵의 기상특보는 참고 자료예요. 전후 1일은 앱 기준이며 실제 발효 기간은 따로 확인해요',
    evaluate(ctx) {
      const d = latestDisaster(ctx);
      if (!d) return { state: NA, reason: '사고 기록이 없어요', todo: null };
      if (dayNum(d.accident_date) == null) return { state: UNKNOWN, reason: '사고 날짜를 확인해 주세요', todo: null };
      if (!Array.isArray(ctx.alerts)) return { state: UNKNOWN, reason: '기상특보 이력을 아직 못 불러왔어요', todo: { label: '특보 이력 확인', go: `accident/${d.id}` } };
      const hit = ctx.alerts.find((a) => { const g = daysBetween(d.accident_date, a.date); return g != null && Math.abs(g) <= 1; });
      if (hit) return { state: MET, reason: `${hit.date} ${hit.kind} 특보가 있었어요`, todo: null };
      return { state: UNMET, reason: '사고일 무렵 우리 지역 기상특보가 없었어요', todo: null };
    },
  },
  {
    id: 'R-15', group: '사고 대응', weight: 'warn', title: '하우스 피해 없이 작물만 피해',
    basis: '약관의 시설작물 손해 요건은 시설 직접 피해, 시설 피해 없이 작물 피해율 70% 이상으로 전체 재배 포기, 기상특보 관련 재해, 조수해, 일조량 부족 인정 시군의 피해 중 해당 조건을 확인해요. 실제 적용은 가입한 농축협에 확인하세요',
    evaluate(ctx) {
      const d = latestDisaster(ctx);
      if (!d) return { state: NA, reason: '사고 기록이 없어요', todo: null };
      const facility = Array.isArray(d.facility_damage) ? d.facility_damage.filter(Boolean).join(', ') : String(d.facility_damage || '').trim();
      if (!facility) return { state: UNKNOWN, reason: '하우스 피해가 있는지 아직 몰라요', todo: { label: '하우스 피해 확인', go: `accident/${d.id}` } };
      const noFacility = /시설 피해 없음/.test(facility);
      if (!noFacility) return { state: NA, reason: '하우스 피해가 있어요', todo: null };
      const r14 = FACTORS.find((f) => f.id === 'R-14').evaluate(ctx);
      if (r14.state === MET) return { state: UNKNOWN, reason: '작물만 피해를 봤고 특보 이력이 있어요. 계약과 피해 조건은 가입한 농축협에 확인해 주세요', todo: { label: '가입한 농축협에 확인', go: 'insurance' } };
      // 특보를 못 불러온 것과 특보가 없었던 것을 구분한다(Codex 반례 11/16). 못 불러왔으면 모름, 경고 아님
      if (r14.state === UNKNOWN) return { state: UNKNOWN, reason: '작물만 피해를 봤어요. 기상특보 이력을 확인하면 판단할 수 있어요', todo: { label: '특보 이력 확인', go: `accident/${d.id}` } };
      return { state: UNMET, reason: '작물만 피해를 봤다면 보상 조건이 까다로울 수 있어요. 특보 이력과 피해 정도를 기록해 두세요', todo: { label: '가입한 농축협에 확인', go: 'insurance' } };
    },
  },
];

export function evaluateAll(ctx) {
  return FACTORS.map((f) => ({ id: f.id, group: f.group, weight: f.weight, title: f.title, basis: f.basis, ...f.evaluate(ctx) }));
}
