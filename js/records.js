// 일지 레코드 공통 로직: 빈 레코드, 작목 자동, 세부작업내용 자동 문장, 미완성 판정

import { WEEKDAYS, defaultUnit } from './constants.js';

// v0.3: 재해 기록은 작업 일지와 별도 기록 (type: 'disaster'). 같은 저장소에 두되 엑셀은 시트3으로 따로 나간다
export function isDisaster(r) {
  return !!r && r.type === 'disaster';
}

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function newMaterial(kind = '농약') {
  return { kind, action: '사용', type: '', name: '', qty: '', unit: defaultUnit(kind), dilution: '', pest: '' };
}

export function emptyRecord(profile) {
  const first = profile?.houses?.[0];
  return {
    id: null,
    workDate: todayStr(),
    houseIds: first ? [first.id] : [],
    crop: first ? first.crop : '',
    cropManual: false,
    weather: null,
    stage: '',
    task: '',
    materials: [],
    area: { value: '', unit: '㎡' },
    detail: '',
    detailEdited: false,
    memo: '',
  };
}

export function housesOf(profile, ids) {
  const hs = profile?.houses || [];
  return (ids || []).map((id) => hs.find((h) => h.id === id)).filter(Boolean);
}

// 선택한 동에 연결된 작목. 여러 작목이 섞이면 첫 동 기준
export function cropOf(profile, ids) {
  const hs = housesOf(profile, ids);
  return hs.length ? hs[0].crop : '';
}

export function houseNames(profile, ids) {
  return housesOf(profile, ids).map((h) => h.name).join(', ');
}

// 엑셀 B열: "1동(가상리 123), 2동(가상리 124)"
export function plotsText(profile, ids) {
  return housesOf(profile, ids).map((h) => (h.lot ? `${h.name}(${h.lot})` : h.name)).join(', ');
}

export function qtyText(m) {
  return m.qty !== '' && m.qty != null ? `${m.qty}${m.unit || ''}` : '';
}

// 세부작업내용 자동 문장. 예: "1동 토마토 병해충 방제, 잿빛곰팡이병 대상 가상곰팡이 액상 100mL (1000배) 사용"
export function autoText(profile, r) {
  const names = houseNames(profile, r.houseIds);
  if (isDisaster(r)) {
    // 예: "3동 딸기 재해(강풍과 태풍), 시설 피해: 비닐 찢어짐, 작물 피해: 얼어서 시듦"
    let d = [names, r.crop, `재해(${r.cause_text || (Array.isArray(r.peril) ? r.peril.join(', ') : r.peril) || '종류 미입력'})`].filter(Boolean).join(' ');
    if (r.facility_damage) d += `, 시설 피해: ${r.facility_damage}`;
    if (r.crop_symptom) d += `, 작물 피해: ${r.crop_symptom}`;
    if (r.continuing) d += ', 연속 재해';
    return d;
  }
  let s = [names, r.crop, r.task || r.stage || '작업'].filter(Boolean).join(' ');
  if (r.task === '정식' && (r.variety || r.plant_count)) s += `, ${[r.variety ? `품종 ${r.variety}` : '', r.plant_count ? `${r.plant_count}주` : ''].filter(Boolean).join(' ')}`;
  (r.materials || []).forEach((m) => {
    if (!m.name && !m.type) return;
    const label = m.name || `${m.type}`;
    s += `, ${m.pest ? m.pest + ' 대상 ' : ''}${label} ${qtyText(m) || '(양 미입력)'}${m.dilution ? ` (${m.dilution}배)` : ''} ${m.action}`;
  });
  if (r.area && r.area.unit === '동 전체') s += ', 동 전체';
  else if (r.area && r.area.value) s += `, 처리 면적 ${r.area.value}${r.area.unit}`;
  return s;
}

export function detailOf(profile, r) {
  return r.detailEdited && r.detail ? r.detail : autoText(profile, r);
}

// 필수 항목 빈칸 목록 (빈칸이어도 저장은 되고 "미완성" 표시)
// 계약 v1 2-1의 5번: 대화 저장과 직접 입력 저장이 모두 이 판정 하나를 쓴다(js/contract.js).
// profile을 주면 작목이 다른 동을 한 기록에 넣었는지도 본다(계약 C-6, S-7).
export function missingFields(r, profile) {
  const a = [];
  const ids = r.houseIds || [];
  const mixed = () => {
    const hs = profile?.houses || [];
    return new Set(ids.map((id) => hs.find((h) => h.id === id)?.crop).filter(Boolean)).size > 1;
  };
  // 프로필에 없는 동(삭제된 동 등)이 섞여 있으면 미완성(계약 C-5, Codex 재검증)
  const unknownHouse = () => !!profile && ids.some((id) => !(profile.houses || []).some((h) => h.id === id));
  if (isDisaster(r)) {
    if (!r.accident_date) a.push('사고일');
    if (!r.cause_text && !(Array.isArray(r.peril) ? r.peril.length : r.peril)) a.push('재해 종류');
    if (!ids.length) a.push('피해 동');
    if (!r.facility_damage || (Array.isArray(r.facility_damage) && !r.facility_damage.length)) a.push('시설 피해');
    if (!r.crop_symptom) a.push('작물 피해');
    if (mixed()) a.push('작목이 다른 동');
    if (unknownHouse()) a.push('확인 안 된 동');
    return a;
  }
  if (!r.workDate) a.push('작업일');
  // 구입 기록도 동을 자동으로 채우지 않는다. 비어 있으면 미완성(U-03, S-3)
  if (!ids.length) a.push('하우스 동');
  if (!r.crop) a.push('작목');
  if (!r.stage) a.push('작업단계');
  if (mixed()) a.push('작목이 다른 동');
  if (unknownHouse()) a.push('확인 안 된 동');
  if (r.task === '병해충 방제' && !(r.materials || []).length) a.push('방제 방법 또는 자재');
  (r.materials || []).forEach((m) => {
    // 자재 종류(농약, 비료, 종묘)와 구입/사용이 비면 어느 장부에 들어갈지 모른다(A1)
    if (!m.kind) a.push('자재 종류');
    if (m.action !== '구입' && m.action !== '사용') a.push('자재 구입/사용');
    if (!m.kind) return;
    if (!m.type) a.push(`${m.kind} 종류`);
    if (!m.name) a.push(`${m.kind} 제품명`);
    if (m.qty === '' || m.qty == null) a.push(`${m.kind} 양`);
    if (!m.unit) a.push(`${m.kind} 단위`);
  });
  return a;
}

// 사후입력: 작업일보다 늦은 날에 처음 작성한 기록
export function isBackfill(r) {
  if (!r.createdAt) return false;
  return r.workDate < todayStr(new Date(r.createdAt));
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${todayStr(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 제품명 최근 사용 목록 (최근 기록 순, 최대 6개)
export function recentNames(records, kind) {
  const out = [];
  for (const r of records) {
    for (const m of r.materials || []) {
      if (m.kind === kind && m.name && !out.includes(m.name)) out.push(m.name);
      if (out.length >= 6) return out;
    }
  }
  return out;
}
