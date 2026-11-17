// 계약 v1 + v1.1 경계 (나): 화면 상태(camelCase) <-> 저장 문서(snake_case, DB-05)
// 필드 이름을 바꾸는 곳은 이 파일 하나다(계약 C-3). 계산은 하지 않는다(U-02): 말한 값만 옮긴다.
// DOM이 없는 순수 함수라 Node에서 시험할 수 있다.

import { missingFields, isDisaster } from './records.js';
import { renameLegacy } from './constants.js';

// 예전 기록의 가운뎃점 값(작업 단계, 세부 작업, 자재 종류, 재해 항목)을 새 이름으로(D2-09)
const RENAME_KEYS = ['stage', 'task', 'peril', 'peril_group', 'facility_damage', 'crop_symptom', 'detail', 'memo'];
export function renameRecord(st) {
  if (!st) return st;
  const out = { ...st };
  for (const k of RENAME_KEYS) if (k in out) out[k] = Array.isArray(out[k]) ? out[k].map(renameLegacy) : renameLegacy(out[k]);
  if (Array.isArray(out.materials)) out.materials = out.materials.map((m) => (m ? { ...m, type: renameLegacy(m.type) } : m));
  return out;
}

export const SCHEMA_VERSION = 1;

// 처음 저장 때만 쓰고 수정 때는 기존 값을 그대로 둔다(계약 C-7, 2-2 "못 바꿈")
export const IMMUTABLE = ['record_id', 'schema_version', 'type', 'source_text', 'answers', 'extract_method', 'model_id', 'input_mode', 'conversation_id', 'created_at', 'author_uid', 'author_role', 'author_name', 'is_demo'];

const EXTRACT = { AI: 'ai', ai: 'ai', 규칙: 'rule', rule: 'rule', manual: 'manual', 직접: 'manual' };
// 화면(목록, 엑셀)은 아직 옛 표시 값을 쓴다. 읽을 때 되돌린다.
const EXTRACT_VIEW = { ai: 'AI', rule: '규칙', manual: '' };
const INPUT_MODE = { select: 'select', text: 'text', field: 'field', chat: 'chat', form: 'form', chat_handoff: 'chat_handoff', 'chat-handoff': 'chat_handoff' };
const INPUT_MODE_VIEW = { select: 'select', text: 'text', field: 'field', chat: 'chat', form: '', chat_handoff: 'chat-handoff' };

// 답 목록: 계약 모양 배열, 글 배열, 또는 옛 코드의 " / "로 잇은 글을 모두 받는다.
// 답한 방법을 모르는 옛 답은 source: null (추측하지 않음)
export function normAnswers(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : String(v).split(' / ').filter((s) => s.trim());
  return arr.map((a) => (typeof a === 'object' && a !== null
    ? { field: a.field ?? null, label: a.label ?? null, value: a.value ?? null, source: a.source ?? null }
    : { field: null, label: String(a), value: String(a), source: null }));
}

// 한국 날짜 (계약 C-9)
export function kstDate(iso) {
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return k.toISOString().slice(0, 10);
}

// 글 숫자 -> 숫자 또는 null. 빈칸은 0이 아니라 null(계약 C-4)
export function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function numText(v) {
  return v === null || v === undefined ? '' : String(v);
}

const TYPE_KEY = { 농약: 'pesticide_type', 비료: 'fertilizer_type' };
function typeKeyOf(kind) {
  if (TYPE_KEY[kind]) return TYPE_KEY[kind];
  if (/종묘|모종/.test(kind || '')) return 'seed_type';
  return 'pesticide_type';
}

export function materialToDoc(m) {
  const out = {
    kind: m.kind || '',
    action: m.action || '',
    pesticide_type: '',
    fertilizer_type: '',
    seed_type: '',
    product_name: m.name || '',
    qty: toNum(m.qty),
    unit: m.unit || '',
    pack_count: toNum(m.pack_count ?? m.packCount),
    pack_unit: m.pack_unit ?? m.packUnit ?? '',
    dilution: toNum(m.dilution),
    water_l: toNum(m.water_l ?? m.waterL),
    target_pest: m.pest || '',
  };
  out[typeKeyOf(m.kind)] = m.type || '';
  return out;
}

export function materialFromDoc(d) {
  if (!d) return null;
  // 옛 모양(화면 상태)이면 그대로
  if ('name' in d || 'pest' in d) return { ...d };
  const type = d.pesticide_type || d.fertilizer_type || d.seed_type || '';
  const m = { kind: d.kind || '', action: d.action || '', type, name: d.product_name || '', qty: numText(d.qty), unit: d.unit || '', dilution: numText(d.dilution), pest: d.target_pest || '' };
  if (d.pack_count != null) m.pack_count = numText(d.pack_count);
  if (d.pack_unit) m.pack_unit = d.pack_unit;
  if (d.water_l != null) m.water_l = numText(d.water_l);
  return m;
}

function weatherToDoc(w) {
  if (!w) return null;
  const out = { ...w };
  if ('tmin' in w) { out.temp_min = toNum(w.tmin); delete out.tmin; }
  if ('tmax' in w) { out.temp_max = toNum(w.tmax); delete out.tmax; }
  if ('rain' in w) { out.rain_mm = toNum(w.rain); delete out.rain; }
  return out;
}

function weatherFromDoc(w) {
  if (!w) return null;
  const out = { ...w };
  if ('temp_min' in w) { out.tmin = w.temp_min; delete out.temp_min; }
  if ('temp_max' in w) { out.tmax = w.temp_max; delete out.temp_max; }
  if ('rain_mm' in w) { out.rain = w.rain_mm; delete out.rain_mm; }
  return out;
}

// 확인 필요 경로: 에이전트 키('m0.type', 'houseIds')를 저장 문서 경로('materials[0].pesticide_type', 'plots')로
// (Codex 재검증 c7a7557: 변환 없이 저장돼 실제 필드와 맞지 않았음)
const TOP_PATH = { houseIds: 'plots', house_ids: 'plots', workDate: 'work_date', cropManual: 'crop_manual', area: 'area_value', detailEdited: 'detail_edited' };
const MAT_PATH = { name: 'product_name', pest: 'target_pest' };
export function toDocPath(key, materials = []) {
  const m = /^m(\d+)\.(\w+)$/.exec(key) || /^materials\[(\d+)\]\.(\w+)$/.exec(key);
  if (m) {
    const i = Number(m[1]);
    let f = m[2];
    if (f === 'type') f = typeKeyOf(materials[i]?.kind);
    else f = MAT_PATH[f] || f;
    return `materials[${i}].${f}`;
  }
  return TOP_PATH[key] || key;
}
const TOP_VIEW = { plots: 'houseIds', work_date: 'workDate' };
export function toViewKey(p) {
  const m = /^materials\[(\d+)\]\.(\w+)$/.exec(p);
  if (m) {
    const f = { pesticide_type: 'type', fertilizer_type: 'type', seed_type: 'type', product_name: 'name', target_pest: 'pest' }[m[2]] || m[2];
    return `m${m[1]}.${f}`;
  }
  return TOP_VIEW[p] || p;
}

// 바뀐 칸을 칸 단위 경로로 (자재는 materials[i].필드). 자재 하나만 고쳐도 다른 칸 표시는 남는다(V-2)
const SKIP_DIFF = ['updated_at', 'edited_fields', 'needs_confirm', 'missing_fields', 'status', 'is_backfill', 'ask_count', 'plots'];
export function changedPaths(oldDoc, newDoc) {
  const out = [];
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const k of new Set([...Object.keys(oldDoc || {}), ...Object.keys(newDoc || {})])) {
    if (IMMUTABLE.includes(k) || SKIP_DIFF.includes(k)) continue;
    if (k === 'materials') {
      const a = oldDoc.materials || [];
      const b = newDoc.materials || [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (!a[i] || !b[i]) { out.push(`materials[${i}]`); continue; }
        for (const f of new Set([...Object.keys(a[i]), ...Object.keys(b[i])])) if (!same(a[i][f], b[i][f])) out.push(`materials[${i}].${f}`);
      }
      continue;
    }
    if (k === 'house_ids') { if (!same(oldDoc.house_ids, newDoc.house_ids)) out.push('plots'); continue; }
    if (!same(oldDoc[k], newDoc[k])) out.push(k);
  }
  return out;
}

export function plotsOf(profile, ids) {
  const hs = profile?.houses || [];
  return (ids || []).map((id) => hs.find((h) => h.id === id)).filter(Boolean).map((h) => ({ house_id: h.id, name: h.name, lot: h.lot || '' }));
}

// 작목이 다른 동을 한 기록에 넣었는지 (계약 C-6, S-7)
export function mixedCrops(profile, ids) {
  const hs = profile?.houses || [];
  const crops = new Set((ids || []).map((id) => hs.find((h) => h.id === id)?.crop).filter(Boolean));
  return crops.size > 1;
}

// 화면 상태 + 대화 정보 -> 저장 문서 (새로 저장할 때)
// ctx: { profile, now, uid, role, authorName, isDemo, conversationId, inputMode, extractMethod, modelId,
//        sourceText, answers, needsConfirm, editedFields, askCount }
export function toRecordDoc(state, ctx = {}) {
  const now = ctx.now || new Date().toISOString();
  const disaster = isDisaster(state);
  const ids = state.houseIds || state.house_ids || [];
  const doc = {
    record_id: state.id || ctx.recordId || null,
    schema_version: SCHEMA_VERSION,
    type: disaster ? 'disaster' : 'work',
    work_date: state.workDate || '',
    house_ids: [...ids],
    plots: plotsOf(ctx.profile, ids),
    crop: state.crop || '',
    crop_manual: !!state.cropManual,
    stage: state.stage || '',
    task: state.task || '',
    materials: (state.materials || []).map(materialToDoc),
    area_value: toNum(state.area?.value),
    area_unit: state.area?.unit || '',
    weather: weatherToDoc(state.weather),
    detail: state.detail || '',
    detail_edited: !!state.detailEdited,
    memo: state.memo || '',
    source_text: ctx.sourceText ?? state.source_text ?? '',
    term_id: state.term_id || '',
    term_confirmed: state.term_confirmed === true,
    answers: normAnswers(ctx.answers ?? state.answers ?? state.chat_answers).map((a) => ({ ...a, field: a.field ? toDocPath(a.field, state.materials) : null })),
    extract_method: EXTRACT[ctx.extractMethod ?? state.extract_method] || 'manual',
    input_mode: INPUT_MODE[ctx.inputMode ?? state.input_mode] || (ctx.conversationId ? 'chat' : 'form'),
    model_id: ctx.modelId || state.model_id || '',
    conversation_id: ctx.conversationId || state.conversation_id || '',
    edited_fields: [...(ctx.editedFields || [])],
    // v1.1 V-2: 고친 칸만 빼고 남긴다. 고치지 않고 저장해도 "확인 필요"는 남는다. 경로는 저장 문서 기준으로 통일
    needs_confirm: [...new Set((ctx.needsConfirm ?? state.agent_guessed ?? []).map((k) => toDocPath(k, state.materials)))].filter((p) => !(ctx.editedFields || []).map((k) => toDocPath(k, state.materials)).includes(p)),
    ask_count: { ...(ctx.askCount || {}) },
    author_uid: ctx.uid || '',
    author_role: ctx.role || 'owner',
    author_name: ctx.authorName ?? state.author ?? '',
    is_demo: !!(ctx.isDemo ?? state.demo),
    created_at: state.createdAt || now,
    updated_at: null,
  };
  // 프로필에 없는 동 ID는 사본을 못 만든다. 확인 필요로 두고 미완성 판정은 missingFields가 한다(C-5)
  if (ctx.profile && doc.house_ids.length !== doc.plots.length && !doc.needs_confirm.includes('plots')) doc.needs_confirm.push('plots');
  if (state.variety) doc.variety = state.variety;
  // 준비도 요인용 필드(기획안 v02 4장). 사진은 MVP에서 개수만(원본은 기기에, D2-06)
  if (state.photo_count != null && state.photo_count !== '') doc.photo_count = toNum(state.photo_count);
  if (state.pest_seen) doc.pest_seen = String(state.pest_seen);
  if (state.control_target) doc.control_target = String(state.control_target);
  if (state.plant_count != null && state.plant_count !== '') doc.plant_count = toNum(state.plant_count);
  if (disaster) {
    doc.accident_date = state.accident_date || '';
    doc.continuing = !!state.continuing;
    doc.cause_text = state.cause_text || '';
    doc.mitigation_note = state.mitigation_note || '';
    doc.checklist = Object.fromEntries(['photo','reported','damage','alerts','mitigation'].map(k => [k, state.checklist?.[k] === true]));
    doc.peril = state.peril || '';
    if (state.peril_group) doc.peril_group = state.peril_group;
    doc.facility_damage = state.facility_damage || '';
    doc.crop_symptom = state.crop_symptom || '';
    doc.reported_at = state.reported_at || ''; // 가입한 농축협에 사고를 알린 날(R-11)
    doc.alert_match = state.alert_match === true ? true : state.alert_match === false ? false : null; // 특보 이력 일치(R-14), 모르면 null
    if (doc.is_demo && state.alert_check?.source === 'demo') doc.alert_check = JSON.parse(JSON.stringify(state.alert_check));
    doc.closed = !!state.closed; // 사고 처리가 끝났음(단계 판정)
    if (!doc.work_date) doc.work_date = doc.accident_date || kstDate(now);
  }
  finishDoc(doc, ctx.profile, now);
  return doc;
}

// 상태와 미완성 판정은 공용 판정(records.js missingFields) 하나로 (계약 2-1의 5번)
function finishDoc(doc, profile, now) {
  const st = fromRecordDoc(doc);
  doc.missing_fields = missingFields(st, profile);
  doc.status = doc.missing_fields.length ? 'incomplete' : 'complete';
  const base = kstDate(doc.created_at || now);
  doc.is_backfill = !!doc.work_date && doc.work_date < base;
}

// 저장 문서(새 모양) 또는 옛 기록(화면 상태 모양) -> 화면 상태
export function fromRecordDoc(doc) {
  if (!doc) return null;
  if (!('work_date' in doc) && ('workDate' in doc || 'houseIds' in doc)) return renameRecord({ ...doc }); // 옛 모양
  const st = {
    id: doc.record_id ?? null,
    type: doc.type === 'disaster' ? 'disaster' : undefined,
    workDate: doc.work_date || '',
    houseIds: [...(doc.house_ids || [])],
    crop: doc.crop || '',
    cropManual: !!doc.crop_manual,
    weather: weatherFromDoc(doc.weather),
    stage: doc.stage || '',
    task: doc.task || '',
    materials: (doc.materials || []).map(materialFromDoc),
    area: { value: numText(doc.area_value), unit: doc.area_unit || '㎡' },
    detail: doc.detail || '',
    detailEdited: !!doc.detail_edited,
    memo: doc.memo || '',
    source_text: doc.source_text || '',
    term_id: doc.term_id || '',
    term_confirmed: doc.term_confirmed === true,
    // 화면은 답을 글로 보여 준다. 구조는 answers에 그대로 두고 표시용 글만 만든다
    chat_answers: normAnswers(doc.answers).map((a) => a.label ?? a.value).filter(Boolean).join(' / '),
    answers: normAnswers(doc.answers),
    agent_guessed: (doc.needs_confirm || []).map(toViewKey),
    extract_method: EXTRACT_VIEW[doc.extract_method] ?? '',
    input_mode: INPUT_MODE_VIEW[doc.input_mode] ?? '',
    conversation_id: doc.conversation_id || '',
    model_id: doc.model_id || '',
    author: doc.author_name || '',
    demo: !!doc.is_demo,
    createdAt: doc.created_at || null,
    updatedAt: doc.updated_at || null,
  };
  if (!st.type) delete st.type;
  if (doc.variety) st.variety = doc.variety;
  if (doc.photo_count != null) st.photo_count = doc.photo_count;
  if (doc.pest_seen) st.pest_seen = doc.pest_seen;
  if (doc.control_target) st.control_target = doc.control_target;
  if (doc.plant_count != null) st.plant_count = doc.plant_count;
  if (doc.type === 'disaster') {
    st.accident_date = doc.accident_date || '';
    st.continuing = !!doc.continuing;
    st.cause_text = doc.cause_text || '';
    st.mitigation_note = doc.mitigation_note || '';
    st.checklist = Object.fromEntries(['photo','reported','damage','alerts','mitigation'].map(k => [k, doc.checklist?.[k] === true]));
    st.peril = doc.peril || '';
    if (doc.peril_group) st.peril_group = doc.peril_group;
    st.facility_damage = doc.facility_damage || '';
    st.crop_symptom = doc.crop_symptom || '';
    st.reported_at = doc.reported_at || '';
    if (doc.alert_match != null) st.alert_match = doc.alert_match;
    if (doc.is_demo && doc.alert_check?.source === 'demo') st.alert_check = JSON.parse(JSON.stringify(doc.alert_check));
    st.closed = !!doc.closed;
  }
  return renameRecord(st);
}

// 수정: 바꾸면 안 되는 값은 옛 문서 값을 지키고, 바뀐 칸을 edited_fields에 더한다
export function mergeForUpdate(oldDoc, editedState, ctx = {}) {
  const now = ctx.now || new Date().toISOString();
  const fresh = toRecordDoc({ ...editedState, createdAt: oldDoc.created_at }, { ...ctx, now, needsConfirm: [] });
  const out = { ...fresh };
  for (const k of IMMUTABLE) if (k in oldDoc) out[k] = oldDoc[k];
  const changed = changedPaths(oldDoc, fresh);
  // 카드의 [맞아요]처럼 값은 그대로 두고 확인만 한 칸 (V-2)
  const confirmed = (ctx.confirmedFields || []).map((k) => toDocPath(k, fresh.materials));
  out.edited_fields = [...new Set([...(oldDoc.edited_fields || []), ...changed])];
  // 정확히 그 칸이 바뀐 경우만 뺀다. 자재가 통째로 바뀌거나 빠지면(materials[i]) 그 자재의 표시만 뺀다
  const hit = (p, c) => p === c || p.startsWith(c + '.') || p.startsWith(c + '[');
  out.needs_confirm = (oldDoc.needs_confirm || []).filter((p) => !changed.some((c) => hit(p, c)) && !confirmed.includes(p));
  if (out.house_ids.length !== out.plots.length && !out.needs_confirm.includes('plots')) out.needs_confirm.push('plots');
  out.ask_count = { ...(oldDoc.ask_count || {}) };
  out.updated_at = now;
  finishDoc(out, ctx.profile, now);
  const materialsEdited = changed.some(c => c === 'materials' || c.startsWith('materials['));
  const completeMaterials = (editedState.materials || []).length > 0 && editedState.materials.every(m => m.kind && ['구입','사용'].includes(m.action) && m.type && m.name && m.qty !== '' && m.qty != null && m.unit);
  if (materialsEdited && completeMaterials) out.needs_confirm = out.needs_confirm.filter(p => p !== 'materials');
  out.created_at = oldDoc.created_at;
  return out;
}

// ---------- 시험 (가상 데이터만) ----------
const T_PROFILE = { houses: [{ id: 'h1', name: '1동', crop: '토마토', lot: '가상리 1' }, { id: 'h2', name: '2동', crop: '방울토마토', lot: '가상리 2' }, { id: 'h3', name: '3동', crop: '딸기', lot: '' }] };

export function runContractTests() {
  const cases = [];
  const check = (name, ok, got) => cases.push({ name, pass: !!ok, got: ok ? '' : JSON.stringify(got).slice(0, 200) });
  const now = '2026-11-16T05:00:00.000Z'; // 한국 14시
  const st = { id: 'r1', workDate: '2026-11-15', houseIds: ['h1'], crop: '토마토', stage: '작물관리', task: '병해충 방제', materials: [{ kind: '농약', action: '사용', type: '살균제', name: '가상곰팡이 수화제', qty: '', unit: '', dilution: '1000', pest: '잿빛곰팡이병' }], area: { value: '', unit: '동 전체' }, weather: { sky: '맑음', tmin: '3', tmax: '15', rain: '0', source: 'kma' }, memo: '4L(물 양인지 약 양인지 확인 필요)' };
  const ctx = { profile: T_PROFILE, now, uid: 'u-demo', authorName: '가상 농민', isDemo: true, conversationId: 'c1', extractMethod: '규칙', sourceText: '1동 토마토 잿빛곰팡이 가상곰팡이 수화제 4리터로 1000배 방제', answers: [{ field: 'plots', label: '1동', value: '1동', source: 'button' }], needsConfirm: ['materials[0].pesticide_type', 'crop'], editedFields: ['crop'] };
  const d = toRecordDoc(st, ctx);
  check('빈 사용량은 0이 아니라 null', d.materials[0].qty === null, d.materials[0].qty);
  check('배수는 말한 숫자 그대로', d.materials[0].dilution === 1000, d.materials[0].dilution);
  check('농약 종류는 pesticide_type', d.materials[0].pesticide_type === '살균제' && d.materials[0].fertilizer_type === '', d.materials[0]);
  check('동 사본', JSON.stringify(d.plots) === JSON.stringify([{ house_id: 'h1', name: '1동', lot: '가상리 1' }]), d.plots);
  check('추출 방식 규칙 -> rule', d.extract_method === 'rule', d.extract_method);
  check('대화 저장은 input_mode chat', d.input_mode === 'chat', d.input_mode);
  check('고친 칸만 확인 필요에서 빠짐(V-2)', JSON.stringify(d.needs_confirm) === JSON.stringify(['materials[0].pesticide_type']), d.needs_confirm);
  check('답한 방법 source 유지(V-6)', d.answers[0].source === 'button', d.answers);
  check('날씨 이름 U-07', d.weather.temp_min === 3 && d.weather.rain_mm === 0 && !('tmin' in d.weather), d.weather);
  check('사용량 비면 미완성', d.status === 'incomplete' && d.missing_fields.includes('농약 양'), d.missing_fields);
  check('사후 입력 판정(한국 날짜)', d.is_backfill === true, d.is_backfill);
  check('계산 값 없음: 메모 그대로', d.memo === st.memo, d.memo);
  const back = fromRecordDoc(d);
  check('되돌리면 화면 값 같음', back.workDate === st.workDate && back.materials[0].name === '가상곰팡이 수화제' && back.materials[0].qty === '' && back.materials[0].dilution === '1000' && back.weather.tmin === 3, back);
  const old = { id: 'o1', workDate: '2026-11-10', houseIds: ['h3'], crop: '딸기', stage: '작물관리', task: '수확', materials: [], area: { value: '', unit: '㎡' } };
  check('옛 모양은 그대로 읽음', fromRecordDoc(old).workDate === '2026-11-10', fromRecordDoc(old));
  const later = '2026-11-17T01:00:00.000Z';
  const upd = mergeForUpdate(d, { ...back, materials: [{ ...back.materials[0], qty: '200', unit: 'mL' }], source_text: '바꿔치기 시도' }, { profile: T_PROFILE, now: later, conversationId: 'c2', extractMethod: 'manual' });
  check('수정해도 원문 못 바꿈', upd.source_text === d.source_text && upd.conversation_id === 'c1' && upd.extract_method === 'rule' && upd.created_at === d.created_at, upd);
  check('수정 칸 기록(칸 단위)', upd.edited_fields.includes('materials[0].qty') && upd.updated_at === later, upd.edited_fields);
  // 11/16 변경(Codex 재검증): 사용량만 고쳤으면 추측한 농약 종류 표시는 남아야 한다
  check('사용량만 고치면 종류 확인 필요 유지', upd.needs_confirm.includes('materials[0].pesticide_type') && upd.edited_fields.includes('materials[0].qty'), upd);
  const upd2 = mergeForUpdate(upd, { ...fromRecordDoc(upd), materials: [{ ...fromRecordDoc(upd).materials[0], type: '살충제' }] }, { profile: T_PROFILE, now: later });
  check('종류를 고치면 그 표시만 빠짐', !upd2.needs_confirm.includes('materials[0].pesticide_type'), upd2.needs_confirm);
  const upd3 = mergeForUpdate(upd, fromRecordDoc(upd), { profile: T_PROFILE, now: later, confirmedFields: ['m0.type'] });
  check('[맞아요]로 확인하면 빠짐(값은 그대로)', !upd3.needs_confirm.includes('materials[0].pesticide_type') && upd3.materials[0].pesticide_type === '살균제', upd3);
  const two = toRecordDoc({ ...st, materials: [st.materials[0], { kind: '비료', action: '사용', type: '엽면시비', name: '가상 칼슘제', qty: '', unit: '', dilution: '', pest: '' }] }, { ...ctx, needsConfirm: ['m0.type', 'm1.type', 'm1.name'], editedFields: [] });
  check('에이전트 키를 문서 경로로(농약, 비료, 제품명)', JSON.stringify(two.needs_confirm) === JSON.stringify(['materials[0].pesticide_type', 'materials[1].fertilizer_type', 'materials[1].product_name']), two.needs_confirm);
  const twoU = mergeForUpdate(two, { ...fromRecordDoc(two), materials: [{ ...fromRecordDoc(two).materials[0], qty: '1', unit: 'L' }, fromRecordDoc(two).materials[1]] }, { profile: T_PROFILE, now: later });
  check('다른 자재 표시는 유지', twoU.needs_confirm.includes('materials[1].fertilizer_type') && twoU.needs_confirm.includes('materials[0].pesticide_type'), twoU.needs_confirm);
  check('화면용 키로 되돌림', JSON.stringify(fromRecordDoc(two).agent_guessed) === JSON.stringify(['m0.type', 'm1.type', 'm1.name']), fromRecordDoc(two).agent_guessed);
  const ghost = toRecordDoc({ ...st, houseIds: ['missing'] }, ctx);
  check('프로필에 없는 동은 미완성, 확인 필요', ghost.status === 'incomplete' && ghost.missing_fields.includes('확인 안 된 동') && ghost.needs_confirm.includes('plots'), ghost);
  const ghost2 = toRecordDoc({ ...st, houseIds: ['h1', 'missing'] }, ctx);
  check('있는 동과 없는 동 섞임도 미완성', ghost2.missing_fields.includes('확인 안 된 동') && ghost2.plots.length === 1, ghost2);
  const ghostDis = toRecordDoc({ type: 'disaster', houseIds: ['missing'], crop: '딸기', accident_date: '2026-11-15', peril: '강풍', facility_damage: '비닐 찢어짐', crop_symptom: '시듦' }, { profile: T_PROFILE, now });
  check('재해도 없는 동은 미완성', ghostDis.missing_fields.includes('확인 안 된 동'), ghostDis.missing_fields);
  check('사용량 채우면 완성', upd.status === 'complete', upd.missing_fields);
  check('사후 입력은 처음 저장 날짜 기준', upd.is_backfill === true, upd.is_backfill);
  const mixed = toRecordDoc({ ...st, houseIds: ['h1', 'h3'] }, ctx);
  check('작목 다른 동은 미완성(S-7)', mixed.missing_fields.includes('작목이 다른 동'), mixed.missing_fields);
  const buy = toRecordDoc({ workDate: '2026-11-15', houseIds: [], crop: '', stage: '', task: '', materials: [{ kind: '비료', action: '구입', type: '복합비료', name: '가상 복합비료', qty: '20', unit: 'kg', dilution: '', pest: '' }], area: { value: '', unit: '㎡' } }, { profile: T_PROFILE, now });
  check('구입 기록 빈 동은 자동으로 안 채움(U-03)', buy.house_ids.length === 0 && buy.missing_fields.includes('하우스 동'), buy);
  check('직접 입력은 manual, form', buy.extract_method === 'manual' && buy.input_mode === 'form', buy);
  const noAct = toRecordDoc({ ...st, materials: [{ kind: '', action: '', type: '', name: '가상 약', qty: '1', unit: 'L', dilution: '', pest: '' }] }, ctx);
  check('자재 종류와 구입/사용 빈칸은 미완성', noAct.missing_fields.includes('자재 종류') && noAct.missing_fields.includes('자재 구입/사용'), noAct.missing_fields);
  const dis = toRecordDoc({ type: 'disaster', workDate: '', houseIds: ['h3'], crop: '딸기', accident_date: '', peril: '바람', peril_group: '강풍', facility_damage: '비닐 찢어짐', crop_symptom: '' }, { profile: T_PROFILE, now });
  check('재해: 원문 낱말과 분류 따로(V-5)', dis.type === 'disaster' && dis.peril === '바람' && dis.peril_group === '강풍', dis);
  const rawCause = '어젯밤 바람이 세게 불었어요';
  const rawDoc = toRecordDoc({ type: 'disaster', accident_date: '2026-11-15', cause_text: rawCause, peril: '바람' }, { profile: T_PROFILE, now });
  check('재해 원문 저장 후 복원', fromRecordDoc(rawDoc).cause_text === rawCause, rawDoc);
  check('재해: 사고일 없으면 저장 날짜로 정렬, 미완성', dis.work_date === '2026-11-16' && dis.missing_fields.includes('사고일'), dis);
  const zero = toRecordDoc({ ...st, materials: [{ ...st.materials[0], qty: '0', unit: 'mL' }] }, ctx);
  check('0은 빈값이 아님', zero.materials[0].qty === 0 && !zero.missing_fields.includes('농약 양'), zero.materials[0]);
  // 지금 agent.js는 답을 " / "로 잇고 '규칙', 'chat'으로 저장한다. 그 모양도 받아야 한다
  const v6 = toRecordDoc({ ...st, answers: [{ field: 'houseIds', label: '1동', value: '1동', source: 'button' }, { field: 'm0.qty', label: null, value: '200미리', source: 'text' }] }, { profile: T_PROFILE, now });
  check('답 필드도 문서 경로로, 방법 유지(V-6)', v6.answers[0].field === 'plots' && v6.answers[0].source === 'button' && v6.answers[1].field === 'materials[0].qty' && v6.answers[1].source === 'text', v6.answers);
  const legacyChat = toRecordDoc({ ...st, id: null, chat_answers: '1동 / 살균제', extract_method: '규칙', input_mode: 'chat', source_text: '원문', agent_guessed: ['crop'] }, { profile: T_PROFILE, now });
  check('옛 답 글은 답 배열로, 방법은 모름', legacyChat.answers.length === 2 && legacyChat.answers[0].source === null && legacyChat.input_mode === 'chat' && legacyChat.extract_method === 'rule', legacyChat);
  const view = fromRecordDoc(legacyChat);
  check('화면용 값으로 되돌림', view.chat_answers === '1동 / 살균제' && view.extract_method === '규칙' && view.input_mode === 'chat', view);
  const handoff = toRecordDoc({ ...st, input_mode: 'chat-handoff' }, { profile: T_PROFILE, now });
  check('chat-handoff는 chat_handoff로', handoff.input_mode === 'chat_handoff' && fromRecordDoc(handoff).input_mode === 'chat-handoff', handoff.input_mode);
  const again = toRecordDoc(fromRecordDoc(d), { profile: T_PROFILE, now });
  check('읽고 다시 저장해도 답한 방법 유지', again.answers[0].source === 'button' && again.conversation_id === 'c1', again.answers);
  const legacyDot = fromRecordDoc({ id: 'o9', workDate: '2026-11-01', houseIds: ['h1'], crop: '토마토', stage: '작물관리', task: '관수\u00b7양액', materials: [{ kind: '비료', action: '사용', type: '화학(복합\u00b7단비)', name: '가', qty: '1', unit: 'kg' }] });
  check('예전 가운뎃점 값은 새 이름으로 읽음(D2-09)', legacyDot.task === '관수와 양액' && legacyDot.materials[0].type === '화학(복합과 단비)', legacyDot);
  const legacyDis = fromRecordDoc({ ...toRecordDoc({ type: 'disaster', houseIds: ['h3'], crop: '딸기', accident_date: '2026-11-15', peril: '강풍', peril_group: '강풍\u00b7태풍', facility_damage: '골조 휨\u00b7파손, 비닐 찢어짐', crop_symptom: '' }, { profile: T_PROFILE, now }) });
  check('재해 항목도 새 이름, 여러 값 유지', legacyDis.peril_group === '강풍과 태풍' && legacyDis.facility_damage === '골조 휨과 파손, 비닐 찢어짐', legacyDis);
  const pass = cases.filter((c) => c.pass).length;
  return { total: cases.length, pass, cases };
}
