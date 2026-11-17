// 대화 상태 머신 (에이전트 전환 기획서 v1.0 3장 P0, 4장 대화 설계 원칙)
//   idle --발화--> 이해(규칙 or LLM) --기록--> 되묻기(ask, 필수 누락 1개씩) --> 확인 카드(confirm) --[저장]--> saved ("다른 기록 있어요?")
//                                  --목적 외--> 정중한 거절 + 할 수 있는 일 안내 (5회 연속이면 그날 대화 잠금)
//                                  --인식 실패 2회 연속--> 직접 입력 화면으로 넘김 (알아낸 값은 미리 채움)
// 규칙: 한 번에 1개 질문 + 선택지 버튼, 같은 항목은 최대 2번, "모르겠어요"는 건너뛰고 "미완성"으로 저장 허용,
//       작업일은 오늘, 동이 1개면 자동, 추측한 값은 "확인 필요" 표시, 농민이 [저장]을 눌러야만 저장.
// v0.3 (손해평가사 관점 평가 v1): 의도 "재해" -> 재해 초안(draft.type = 'disaster'). 필수 빈칸(사고일, 재해 종류, 피해 동, 시설 피해, 작물 피해)은
//       평가 문서 3장의 질문 문구로 되묻고, 작업 일지와 별도 기록(type: 'disaster')으로 저장. 사진은 안내 문구만.

import { CROPS, STAGES, SEED, MATERIAL_KINDS, PERILS, FACILITY_DAMAGES, CROP_SYMPTOMS, PHOTO_NOTICE, tasksFor, typesFor, unitsFor, defaultUnit } from '../constants.js';
import { todayStr, missingFields, recentNames, autoText, houseNames } from '../records.js';
import { getStore } from '../storage/index.js';
import { getWeather, weatherText, missingWeather } from '../weather.js';
import { extractRules, parseAnswer, parseHouses } from './extract-rules.js';
import { understand } from './llm-adapter.js';
import { preserveDisasterWords, disasterCauseWords } from './disaster-language.js';

export const AGENT_TEXT = {
  hello: '오늘 하신 작업이나 재해 피해를 말이나 글로 남겨 주세요. 영농일지 항목으로 정리해 확인 카드로 보여 드릴게요.',
  disasterStart: `피해 기록으로 정리할게요. ${PHOTO_NOTICE}.`,
  disasterConfirm: '이대로 피해 기록을 저장할까요? 틀린 칸은 눌러서 고칠 수 있어요.',
  refuse: '저는 영농일지 기록과 농사 정보 안내만 도와드려요. 오늘 하신 작업을 말씀해 주시면 바로 기록할게요.',
  weather: (w) => `날씨 질문은 아직 대화로 답하지 못해요. 홈 위 날씨 카드에서 확인해 주세요${w ? ` (오늘 ${w})` : ''}.`,
  greet: '안녕하세요. 오늘 하신 작업을 말씀해 주시면 일지로 정리해 드릴게요.',
  unknown: '잘 못 알아들었어요. "1동 토마토 곁순 제거했어요"처럼 동, 작목, 작업을 말씀해 주세요.',
  retry: '다시 한번 알려 주세요.',
  handoff: (filled) => `잘 못 알아들었어요. 직접 입력 화면으로 열게요.${filled ? ` 말씀하신 ${filled}은(는) 채워 뒀어요.` : ''}`,
  confirm: '이대로 저장할까요? 틀린 칸은 눌러서 고칠 수 있어요.',
  more: '다른 기록 있어요?',
  locked: '오늘 대화는 여기까지예요. 직접 입력으로 계속 기록할 수 있어요.',
  export: '엑셀 화면을 열게요. 기간을 고르고 내려받으면 돼요.',
  list: '일지 목록에서 볼 수 있어요. 대화로 조회하는 기능은 준비 중이에요.',
  cancel: '이번 기록은 저장하지 않았어요. 다른 작업을 말씀해 주세요.',
};

const SKIP = /^(__skip|모르겠|몰라|모름|나중에|건너|패스|없어|글쎄|기억\s*안)/;

const NO = /^(__cancel|아니|취소|그만|됐어|안\s*해)/;
const CAPABILITY_QUICK = [
  { l: '작업 기록 예시', v: '1동 토마토 곁순 제거했어요' },
  { l: '일지 목록', v: '__list' },
  { l: '엑셀 내보내기', v: '__excel' },
];

// 받침에 따라 조사: 방제로 / 웃거름(추비)으로
function ro(word) {
  const s = String(word || '').replace(/[)\s]+$/, '');
  const ch = s.charCodeAt(s.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return word + '로';
  const jong = (ch - 0xac00) % 28;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
}

// 임시: 연도를 말하지 않은 월은 현재 연도로 해석하고 화면에서 확인한다.
export function exportPeriod(text, today) {
  const match = String(text).match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월/);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const year = match[1] ? Number(match[1]) : Number(today.slice(0, 4));
  const month = Number(match[2]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) return null;
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return {period_start:`${prefix}-01`,period_end:`${prefix}-${String(endDay).padStart(2,'0')}`,year_inferred:!match[1]};
}
let seq = 0;
const mid = () => 'm' + (++seq);

export function createAgent(deps) {
  // deps: { getProfile(), getSession(), getRecords(), onUpdate() }
  const st = {
    messages: [],
    phase: 'idle', // idle | ask | confirm | saved | locked
    draft: null,
    askKey: '',
    asked: {},
    skipped: [],
    fails: 0,
    offStreak: 0,
    busy: false,
  };

  const ctx = () => {
    const recs = deps.getRecords() || [];
    return {
      profile: deps.getProfile(),
      today: todayStr(),
      knownNames: [...new Set([...recentNames(recs, '농약'), ...recentNames(recs, '비료')])],
      history: st.messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
    };
  };

  function say(text, extra = {}) {
    const m = { id: mid(), role: 'agent', text, ...extra };
    st.messages.push(m);
    return m;
  }

  // ---------- 초안 ----------
  function newDraft(ext, method) {
    st.asked = {};
    st.skipped = [];
    // 구입만 한 발화의 동은 발화에서 직접 찾은 동만 사용한다(U-03).
    const buyOnly = ext.materials.length > 0 && ext.materials.every(m => m.action === '구입');
    const explicitHouses = buyOnly ? parseHouses(ext.text || '', deps.getProfile()) : ext.houseIds;
    st.draft = {
      type: 'work',
      variety: ext.variety || '',
      plant_count: ext.plant_count || '',
      workDate: ext.workDate,
      houseIds: [...explicitHouses],
      crop: ext.crop,
      stage: ext.stage,
      task: ext.task,
      materials: ext.materials.map((m) => ({ ...m })),
      area: { ...ext.area },
      memo: ext.memo || '',
      weather: null,
      sourceTexts: [ext.text],
      method,
      guessed: [...ext.guessed],
      warnings: [...ext.warnings],
    };
    loadWeather();
  }

  // 재해 초안: 사고일(accident_date)은 말한 날짜만. 없으면 빈칸으로 두고 되묻는다
  function newDisasterDraft(ext, method) {
    st.asked = {};
    st.skipped = [];
    const x = ext.disaster || {};
    st.draft = {
      type: 'disaster',
      accident_date: x.accident_date || '',
      workDate: x.accident_date || '',
      continuing: !!x.continuing,
      houseIds: [...ext.houseIds],
      crop: ext.crop,
      peril: x.peril || '',
      peril_group: x.peril_group || '',
      facility_damage: x.facility_damage || '',
      crop_symptom: x.crop_symptom || '',
      memo: ext.memo || '',
      weather: null,
      sourceTexts: [ext.text],
      method,
      guessed: [...(x.guessed || []), ...ext.guessed.filter((g) => g === 'houseIds')],
      warnings: [],
      materials: [],
    };
    loadWeather();
  }

  async function loadWeather() {
    const d = st.draft;
    if (!d) return;
    const date = d.type === 'disaster' ? d.accident_date : d.workDate;
    if (!date) return;
    const w = await getWeather(date, deps.getProfile());
    if (st.draft === d && d.workDate === date) {
      d.weather = w;
      deps.onUpdate && deps.onUpdate();
    }
  }

  // 비어 있는 칸만 채운다 (되묻기 중 덧붙인 말)
  function mergeEmpty(ext) {
    const d = st.draft;
    let n = 0;
    if (d.type === 'disaster') {
      const x = ext.disaster || {};
      if (!d.houseIds.length && ext.houseIds.length) { d.houseIds = [...ext.houseIds]; if (!d.crop) d.crop = ext.crop; n++; }
      if (!d.accident_date && x.accident_date) { setAccidentDate(x.accident_date); n++; }
      for (const k of ['peril', 'facility_damage', 'crop_symptom']) if (!d[k] && x[k]) { d[k] = x[k]; n++; }
      if (!d.peril_group && x.peril_group) d.peril_group = x.peril_group;
      return n;
    }
    const candidateHouses = d.materials.length && d.materials.every(m => m.action === '구입') ? parseHouses(ext.text || '', deps.getProfile()) : ext.houseIds;
    if (!d.houseIds.length && candidateHouses.length) { d.houseIds = [...candidateHouses]; n++; }
    if (!d.crop && ext.crop) { d.crop = ext.crop; n++; }
    if (!d.stage && ext.stage) { d.stage = ext.stage; d.task = ext.task; n++; }
    ext.materials.forEach((em, i) => {
      const dm = d.materials[i];
      if (!dm) { d.materials.push({ ...em }); n++; return; }
      for (const k of ['kind', 'type', 'name', 'qty', 'unit', 'dilution', 'pest']) if (!dm[k] && em[k]) { dm[k] = em[k]; n++; }
    });
    if (ext.memo && !d.memo.includes(ext.memo)) d.memo = [d.memo, ext.memo].filter(Boolean).join(', ');
    return n;
  }

  // 확인 카드에서 새 문장으로 고칠 때: 말한 값으로 덮어쓴다
  function setAccidentDate(date) {
    const d = st.draft;
    d.accident_date = date;
    d.workDate = date;
    d.weather = null;
    loadWeather();
  }

  function mergeOverride(ext) {
    const d = st.draft;
    let n = 0;
    if (d.type === 'disaster') {
      const x = ext.disaster || {};
      if (x.accident_date && x.accident_date !== d.accident_date) { setAccidentDate(x.accident_date); n++; }
      if (ext.houseIds.length) { d.houseIds = [...ext.houseIds]; if (ext.crop) d.crop = ext.crop; n++; }
      for (const k of ['peril', 'facility_damage', 'crop_symptom']) if (x[k]) { d[k] = x[k]; n++; }
      if (x.peril_group) d.peril_group = x.peril_group;
      return n;
    }
    if (ext.dateSaid && ext.workDate !== d.workDate) { d.workDate = ext.workDate; d.weather = null; loadWeather(); n++; }
    const candidateHouses = d.materials.length && d.materials.every(m => m.action === '구입') ? parseHouses(ext.text || '', deps.getProfile()) : ext.houseIds;
    if (candidateHouses.length) { d.houseIds = [...candidateHouses]; n++; }
    if (ext.crop) { d.crop = ext.crop; n++; }
    if (ext.stage) { d.stage = ext.stage; d.task = ext.task; n++; }
    ext.materials.forEach((em, i) => {
      const dm = d.materials[i];
      if (!dm) { d.materials.push({ ...em }); n++; return; }
      for (const k of ['kind', 'type', 'name', 'qty', 'unit', 'dilution', 'pest']) if (em[k]) { dm[k] = em[k]; n++; }
    });
    return n;
  }

  // ---------- 되묻기 ----------
  function requiredKeys(d) {
    if (d.type === 'disaster') return ['accident_date', 'peril', 'houseIds', 'facility_damage', 'crop_symptom'];
    const keys = ['houseIds', 'crop'];
    d.materials.forEach((m, i) => { if (!['구입', '사용'].includes(m.action)) keys.push(`m${i}.action`); });
    const buyOnly = d.materials.length && d.materials.every((m) => m.action === '구입');
    if (!buyOnly) keys.push('stage'); // 구입만 한 기록은 작업단계를 묻지 않음 (미완성으로 표시)
    d.materials.forEach((m, i) => keys.push(`m${i}.kind`, `m${i}.type`, `m${i}.name`, `m${i}.qty`, `m${i}.unit`));
    return keys;
  }
  function isEmpty(d, key) {
    if (key === 'houseIds') return !d.houseIds.length;
    if (key === 'crop' || key === 'stage') return !d[key];
    if (['accident_date', 'peril', 'facility_damage', 'crop_symptom'].includes(key)) return !d[key];
    const [, i, f] = key.match(/^m(\d+)\.(\w+)$/);
    const m = d.materials[Number(i)];
    if (f === 'action') return !m || !['구입', '사용'].includes(m.action);
    return !m || m[f] === '' || m[f] == null;
  }
  function nextMissing() {
    const d = st.draft;
    // 양을 모르겠다고 건너뛴 자재는 단위를 따로 묻지 않는다(Codex 흰가루병 화면 확인)
    const unitOfSkippedQty = (k) => /^m\d+\.unit$/.test(k) && st.skipped.includes(k.replace('.unit', '.qty'));
    return requiredKeys(d).find((k) => isEmpty(d, k) && !st.skipped.includes(k) && !unitOfSkippedQty(k) && (st.asked[k] || 0) < 2) || '';
  }

  function question(key) {
    const d = st.draft;
    const p = deps.getProfile();
    const skip = { l: '모르겠어요', v: '__skip' };
    const dis = d.type === 'disaster';
    // 재해 카드 되묻기 문구: 손해평가사 관점 평가 v1 3장 그대로
    if (key === 'accident_date') {
      if (d.continuing) return { text: '언제부터였어요? 시작한 날을 알려 주세요. 예: 11월 12일', quick: [{ l: '어제', v: '어제' }, { l: '그제', v: '그제' }, skip] };
      return { text: '피해는 언제 생겼어요?', quick: [{ l: '오늘', v: '오늘' }, { l: '어제', v: '어제' }, { l: '그제', v: '그제' }, { l: '며칠째 계속돼요', v: '며칠째 계속돼요' }, skip] };
    }
    if (key === 'peril') return { text: '어떤 피해예요?', quick: [...['강풍','태풍','돌풍','우박','저온','냉해','한파','서리','호우','폭우','폭설','폭염','고온','새','멧돼지','조수해','화재','기타'].map((x) => ({ l: x, v: x })), skip] };
    // 계약 v1.1 V-7 문구. [없어요]는 '시설 피해 없음'으로 저장
    if (key === 'facility_damage') return { text: '하우스 골조나 비닐도 피해가 있나요?', quick: [...FACILITY_DAMAGES.filter((x) => x !== '시설 피해 없음').map((x) => ({ l: x, v: x })), { l: '없어요', v: '시설 피해 없음' }, skip] };
    if (key === 'crop_symptom') return { text: '작물은 어떻게 됐어요?', quick: [...CROP_SYMPTOMS.map((x) => ({ l: x, v: x })), skip] };
    if (key === 'houseIds' && dis) return { text: '몇 동이 피해를 입었어요?', quick: [...p.houses.map((h) => ({ l: h.name, v: h.name })), skip] };
    if (key === 'houseIds') return { text: '몇 동에서 하셨어요?', quick: [...p.houses.map((h) => ({ l: h.name, v: h.name })), skip] };
    if (key === 'crop') return { text: '어떤 작목이에요?', quick: [...CROPS.map((c) => ({ l: c, v: c })), skip] };
    if (key === 'stage') return { text: '어떤 작업을 하셨어요?', quick: [...STAGES.map((s) => ({ l: s, v: s })), skip] };
    const [, i, f] = key.match(/^m(\d+)\.(\w+)$/);
    const m = d.materials[Number(i)];
    const K = m.kind || '자재';
    const seed = m.kind === SEED;
    if (f === 'kind') return { text: '농약인가요, 비료인가요, 모종인가요?', quick: [...MATERIAL_KINDS.map((x) => ({ l: x, v: x })), skip] };
    if (f === 'action') return { text: '구입하셨어요, 사용하셨어요?', quick: [{ l: '구입', v: '구입' }, { l: '사용', v: '사용' }, skip] };
    if (f === 'type') return { text: `${K} 종류를 골라 주세요.`, quick: [...typesFor(m.kind).map((x) => ({ l: x, v: x })), skip] };
    if (f === 'name') {
      const names = recentNames(deps.getRecords() || [], m.kind).slice(0, 4);
      return { text: seed ? '모종 품종이 뭐예요? 예: 설향' : `${K} 제품명이 뭐예요? 예: OO 수화제`, quick: [...names.map((n) => ({ l: n, v: n })), skip] };
    }
    if (f === 'qty') {
      if (seed) return { text: `모종은 몇 주 ${m.action === '구입' ? '사셨어요' : '쓰셨어요'}? 예: 3000주`, quick: [...['1000주', '3000주', '10판'].map((x) => ({ l: x, v: x })), skip] };
      const ex = m.kind === '비료' ? ['10kg', '1포대', '20L'] : ['100mL', '1L', '1병'];
      return { text: `${K} 양은 얼마나 ${m.action === '구입' ? '사셨어요' : '쓰셨어요'}? 예: 100g, 1L`, quick: [...ex.map((x) => ({ l: x, v: x })), skip] };
    }
    if (f === 'unit') return { text: `단위를 골라 주세요. (${m.qty})`, quick: [...unitsFor(m.kind).map((x) => ({ l: x, v: x })), skip] };
    return { text: AGENT_TEXT.retry, quick: [skip] };
  }

  function ask(key, prefix = '') {
    st.phase = 'ask';
    st.askKey = key;
    st.asked[key] = (st.asked[key] || 0) + 1;
    const q = question(key);
    say(prefix + q.text, { quick: q.quick, ask: key });
  }

  function applyAnswer(key, v) {
    const d = st.draft;
    if (key === 'accident_date') {
      if (v.date) setAccidentDate(v.date);
      else if (v.continuing) { d.continuing = true; if (!/연속 재해/.test(d.memo)) d.memo = [d.memo, '연속 재해(며칠째 계속)'].filter(Boolean).join(', '); }
    } else if (['peril', 'facility_damage', 'crop_symptom'].includes(key)) d[key] = v;
    else if (key === 'houseIds') {
      d.houseIds = v;
      const c = deps.getProfile().houses.find((h) => h.id === v[0])?.crop;
      if (c && !d.crop) d.crop = c;
    } else if (key === 'crop') d.crop = v;
    else if (key === 'stage') { d.stage = v.stage; d.task = v.task || ''; }
    else {
      const [, i, f] = key.match(/^m(\d+)\.(\w+)$/);
      const m = d.materials[Number(i)];
      if (f === 'qty') { m.qty = v.qty; if (v.unit) m.unit = v.unit; }
      else m[f] = v;
    }
    d.guessed = d.guessed.filter((g) => g !== key);
    // 작목이 나중에 정해져 세부작업이 그 작목 목록에 없으면 작업단계만 남김 (예: 딸기에 '유인과 곁순 제거')
    if ((key === 'houseIds' || key === 'crop') && d.task && !(tasksFor(d.crop)[d.stage] || []).includes(d.task)) {
      d.task = '';
      if (!d.guessed.includes('stage')) d.guessed.push('stage');
    }
  }

  // 임시(결정 필요 D-20): 서로 다른 작목을 한 기록에 섞지 않는다.
  function hasMixedCrops(d) {
    const houses = deps.getProfile()?.houses || [];
    const crops = d.houseIds.map(id => houses.find(h => h.id === id)?.crop).filter(Boolean);
    return new Set(crops).size > 1;
  }
  function separateMixedCrops() {
    const d = st.draft;
    if (!d || !hasMixedCrops(d)) return false;
    const warning = '작목이 달라 따로 기록해야 해요. 어느 동부터 할까요?';
    if (!d.warnings.includes(warning)) d.warnings.push(warning);
    d.houseIds = [];
    d.crop = '';
    st.skipped = st.skipped.filter(k => k !== 'houseIds');
    st.asked.houseIds = 0;
    ask('houseIds', warning + ' ');
    return true;
  }
  function proceed() {
    if (separateMixedCrops()) return;
    const k = nextMissing();
    if (k) return ask(k);
    st.phase = 'confirm';
    st.askKey = '';
    const warn = st.draft.warnings.length ? st.draft.warnings.join(', ') + '. ' : '';
    st.messages.forEach((m) => { if (m.card && !m.snap) m.stale = true; });
    say(warn + (st.draft.type === 'disaster' ? AGENT_TEXT.disasterConfirm : AGENT_TEXT.confirm), { card: true });
  }

  // ---------- 바깥으로 넘기기 ----------
  function filledSummary() {
    const d = st.draft;
    if (!d) return '';
    return [houseNames(deps.getProfile(), d.houseIds), d.crop, d.task || d.stage].filter(Boolean).join(', ');
  }
  function toForm(mode) {
    // 재해 초안은 작업 일지 양식으로 넘기지 않는다 (사실과 다른 작업 기록 방지)
    const d = st.draft && st.draft.type !== 'disaster' ? st.draft : null;
    const p = deps.getProfile();
    const first = p?.houses?.[0];
    const base = d || { workDate: todayStr(), houseIds: first && p.houses.length === 1 ? [first.id] : [], crop: '', stage: '', task: '', materials: [], area: { value: '', unit: '㎡' }, memo: '', weather: null, sourceTexts: [], method: '규칙' };
    const texts = d ? d.sourceTexts : st.messages.filter((m) => m.role === 'user').slice(-2).map((m) => m.text);
    return {
      id: null,
      workDate: base.workDate,
      houseIds: [...base.houseIds],
      crop: base.crop,
      cropManual: false,
      weather: base.weather,
      stage: base.stage,
      task: base.task,
      variety: base.variety || '',
      plant_count: base.plant_count || '',
      materials: base.materials.map((m) => ({ ...m, kind: m.kind || '농약', unit: m.unit || defaultUnit(m.kind || '농약') })),
      area: { ...base.area },
      detail: '',
      detailEdited: false,
      memo: base.memo,
      source_text: texts.join(' / '),
      extract_method: base.method || '규칙',
      input_mode: mode,
    };
  }
  function handoff() {
    const form = toForm('chat-handoff');
    say(AGENT_TEXT.handoff(filledSummary()));
    st.phase = 'idle';
    st.draft = null;
    st.fails = 0;
    return { action: 'handoff', form };
  }

  function fail(prefixQuestionKey) {
    st.fails++;
    // 피해 기록은 직접 입력(작업 일지) 화면으로 넘기지 않고, 못 알아들은 칸은 건너뛴다
    if (st.draft?.type === 'disaster') {
      if (prefixQuestionKey && (st.asked[prefixQuestionKey] || 0) < 2) { ask(prefixQuestionKey, AGENT_TEXT.retry + ' '); return null; }
      if (prefixQuestionKey) { st.skipped.push(prefixQuestionKey); proceed(); return null; }
      say(AGENT_TEXT.confirm);
      return null;
    }
    if (st.fails >= 2) return handoff();
    if (prefixQuestionKey) {
      if ((st.asked[prefixQuestionKey] || 0) >= 2) { st.skipped.push(prefixQuestionKey); proceed(); return null; }
      ask(prefixQuestionKey, AGENT_TEXT.retry + ' ');
    } else {
      say(AGENT_TEXT.unknown, { quick: CAPABILITY_QUICK });
    }
    return null;
  }

  function refuse() {
    st.offStreak++;
    if (st.offStreak >= 5) {
      st.phase = 'locked';
      say(AGENT_TEXT.locked, { quick: [{ l: '직접 입력하기', v: '__form' }], kind: 'refuse' });
      return null;
    }
    say(AGENT_TEXT.refuse, { quick: CAPABILITY_QUICK, kind: 'refuse' });
    if (st.phase === 'ask' && st.askKey) {
      const q = question(st.askKey);
      say(q.text, { quick: q.quick, ask: st.askKey });
    }
    return null;
  }

  // ---------- 저장 ----------
  async function saveDisaster() {
    const d = st.draft;
    const p = deps.getProfile();
    const s = deps.getSession();
    const store = await getStore();
    const rec = {
      id: null,
      type: 'disaster',
      accident_date: d.accident_date,
      workDate: d.accident_date || todayStr(), // 목록 정렬용. 사고일을 모르면 작성일로 두고 "미완성"
      continuing: !!d.continuing,
      houseIds: [...d.houseIds],
      crop: d.crop || (p.houses.find((h) => h.id === d.houseIds[0])?.crop || ''),
      peril: d.peril,
      peril_group: d.peril_group || '', // 분류는 통계용. 원인 칸에는 말한 낱말만(V-5)
      facility_damage: d.facility_damage,
      crop_symptom: d.crop_symptom,
      weather: d.weather || (d.accident_date ? await getWeather(d.accident_date, p) : null) || missingWeather('미수집'),
      stage: '',
      task: '',
      materials: [],
      area: { value: '', unit: '㎡' },
      detail: '',
      detailEdited: false,
      memo: d.memo,
      author: p.name,
      authorEmail: s.email,
      location: p.location,
      demo: false,
      source_text: d.sourceTexts.join(' / '),
      answers: (d.answers || []).map((a) => (typeof a === 'string' ? { field: null, label: a, value: a, source: null } : a)), // 계약 v1.1 V-6
      chat_answers: (d.answers || []).map((a) => (typeof a === 'string' ? a : a.label || a.value)).join(' / '),
      extract_method: d.method,
      input_mode: 'chat',
      agent_guessed: [...d.guessed],
    };
    rec.detail = autoText(p, rec);
    rec.missing = missingFields(rec);
    const saved = await store.saveRecord(s.uid, rec);
    const snap = JSON.parse(JSON.stringify(d));
    const lastCard = [...st.messages].reverse().find((m) => m.card && !m.stale);
    if (lastCard) lastCard.snap = snap;
    st.draft = null;
    st.phase = 'saved';
    st.fails = 0;
    const mis = rec.missing.length ? ` 빈칸 ${rec.missing.join(', ')}은(는) "미완성"으로 표시했어요.` : '';
    say(`${houseNames(p, rec.houseIds) || '동 미입력'} ${rec.peril || '재해'} 피해를 피해 기록으로 저장했어요.${mis} ${PHOTO_NOTICE}.`, { savedId: saved.id });
    say(AGENT_TEXT.more, { quick: [{ l: '네, 더 있어요', v: '__more' }, { l: '아니요', v: '__done' }, { l: '일지 목록 보기', v: '__list' }] });
    return { action: 'saved', id: saved.id };
  }

  async function save() {
    const d = st.draft;
    if (separateMixedCrops()) return null;
    if (d.type === 'disaster') return saveDisaster();
    const p = deps.getProfile();
    const s = deps.getSession();
    const store = await getStore();
    const rec = {
      id: null,
      workDate: d.workDate,
      houseIds: [...d.houseIds],
      crop: d.crop,
      cropManual: false,
      weather: d.weather || (await getWeather(d.workDate, p)) || missingWeather('미수집'),
      stage: d.stage,
      task: d.task,
      variety: d.task === '정식' ? String(d.variety || '').trim() : '',
      plant_count: d.task === '정식' ? String(d.plant_count || '').trim() : '',
      materials: d.materials.map((m) => ({ ...m, qty: String(m.qty ?? '').trim() })),
      area: { ...d.area },
      detail: '',
      detailEdited: false,
      memo: d.memo,
      author: p.name,
      authorEmail: s.email,
      location: p.location,
      demo: false,
      source_text: d.sourceTexts.join(' / '),
      answers: (d.answers || []).map((a) => (typeof a === 'string' ? { field: null, label: a, value: a, source: null } : a)), // 계약 v1.1 V-6
      chat_answers: (d.answers || []).map((a) => (typeof a === 'string' ? a : a.label || a.value)).join(' / '),
      extract_method: d.method, // '규칙' | 'AI'
      input_mode: 'chat',
      agent_guessed: [...d.guessed],
    };
    rec.detail = autoText(p, rec);
    rec.missing = missingFields(rec);
    const saved = await store.saveRecord(s.uid, rec);
    const snap = JSON.parse(JSON.stringify(d));
    const lastCard = [...st.messages].reverse().find((m) => m.card && !m.stale);
    if (lastCard) lastCard.snap = snap;
    st.draft = null;
    st.phase = 'saved';
    st.fails = 0;
    const mis = rec.missing.length ? ` 빈칸 ${rec.missing.join(', ')}은(는) "미완성"으로 표시했어요.` : '';
    const what = rec.task || rec.stage || (rec.materials[0] ? `${rec.materials[0].kind} ${rec.materials[0].action}` : '작업');
    say(`${houseNames(p, rec.houseIds) || '동 미입력'} ${rec.crop} ${ro(what)} 저장했어요.${mis}`, { savedId: saved.id });
    say(AGENT_TEXT.more, { quick: [{ l: '네, 더 있어요', v: '__more' }, { l: '아니요', v: '__done' }, { l: '일지 목록 보기', v: '__list' }] });
    return { action: 'saved', id: saved.id };
  }

  // ---------- 한 턴 처리 ----------
  async function send(text, label) {
    const raw = String(text || '').trim();
    if (!raw || st.busy) return null;
    st.messages.push({ id: mid(), role: 'user', text: label || raw });
    st.busy = true;
    try {
      // 버튼은 화면이 표시값(label)을 함께 넘긴다. 글 입력은 label이 없다(계약 v1.1 V-6 답한 방법)
      return await turn(raw, raw === '__save' && label === '저장', label ? 'button' : 'text', label || null);
    } finally {
      st.busy = false;
    }
  }

  // 되묻기 답 기록: { field, label, value, source }. 글 답은 원문(source_text)에도 잇는다(계약 v1 1-4).
  // 버튼 답 글자는 원문에 넣지 않는다(T-8).
  function recordAnswer(field, text, source, label) {
    const d = st.draft;
    (d.answers = d.answers || []).push({ field: field || null, label: label || null, value: text, source });
    if (source === 'text' && d.sourceTexts && !d.sourceTexts.includes(text)) d.sourceTexts.push(text);
  }

  async function turn(raw, saveButton = false, source = 'text', label = null) {
    // 버튼 신호
    if (raw === '__form') return { action: 'handoff', form: toForm('chat-handoff') };
    if (raw === '__list') { say(AGENT_TEXT.list); return { action: 'go', to: 'list' }; }
    if (raw === '__excel') { say(AGENT_TEXT.export); return { action: 'go', to: 'excel' }; }
    if (raw === '__more') { st.phase = 'idle'; say('말씀해 주세요.'); return null; }
    if (raw === '__done') { st.phase = 'idle'; say('알겠어요. 오늘 기록은 일지 탭에서 볼 수 있어요.'); return null; }
    if (st.phase === 'locked') { say(AGENT_TEXT.locked, { quick: [{ l: '직접 입력하기', v: '__form' }] }); return null; }

    const c = ctx();
    const text = raw.slice(0, 500);

    if (st.phase === 'confirm' && st.draft) {
      if (saveButton) return save();
      if (NO.test(text)) { st.draft = null; st.phase = 'idle'; say(AGENT_TEXT.cancel); return null; }
      const ext = extractRules(text, c);
      if (ext.intent === 'offtopic') return refuse();
      // 확인 카드가 떠 있는데 완전히 다른 기록(재해 또는 다른 작업)을 말하면 고치기로 섞지 않고 새 초안으로 (원문, 세부내용 오기입 방지)
      const d0 = st.draft;
      const isNew = ext.intent === 'disaster'
        ? d0.type !== 'disaster'
        : ext.intent === 'record' && !!ext.task && (ext.houseIds.length > 0 || !!ext.crop) && (d0.type === 'disaster' || ext.task !== d0.task);
      if (isNew) {
        say('앞의 초안은 저장하지 않고 새 기록으로 정리할게요.');
        st.messages.forEach((m) => { if (m.card && !m.snap) m.stale = true; });
        st.fails = 0;
        if (ext.intent === 'disaster') { newDisasterDraft(ext, '규칙'); say(AGENT_TEXT.disasterStart); } else newDraft(ext, '규칙');
        proceed();
        return null;
      }
      if (mergeOverride(ext)) {
        recordAnswer(null, text, source, label); // 확인 카드에서 고친 말
        st.fails = 0;
        proceed();
        return null;
      }
      return fail();
    }

    if (st.phase === 'ask' && st.draft) {
      const key = st.askKey;
      if (SKIP.test(text)) { st.skipped.push(key); st.fails = 0; proceed(); return null; }
      const ext = extractRules(text, c);
      if (ext.intent === 'offtopic') return refuse();
      st.offStreak = 0;
      const actionAnswer = /^m\d+\.action$/.test(key) ? (/^(구입|샀|사왔)/.test(text) ? '구입' : /^(사용|썼|뿌렸)/.test(text) ? '사용' : '') : null;
      const perilWords = key === 'peril' ? disasterCauseWords(text) : null;
      const a = perilWords !== null ? (perilWords.length ? { ok: true, value: [...new Set(perilWords)].join(', ') } : text.trim() === '기타' ? { ok: true, value: '기타' } : { ok: false }) : actionAnswer === null ? parseAnswer(key, text, c, st.draft) : actionAnswer ? { ok: true, value: actionAnswer } : { ok: false };
      let got = 0;
      if (a.ok) { applyAnswer(key, a.value); got++; }
      got += mergeEmpty(ext);
      if (got) {
        recordAnswer(key, text, source, label);
        st.fails = 0;
        proceed();
        return null;
      }
      return fail(key);
    }

    // idle / saved: 새 발화
    const understood = await understand(text, c);
    const corrected = preserveDisasterWords(text, understood.ext);
    const u = corrected === understood.ext ? understood : { ...understood, intent: corrected.intent, ext: corrected };
    if (u.intent === 'offtopic') return refuse();
    st.offStreak = 0;
    if (u.intent === 'weather') {
      const w = await getWeather(todayStr(), c.profile);
      say(AGENT_TEXT.weather(weatherText(w) !== '미수집' ? weatherText(w) : ''), { quick: CAPABILITY_QUICK, kind: 'refuse' });
      return null;
    }
    if (u.intent === 'export') { say(AGENT_TEXT.export); const period = exportPeriod(text, c.today); return { action: 'go', to: 'excel', ...(period || {}) }; }
    if (u.intent === 'list') { say(AGENT_TEXT.list, { quick: [{ l: '일지 목록 보기', v: '__list' }] }); return null; }
    if (u.intent === 'greet') { say(AGENT_TEXT.greet, { quick: CAPABILITY_QUICK }); return null; }
    if (u.intent === 'disaster') {
      st.fails = 0;
      newDisasterDraft(u.ext, u.method);
      say(AGENT_TEXT.disasterStart);
      proceed();
      return null;
    }
    if (u.intent !== 'record') return fail();
    // 앞선 기록을 가리키는 모호한 발화는 제품, 동을 지어내지 않고 다시 받는다.
    const e = u.ext;
    const vagueReference = /그\s*(약|거)|저번처럼|전에\s*쓰던/.test(text);
    const concrete = e.houseIds.length || e.crop || e.pest || e.materials.some(m => m.name || m.qty || m.dilution);
    if (vagueReference && !concrete) return fail();
    st.fails = 0;
    newDraft(u.ext, u.method);
    if (u.fallback === 'limit') say('오늘 AI 대화 한도를 다 써서 규칙으로 정리했어요.');
    proceed();
    return null;
  }

  // ---------- 확인 카드에서 칸 고치기 ----------
  // raw = 입력칸에서 직접 친 값 (토글하지 않음)
  function setField(key, value, raw = false) {
    const d = st.draft;
    if (!d) return;
    const multi = (cur, v, list) => {
      let a = String(cur || '').split(', ').filter(Boolean);
      a = a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
      if (v === '시설 피해 없음' && a.includes(v)) a = [v];
      else if (v !== '시설 피해 없음') a = a.filter((x) => x !== '시설 피해 없음');
      return list.filter((x) => a.includes(x)).concat(a.filter((x) => !list.includes(x))).join(', ');
    };
    if (d.type === 'disaster' && key === 'workDate') {
      setAccidentDate(value || '');
      key = 'accident_date';
    } else if (d.type === 'disaster' && ['peril', 'facility_damage', 'crop_symptom'].includes(key)) {
      d[key] = raw ? value : multi(d[key], value, key === 'peril' ? PERILS : key === 'facility_damage' ? FACILITY_DAMAGES : CROP_SYMPTOMS);
    } else if (key === 'variety' || key === 'plant_count') {
      d[key] = value;
    } else if (key === 'workDate') {
      d.workDate = value || todayStr();
      d.weather = null;
      loadWeather();
    } else if (key === 'house') {
      d.houseIds = d.houseIds.includes(value) ? d.houseIds.filter((x) => x !== value) : [...d.houseIds, value];
      const c = deps.getProfile().houses.find((h) => h.id === d.houseIds[0])?.crop;
      if (c && !d.guessed.includes('crop')) d.crop = c;
      key = 'houseIds';
    } else if (key === 'crop') {
      d.crop = value;
      if (!(tasksFor(value)[d.stage] || []).includes(d.task)) d.task = '';
    } else if (key === 'stage') {
      d.stage = value;
      const T = tasksFor(d.crop)[value] || [];
      if (!T.includes(d.task)) d.task = T.length === 1 ? T[0] : '';
    } else if (key === 'task') {
      d.task = d.task === value ? '' : value;
      key = 'stage';
    } else if (key === 'memo') {
      d.memo = value;
    } else if (key === 'addMat') {
      d.materials.push({ kind: '농약', action: '사용', type: '', name: '', qty: '', unit: 'mL', dilution: '', pest: '' });
    } else {
      const mm = key.match(/^m(\d+)\.(\w+)$/);
      if (!mm) return;
      const i = Number(mm[1]);
      const f = mm[2];
      const m = d.materials[i];
      if (!m) return;
      if (f === 'remove') { d.materials.splice(i, 1); return; }
      if (f === 'kind' && m.kind !== value) { m.kind = value; m.type = ''; m.unit = defaultUnit(value); if (value !== '농약') { m.pest = ''; m.dilution = ''; } }
      else if (!raw && (f === 'dilution' || f === 'pest')) m[f] = m[f] === value ? '' : value;
      else m[f] = value;
    }
    d.guessed = d.guessed.filter((g) => g !== key);
    if (key === 'crop') d.warnings = [];
  }

  function start() {
    if (!st.messages.length) say(AGENT_TEXT.hello);
  }

  function reset() {
    st.messages = [];
    st.phase = 'idle';
    st.draft = null;
    st.fails = 0;
    st.offStreak = 0;
    start();
  }

  return { state: st, send, setField, save: () => (st.draft ? save() : null), start, reset, toForm: () => toForm('chat-handoff') };
}
