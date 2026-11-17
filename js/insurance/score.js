// 보험금 받을 준비도 점수 (기획안 v02 3-3, 3-4)
// 점수 = 충족 가중치 합 / 해당 있는 가중치 합 x 100 (모름은 부족으로 셈)
// 신호등: 80 이상 준비됨, 50~79 보완 필요, 50 미만 위험. 경고가 있으면 한 단계 낮춤.
// 보험금 액수와 지급 여부는 말하지 않는다(U-11). 화면은 항상 NOTICE를 함께 보여 준다(U-12).

import { evaluateAll, MET, UNMET, NA, UNKNOWN, planted, latestDisaster, HARVEST_TASKS, currentHarvestRecords, daysBetween } from './rules.js';

export const NOTICE = '보험금 지급을 보장하지 않으며, 손해평가, 손해사정이 아닙니다.';

export const SIGNALS = {
  ready: { key: 'ready', label: '기록이 잘 쌓였어요', color: 'green' },
  partial: { key: 'partial', label: '기록을 더 하면 좋아요', color: 'yellow' },
  risk: { key: 'risk', label: '기록이 적어요', color: 'red' },
  gate: { key: 'gate', label: '가입이 먼저예요', color: 'gray' },
};

const ORDER = ['ready', 'partial', 'risk'];
const lower = (k) => ORDER[Math.min(ORDER.indexOf(k) + 1, ORDER.length - 1)];

// 농사 단계 (3-4)
export function stageOf(ctx) {
  const d = latestDisaster(ctx);
  if (d && !d.closed) return { key: 'accident', label: '사고 직후' };
  const ins = ctx.profile?.insurance || {};
  if ((ins.facility_type !== 'glass_only' && ins.facility_insured !== true) || ins.crop_insured !== true) return { key: 'before_insurance', label: '가입 전' };
  const harvests = currentHarvestRecords(ctx);
  if (harvests.length && !harvests.some(r => daysBetween(r.workDate, ctx.today) != null)) return { key: 'unknown', label: '날짜 확인 필요' };
  const plantings = (ctx.records || []).filter(r => r.type !== 'disaster' && r.task === '정식');
  if (!harvests.length && plantings.length && !plantings.some(r => daysBetween(r.workDate, ctx.today) != null)) return { key: 'unknown', label: '날짜 확인 필요' };
  const houses = (ctx.profile?.houses || []).filter(h => h.crop && !h.hidden);
  const ended = h => harvests.some(r => r.task === '수확 종료' && (r.houseIds || []).includes(h.id));
  if (houses.length && houses.every(ended)) return { key: 'season_end', label: '작기 끝' };
  if (harvests.some(r => HARVEST_TASKS.includes(r.task) && r.task !== '수확 종료' && (!houses.length || (r.houseIds || []).some(id => houses.some(h => h.id === id && !ended(h)))))) return { key: 'harvest', label: '수확 중' };
  if (planted(ctx)) return { key: 'growing', label: '생육 중' };
  return { key: 'before_planting', label: '정식 전' };
}

export function computeReadiness(ctx) {
  const factors = evaluateAll(ctx);
  const records = (ctx.records || []).filter(r => r.type !== 'disaster');
  // 사후 입력은 작업일이 아니라 실제 입력일부터 유예한다. 입력 시각이 없는 옛 기록만 작업일을 쓴다.
  const recordedDate = r => { const time = (r.availableAt || r.createdAt) && new Date(r.availableAt || r.createdAt); return time && Number.isFinite(time.getTime()) ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(time) : r.workDate; };
  const firstDate = predicate => records.filter(predicate).map(recordedDate).filter(d => daysBetween(d, ctx.today) != null && daysBetween(d, ctx.today) >= 0).sort()[0];
  const triggers = { 'R-05': currentHarvestRecords(ctx).map(recordedDate).filter(d => daysBetween(d, ctx.today) != null && daysBetween(d, ctx.today) >= 0).sort()[0], 'R-06': firstDate(r => r.task === '정식'), 'R-07': firstDate(r => r.task === '정식'), 'R-08': firstDate(r => !!r.pest_seen && daysBetween(r.workDate, ctx.today) != null && daysBetween(r.workDate, ctx.today) >= 0 && daysBetween(r.workDate, ctx.today) <= 30), 'R-10': firstDate(r => r.task === '정식') };
  for (const f of factors) { const age = daysBetween(triggers[f.id], ctx.today); if (f.weight !== 'info' && f.state !== MET && f.state !== NA && !(f.id === 'R-08' && Number(f.progress) > 0) && age != null && age >= 0 && age < 7) { f.pending = true; f.basis += ' 새 항목은 첫 7일 동안 점수에서 제외하는 앱 기준이에요.'; } }
  const stage = stageOf(ctx);
  const gates = factors.filter((f) => f.weight === 'gate');
  const warnings = factors.filter((f) => f.weight === 'warn' && f.state === UNMET);
  const scored = factors.filter((f) => typeof f.weight === 'number' && f.state !== NA && !f.pending);
  const total = scored.reduce((s, f) => s + f.weight, 0);
  const got = scored.reduce((s, f) => s + f.weight * (f.state === MET ? 1 : Math.max(0, Math.min(1, Number(f.progress) || 0))), 0);
  const score = total ? Math.round((got / total) * 100) : 0;

  const gateOpen = gates.every((g) => g.state === MET || g.state === NA);
  let signal;
  if (!gateOpen) signal = SIGNALS.gate;
  else {
    let k = score >= 80 ? 'ready' : score >= 50 ? 'partial' : 'risk';
    if (warnings.length) k = lower(k);
    signal = SIGNALS[k];
  }

  // 낮추는 요인(부족, 모름, 경고)을 위에, 올리는 요인(충족)을 아래에
  const weightOf = (f) => (f.weight === 'gate' ? 1000 : f.weight === 'warn' ? 500 : f.weight === 'info' ? 0 : f.weight);
  const lowering = factors.filter((f) => f.state === UNMET || f.state === UNKNOWN).sort((a, b) => weightOf(b) - weightOf(a));
  const raising = factors.filter((f) => f.state === MET);
  // 지금 할 일: 사고 직후면 사고 대응 요인 먼저, 그다음 가중치 큰 순서로 3개
  const pri = (f) => (stage.key === 'accident' && f.group === '사고 대응' ? 10000 : 0) + weightOf(f);
  const todo = lowering.filter((f) => f.todo).sort((a, b) => pri(b) - pri(a)).slice(0, 3).map((f) => ({ id: f.id, label: f.todo.label, go: f.todo.go, title: f.title }));

  const activeHouses = (ctx.profile?.houses || []).filter(h => !h.hidden && h.crop);
  const unresolved = activeHouses.filter(h => {
    const actions = records.filter(r => (r.houseIds || []).includes(h.id) && r.task === '하우스 점검' && (String(r.memo || '').includes('피복, 골조 점검, 문제 발견') || String(r.memo || '') === '수리'));
    actions.sort((a,b) => String(b.workDate || '').localeCompare(String(a.workDate || '')) || String(b.createdAt || b.availableAt || '').localeCompare(String(a.createdAt || a.availableAt || '')) || Number(String(b.memo || '').includes('문제 발견')) - Number(String(a.memo || '').includes('문제 발견')));
    return actions.length && String(actions[0].memo || '').includes('문제 발견');
  });
  if (unresolved.length) { const repairTodo = {id:'facility_repair',label:'수리했어요 기록하기',go:'field',title:unresolved.map(h=>h.name).join(', ') + ' 점검 문제'}; if (stage.key === 'accident') todo.push(repairTodo); else todo.unshift(repairTodo); }

  return {
    gate_open: gateOpen,
    score: gateOpen ? score : null,
    signal,
    stage,
    factors,
    lowering,
    raising,
    warnings,
    todo,
    notice: NOTICE,
  };
}

// 점수가 바뀐 이유 한 줄 (3-3 "정식일을 기록해서 +15점")
export function explainChange(prev, cur) {
  if (!prev || prev.score == null || cur.score == null) return '';
  const diff = cur.score - prev.score;
  if (cur.stage?.key === 'accident' && prev.stage?.key !== 'accident') return diff < 0 ? `사고 대응 항목이 새로 생겼어요. 준비도 ${diff}점` : '사고 대응 항목이 새로 생겼어요';
  if (!diff) return '';
  const before = new Map(prev.factors.map((f) => [f.id, f]));
  const credit = f => !f || f.pending || f.state === NA ? 0 : f.state === MET ? 1 : Math.max(0, Math.min(1, Number(f.progress) || 0));
  const turned = cur.factors.filter((f) => typeof f.weight === 'number' && (diff > 0 ? credit(f) > credit(before.get(f.id)) : credit(f) < credit(before.get(f.id))));
  const what = turned.map((f) => f.title).slice(0, 2).join(', ');
  return `${what || '기록이 바뀌어서'} ${diff > 0 ? '+' : ''}${diff}점`;
}

// ---------- 시험 (가상 데이터만) ----------
const P = (ins) => ({
  houses: [{ id: 'h1', name: '1동', crop: '토마토', area_m2: 660, plant_count: 1800 }, { id: 'h3', name: '3동', crop: '딸기', area_m2: 500, plant_count: 4000 }],
  location: '경상남도 가상군 가상면',
  insurance: ins,
});
const INS_OK = { facility_insured: true, crop_insured: true, year: 2026, insured_area_m2: 1150 };
const W = (workDate, houseIds, stage, task, extra = {}) => ({ workDate, houseIds, stage, task, materials: [], ...extra });

export const SCENARIOS = {
  // (가) 가입만 하고 기록 없음
  ga: { profile: P(INS_OK), records: [], today: '2026-11-20', alerts: [] },
  // (나) 정식일과 관리 기록, 점검, 사진
  na: {
    profile: P(INS_OK), today: '2026-11-20', alerts: [],
    records: [
      W('2026-10-01', ['h1'], '육묘와 정식', '정식', { photo_count: 2 }),
      W('2026-10-03', ['h3'], '육묘와 정식', '정식', { materials: [{ kind: '종묘(모종)', action: '구입', type: '모종', name: '가상 설향 모종', qty: '4000', unit: '주' }] }),
      W('2026-09-20', ['h1'], '사전준비', '하우스 점검'),
      W('2026-11-12', ['h1'], '작물관리', '관수와 양액', { photo_count: 1 }),
      W('2026-11-18', ['h3'], '작물관리', '환기와 온도관리', { photo_count: 1 }),
    ],
  },
  // (다) 강풍 사고: 3일 안 접수, 사진, 특보 일치
  da: {
    profile: P(INS_OK), today: '2026-11-20',
    alerts: [{ date: '2026-11-17', kind: '강풍주의보' }],
    records: [
      W('2026-10-01', ['h1'], '육묘와 정식', '정식', { photo_count: 2 }),
      W('2026-10-03', ['h3'], '육묘와 정식', '정식', { materials: [{ kind: '종묘(모종)', action: '구입', type: '모종', name: '가상 설향 모종', qty: '4000', unit: '주' }] }),
      W('2026-09-20', ['h1'], '사전준비', '하우스 점검'),
      W('2026-11-12', ['h1'], '작물관리', '관수와 양액', { photo_count: 1 }),
      W('2026-11-16', ['h3'], '작물관리', '환기와 온도관리', { photo_count: 1 }),
      { type: 'disaster', id: 'd1', workDate: '2026-11-17', accident_date: '2026-11-17', houseIds: ['h3'], crop: '딸기', peril: '강풍', facility_damage: '비닐 찢어짐', crop_symptom: '잎 상함', reported_at: '2026-11-18', photo_count: 4 },
    ],
  },
};

export function runReadinessTests() {
  const cases = [];
  const check = (name, ok, got) => cases.push({ name, pass: !!ok, got: ok ? '' : JSON.stringify(got).slice(0, 300) });
  const st = (r, id) => r.factors.find((f) => f.id === id).state;

  const ga = computeReadiness(SCENARIOS.ga);
  check('(가) 가입만, 기록 없음: 위험', ga.signal.key === 'risk' && ga.score < 50, { s: ga.score, sig: ga.signal.key });
  check('(가) 정식 전이라 관리 요인은 해당 없음', st(ga, 'R-07') === NA && st(ga, 'R-04') === UNMET, ga.factors.map((f) => f.id + f.state));
  check('(가) 할 일 첫째는 정식일 기록', ga.todo[0] && ga.todo[0].id === 'R-04', ga.todo);
  check('(가) 단계 정식 전', ga.stage.key === 'before_planting', ga.stage);

  const na = computeReadiness(SCENARIOS.na);
  check('(나) 정식, 관리, 점검, 사진: 준비됨', na.signal.key === 'ready' && na.score >= 80, { s: na.score, sig: na.signal.key, low: na.lowering.map((f) => f.id) });
  check('(나) 생육 중', na.stage.key === 'growing', na.stage);
  check('(나) 바뀐 이유가 보임', /\+\d+점/.test(explainChange(ga, na)), explainChange(ga, na));

  const da = computeReadiness(SCENARIOS.da);
  check('(다) 사고 대응 요인 충족', ['R-11', 'R-12', 'R-14'].every((id) => st(da, id) === MET) && st(da, 'R-13') === UNKNOWN, da.factors.filter((f) => f.group === '사고 대응').map((f) => f.id + f.state));
  check('(다) 사고 직후 단계', da.stage.key === 'accident', da.stage);
  check('(다) 준비됨', da.signal.key === 'ready', { s: da.score, sig: da.signal.key });

  // 관문
  const noIns = computeReadiness({ ...SCENARIOS.na, profile: P({ facility_insured: false, crop_insured: false }) });
  check('가입 안 했으면 점수 없음, 가입 안내', noIns.signal.key === 'gate' && noIns.score === null && noIns.todo[0].go === 'insurance/guide', noIns.signal);
  const unk = computeReadiness({ ...SCENARIOS.na, profile: P({}) });
  check('가입 여부 모름이면 보험 정보 입력부터', unk.signal.key === 'gate' && unk.todo[0].go === 'insurance', unk.todo);

  // 경고: 병해충 원인, 시설 피해 없음
  const pest = JSON.parse(JSON.stringify(SCENARIOS.da));
  pest.records[5].peril = '잿빛곰팡이';
  const pr = computeReadiness(pest);
  check('병해충 원인은 경고, 신호등 한 단계 낮춤', st(pr, 'R-13') === UNMET && pr.warnings.length === 1 && pr.signal.key === 'partial', { sig: pr.signal.key, w: pr.warnings.map((w) => w.id) });
  const cropOnly = JSON.parse(JSON.stringify(SCENARIOS.da));
  cropOnly.records[5].facility_damage = '시설 피해 없음';
  cropOnly.alerts = [];
  const co = computeReadiness(cropOnly);
  check('작물만 피해와 특보 없음만으로 약관 요건 판정하지 않음', st(co, 'R-15') === UNKNOWN && !co.warnings.some((w) => w.id === 'R-15'), co.warnings.map((w) => w.id));
  cropOnly.alerts = [{ date: '2026-11-16', kind: '한파주의보' }];
  check('작물만 피해와 특보 이력은 조건 확인 필요', st(computeReadiness(cropOnly), 'R-15') === UNKNOWN, 0);

  // 사고 접수 늦음, 사진 없음
  const late = JSON.parse(JSON.stringify(SCENARIOS.da));
  late.records[5].reported_at = '2026-11-25';
  late.records[5].photo_count = 0;
  const lr = computeReadiness(late);
  check('접수 늦음, 사진 없음은 부족', st(lr, 'R-11') === UNMET && st(lr, 'R-12') === UNMET, lr.factors.filter((f) => f.group === '사고 대응'));
  check('사고 직후에는 사고 대응 할 일이 먼저', lr.todo[0] && ['R-11', 'R-12', 'R-13', 'R-14', 'R-15'].includes(lr.todo[0].id), lr.todo);
  const noReport = JSON.parse(JSON.stringify(SCENARIOS.da));
  delete noReport.records[5].reported_at;
  check('접수 안 했으면 접수 할 일', computeReadiness(noReport).todo.some((t) => t.id === 'R-11'), computeReadiness(noReport).todo);

  // 특보 조회 실패는 모름
  const noAlert = JSON.parse(JSON.stringify(SCENARIOS.da));
  noAlert.alerts = null;
  check('특보를 못 불러오면 모름', st(computeReadiness(noAlert), 'R-14') === UNKNOWN, 0);

  // 면적
  const area = JSON.parse(JSON.stringify(SCENARIOS.na));
  area.profile.insurance.insured_area_m2 = 600;
  check('가입 면적 차이 크면 부족', st(computeReadiness(area), 'R-03') === UNMET, 0);
  delete area.profile.houses[0].area_m2;
  check('재배 면적 모르면 모름', st(computeReadiness(area), 'R-03') === UNKNOWN, 0);

  // 병해충 발견 뒤 방제
  const pestSeen = JSON.parse(JSON.stringify(SCENARIOS.na));
  pestSeen.records.push(W('2026-11-10', ['h1'], '작물관리', '관찰', { pest_seen: '잿빛곰팡이병' }));
  check('병해충 보고 방제 없으면 부족', st(computeReadiness(pestSeen), 'R-08') === UNMET, 0);
  pestSeen.records.push(W('2026-11-13', ['h1'], '작물관리', '병해충 방제'));
  check('7일 안 방제하면 충족', st(computeReadiness(pestSeen), 'R-08') === MET, 0);

  // 수확
  const hv = JSON.parse(JSON.stringify(SCENARIOS.na));
  hv.records.push(W('2026-11-19', ['h1'], '수확과 출하', '수확'));
  check('수확만 있고 개시일 없으면 부족', st(computeReadiness(hv), 'R-05') === UNMET && computeReadiness(hv).stage.key === 'harvest', 0);

  // 정식이 한 동만
  const half = JSON.parse(JSON.stringify(SCENARIOS.na));
  half.records = half.records.filter((r) => !(r.task === '정식' && r.houseIds[0] === 'h3'));
  const hr = computeReadiness(half);
  check('한 동 정식일 없으면 그 동 이름을 알려 줌', st(hr, 'R-04') === UNMET && /3동/.test(hr.factors.find((f) => f.id === 'R-04').reason), hr.factors.find((f) => f.id === 'R-04'));

  // 금지 표현 (U-11): 요인 문구와 고지에 지급 보장, 금액 표현 없음
  const allText = [NOTICE, ...[ga, na, da, pr, co, lr].flatMap((r) => r.factors.flatMap((f) => [f.title, f.basis, f.reason, f.todo?.label || '']))].join('\n');
  check('금지 표현 없음', !/보장합니다|받을 수 있습니다|보상됩니다|지급됩니다|확정|\d+\s*원\b|처방|신청 대행/.test(allText.replace('보장을 하지 않습니다', '')), allText.match(/보장합니다|받을 수 있습니다|보상됩니다|지급됩니다|확정|\d+\s*원\b|처방|신청 대행/g));
  check('가운뎃점 없음', !allText.includes('\u00b7'), 0);

  const pass = cases.filter((c) => c.pass).length;
  return { total: cases.length, pass, cases, scores: { ga: ga.score, na: na.score, da: da.score } };
}
