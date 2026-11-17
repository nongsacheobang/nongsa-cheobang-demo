// 대화 화면 UI: 말풍선, 빠른 답 버튼, 확인 카드 컴포넌트, 대화 입력창(+마이크), 시연 대화 버튼
// app.js 의 이벤트 위임(data-act / data-in)을 그대로 쓴다.

import { CROPS, STAGES, DILUTIONS, MATERIAL_KINDS, PERILS, FACILITY_DAMAGES, CROP_SYMPTOMS, PHOTO_NOTICE, tasksFor, pestsFor, typesFor, unitsFor } from '../constants.js';
import { weekday, housesOf, recentNames, todayStr } from '../records.js';
import { weatherText } from '../weather.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (o) => Object.entries(o).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
const chipList = (list, sel, k, extraCls = '') => list.map((x) => {
  const v = typeof x === 'object' ? x.v : x;
  const l = typeof x === 'object' ? x.l : x;
  const on = Array.isArray(sel) ? sel.includes(v) : sel === v;
  return `<button class="chip${extraCls}${on ? ' on' : ''}" ${attr({ act: 'agSet', k, v })}>${esc(l)}</button>`;
}).join('');

// 시연 대화 시나리오 (가상 데이터 농장 기준: 1동 토마토, 2동 방울토마토, 3동 딸기)
export const DEMO_TALKS = [
  { label: '칼슘제 엽면시비 (바로 확인 카드)', texts: ['어제 1동 토마토에 칼슘제 엽면시비 500배로 20리터 뿌렸어'] },
  { label: '딸기 잿빛곰팡이 방제 (되묻기)', texts: ['3동 딸기 잿빛곰팡이 약 쳤어'] },
  { label: '강풍, 냉해 피해 기록', texts: ['어제 강풍 때문에 3동 비닐이 찢어지고 딸기가 냉해 입었어요'] },
  { label: '날씨, 코딩 질문 (거절)', texts: ['오늘 날씨 어때?', '파이썬 코딩 알려줘'] },
];

const MIC_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';

export function chatBar(S) {
  return `<div class="cbar">
    <button class="mic${S.listening ? ' on' : ''}" data-act="mic" aria-label="말로 입력">${MIC_SVG}</button>
    <input class="inp" id="chatInput" data-in="chat" enterkeyhint="send" autocomplete="off" placeholder="${S.listening ? '듣고 있어요. 말씀하세요' : '오늘 한 작업을 말해 주세요'}" value="${esc(S.chatText || '')}">
    <button class="send" data-act="chatSend">보내기</button>
  </div>`;
}

export function demoTalks(compact) {
  return `<div class="demo-talk${compact ? ' compact' : ''}"><span class="mut">시연 대화</span>${DEMO_TALKS.map((d, i) => `<button class="chip" ${attr({ act: 'demoTalk', v: i })}>${esc(d.label)}</button>`).join('')}</div>`;
}

// ---------- 확인 카드 ----------
function tagFor(d, key, empty) {
  if (empty) return '<span class="tag inc">빈칸</span>';
  if ((d.guessed || []).includes(key)) return '<span class="tag warn">확인 필요</span>';
  return '';
}

function row(d, key, label, value, editor, opts) {
  const empty = value === '' || value == null;
  const editing = opts.active && opts.editKey === key;
  const tag = tagFor(d, key, empty && opts.required);
  // hl: 날짜, 동 번호, 주수처럼 받아쓰기 오류가 잦은 값은 크게 강조 (눌러서 수정 가능)
  return `<div class="cr${editing ? ' ed' : ''}${opts.hl ? ' hl' : ''}">
    <div class="crh" ${opts.active && editor ? attr({ act: 'agEdit', k: editing ? '' : key }) : ''}>
      <span class="k">${esc(label)}</span><span class="v">${empty ? '<span class="mut">빈칸</span>' : esc(value)} ${tag}</span>${opts.active && editor ? `<span class="lnk sm">${editing ? '닫기' : '고치기'}</span>` : ''}
    </div>
    ${editing ? `<div class="cre">${editor}<button class="lnk" ${attr({ act: 'agEdit', k: '' })}>완료</button></div>` : ''}
  </div>`;
}

export function confirmCard(d, S, opts = {}) {
  const p = S.profile;
  const o = { active: !!opts.active, editKey: S.agentEdit || '' };
  const hs = housesOf(p, d.houseIds).map((h) => h.name).join(', ');
  const w = d.weather;
  let h = '';
  h += row(d, 'workDate', '작업일', d.workDate ? `${d.workDate} (${weekday(d.workDate)})` : '', `<input class="inp sm" type="date" value="${esc(d.workDate)}" max="${todayStr()}" data-in="agDate">`, { ...o, required: true, hl: true });
  h += row(d, 'houseIds', '하우스 동', hs, houseChips(d, p), { ...o, required: true, hl: true });
  h += row(d, 'crop', '작목', d.crop, `<div class="chips">${chipList(CROPS, d.crop, 'crop')}</div>`, { ...o, required: true });
  const tasks = tasksFor(d.crop)[d.stage] || [];
  h += row(d, 'stage', '작업', d.stage ? d.stage + (d.task ? ' > ' + d.task : '') : '', `<div class="chips" style="margin-bottom:8px">${chipList(STAGES, d.stage, 'stage')}</div>${tasks.length ? `<div class="chips">${chipList(tasks, d.task, 'task')}</div>` : ''}`, { ...o, required: !(d.materials.length && d.materials.every((m) => m.action === '구입')) });
  // 정식 카드: 품종, 주수 (피해비율 분모인 주수, 인수 확인용 품종)
  if (d.task === '정식') {
    h += row(d, 'variety', '품종', d.variety, `<input class="inp sm" placeholder="예: 설향" value="${esc(d.variety)}" ${attr({ in: 'ag', k: 'variety' })}>`, { ...o, required: false });
    h += row(d, 'plant_count', '주수', d.plant_count ? `${d.plant_count}주` : '', `<input class="inp sm" inputmode="numeric" placeholder="예: 3000" value="${esc(d.plant_count)}" ${attr({ in: 'ag', k: 'plant_count' })}>`, { ...o, required: false, hl: true });
  }
  h += row(d, 'weather', '날씨', w ? weatherText(w) : '불러오는 중', '', { ...o, required: false });
  d.materials.forEach((m, i) => {
    const P = m.kind === '농약' || !m.kind;
    const k = `m${i}`;
    const kindTxt = m.kind ? `${m.kind} ${m.action}` : '';
    h += `<div class="crm">${esc(m.kind || '자재')} ${i + 1}</div>`;
    h += row(d, `${k}.kind`, '구분', kindTxt, `<div class="chips" style="margin-bottom:8px">${chipList(MATERIAL_KINDS, m.kind, `${k}.kind`)}</div><div class="chips">${chipList(['사용', '구입'], m.action, `${k}.action`)}<button class="chip danger" ${attr({ act: 'agSet', k: `${k}.remove`, v: '1' })}>이 자재 빼기</button></div>`, { ...o, required: true });
    h += row(d, `${k}.type`, '종류', m.type, `<div class="chips">${chipList(typesFor(m.kind), m.type, `${k}.type`)}</div>`, { ...o, required: true });
    const names = recentNames(S.records || [], m.kind || '농약').slice(0, 4);
    h += row(d, `${k}.name`, m.kind === '종묘(모종)' ? '품종' : '제품명', m.name, `${names.length ? `<div class="chips" style="margin-bottom:8px">${chipList(names, m.name, `${k}.name`)}</div>` : ''}<input class="inp sm" placeholder="직접 입력" value="${esc(m.name)}" ${attr({ in: 'ag', k: `${k}.name` })}>`, { ...o, required: true });
    h += row(d, `${k}.qty`, '양', m.qty !== '' && m.qty != null ? `${m.qty}${m.unit ? ' ' + m.unit : ''}` : '', `<input class="inp sm" inputmode="decimal" placeholder="숫자" value="${esc(m.qty)}" ${attr({ in: 'ag', k: `${k}.qty` })}><div class="chips" style="margin-top:8px">${chipList(unitsFor(m.kind), m.unit, `${k}.unit`)}</div>`, { ...o, required: true });
    if (m.action === '사용' && m.kind !== '종묘(모종)') {
      h += row(d, `${k}.dilution`, '희석배수', m.dilution ? `${m.dilution}배` : '', `<div class="chips" style="margin-bottom:8px">${chipList(DILUTIONS.map((x) => ({ v: x, l: x + '배' })), m.dilution, `${k}.dilution`)}</div><input class="inp sm" inputmode="numeric" placeholder="직접 입력 (숫자)" value="${esc(m.dilution)}" ${attr({ in: 'ag', k: `${k}.dilution` })}>`, { ...o, required: false });
      if (P) h += row(d, `${k}.pest`, '대상 병해충', m.pest, `<div class="chips">${chipList(pestsFor(d.crop), m.pest, `${k}.pest`)}</div>`, { ...o, required: false });
    }
  });
  if (o.active) h += `<button class="lnk" style="margin:4px 0" ${attr({ act: 'agSet', k: 'addMat', v: '1' })}>+ 농약/비료/모종 추가</button>`;
  h += row(d, 'memo', '메모', d.memo, `<input class="inp sm" value="${esc(d.memo)}" ${attr({ in: 'ag', k: 'memo' })}>`, { ...o, required: false });
  const src = (d.sourceTexts || []).join(' / ');
  return `<div class="ccard${o.active ? '' : ' past'}">
    <div class="row" style="margin-bottom:6px"><b>일지 초안</b><span class="sp"></span>${opts.saved ? '<span class="tag ac">저장됨</span>' : opts.stale ? '<span class="tag">수정 전</span>' : `<span class="tag">추출: ${esc(d.method || '규칙')}</span>`}</div>
    ${h}
    <p class="src">원문: "${esc(src)}"${(d.answers || []).length ? `<br>답한 내용: ${esc(d.answers.join(" / "))}` : ""}</p>
    ${o.active ? `<button class="big sm" style="margin:10px 0 8px" data-act="agSave" ${S.busy ? 'disabled' : ''}>저장</button>
      <div class="row"><button class="ghost" style="margin:0;flex:1" data-act="agForm">직접 입력 화면에서 고치기</button><button class="ghost" style="margin:0;width:80px" ${attr({ act: 'agQuick', v: '__cancel', l: '취소' })}>취소</button></div>` : ''}
  </div>`;
}

function houseChips(d, p) {
  return `<div class="chips">${p.houses.map((x) => `<button class="chip${d.houseIds.includes(x.id) ? ' on' : ''}" ${attr({ act: 'agSet', k: 'house', v: x.id })}>${esc(x.name)}</button>`).join('')}</div>`;
}

const inList = (cur, list) => String(cur || '').split(', ').filter(Boolean);

// ---------- 재해 확인 카드 (v0.3, 손해평가사 관점 평가 v1 3장 P0 필드) ----------
export function disasterCard(d, S, opts = {}) {
  const p = S.profile;
  const o = { active: !!opts.active, editKey: S.agentEdit || '' };
  const hs = housesOf(p, d.houseIds).map((h) => h.name).join(', ');
  const crop = d.crop || housesOf(p, d.houseIds)[0]?.crop || '';
  let h = '';
  h += row(d, 'accident_date', '사고일', d.accident_date ? `${d.accident_date} (${weekday(d.accident_date)})${d.continuing ? ' 부터 계속' : ''}` : '', `<input class="inp sm" type="date" value="${esc(d.accident_date)}" max="${todayStr()}" data-in="agDate">`, { ...o, required: true, hl: true });
  h += row(d, 'houseIds', '피해 동', hs ? `${hs}${crop ? ` (${crop})` : ''}` : '', houseChips(d, p), { ...o, required: true, hl: true });
  h += row(d, 'peril', '재해 종류', d.peril, `<div class="chips">${chipList(PERILS, inList(d.peril), 'peril')}</div>`, { ...o, required: true });
  h += row(d, 'facility_damage', '시설 피해', d.facility_damage, `<div class="chips">${chipList(FACILITY_DAMAGES, inList(d.facility_damage), 'facility_damage')}</div>`, { ...o, required: true });
  h += row(d, 'crop_symptom', '작물 피해', d.crop_symptom, `<div class="chips" style="margin-bottom:8px">${chipList(CROP_SYMPTOMS, inList(d.crop_symptom), 'crop_symptom')}</div>`, { ...o, required: true });
  h += row(d, 'memo', '메모', d.memo, `<input class="inp sm" value="${esc(d.memo)}" ${attr({ in: 'ag', k: 'memo' })}>`, { ...o, required: false });
  const src = (d.sourceTexts || []).join(' / ');
  return `<div class="ccard dis${o.active ? '' : ' past'}">
    <div class="row" style="margin-bottom:6px"><b>피해 기록 초안</b><span class="tag dis">재해</span><span class="sp"></span>${opts.saved ? '<span class="tag ac">저장됨</span>' : opts.stale ? '<span class="tag">수정 전</span>' : `<span class="tag">추출: ${esc(d.method || '규칙')}</span>`}</div>
    ${h}
    <p class="photo-note">${esc(PHOTO_NOTICE)}</p>
    <p class="src">원문: "${esc(src)}"${(d.answers || []).length ? `<br>답한 내용: ${esc(d.answers.join(" / "))}` : ""}</p>
    ${o.active ? `<button class="big sm" style="margin:10px 0 8px" data-act="agSave" ${S.busy ? 'disabled' : ''}>저장</button>
      <div class="row"><button class="ghost" style="margin:0;flex:1" ${attr({ act: 'agQuick', v: '__cancel', l: '취소' })}>취소</button></div>` : ''}
  </div>`;
}

function anyCard(d, S, opts) {
  return d && d.type === 'disaster' ? disasterCard(d, S, opts) : confirmCard(d, S, opts);
}

// ---------- 대화 화면 ----------
export function vChat(S) {
  const ag = S.agent;
  const st = ag.state;
  const msgs = st.messages;
  const lastIdx = msgs.length - 1;
  let lastCard = -1;
  msgs.forEach((m, i) => { if (m.card && !m.stale && !m.snap) lastCard = i; });
  const body = msgs.map((m, i) => {
    if (m.role === 'user') return `<div class="msg me"><p>${esc(m.text)}</p></div>`;
    let out = `<div class="msg ag${m.kind === 'refuse' ? ' refuse' : ''}"><p>${esc(m.text)}</p></div>`;
    if (m.card) {
      if (m.snap) out += anyCard(m.snap, S, { active: false, saved: true });
      else if (i === lastCard && st.phase === 'confirm' && st.draft) out += anyCard(st.draft, S, { active: true });
      else if (m.stale) out += '<p class="mut" style="margin:-4px 0 10px 4px">(고치기 전 초안)</p>';
    }
    if (m.savedId) out += `<div class="msg ag"><button class="lnk" ${attr({ act: 'openDetail', v: m.savedId })}>저장한 일지 보기</button></div>`;
    if (i === lastIdx && m.quick && m.quick.length && !st.busy) {
      out += `<div class="qr">${m.quick.map((q) => `<button class="chip" ${attr({ act: 'agQuick', v: q.v, l: q.l })}>${esc(q.l)}</button>`).join('')}</div>`;
    }
    return out;
  }).join('');
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="go" data-v="home" aria-label="뒤로">&lt;</button><h1>대화로 기록하기</h1><button class="lnk" data-act="agForm">직접 입력</button></div>
    <div class="bd chatbd" id="chatBd">
      ${body}
      ${st.busy ? '<div class="msg ag"><p class="mut">정리하는 중</p></div>' : ''}
      <div style="height:6px"></div>
    </div>
    ${demoTalks(true)}
    ${chatBar(S)}
  </section>`;
}
