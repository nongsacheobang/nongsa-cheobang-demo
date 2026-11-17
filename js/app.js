// 농사 처방 P0 - 화면, 라우팅, 이벤트
// 화면 구성과 문구는 P0 와이어프레임 v0.1 (261115_허간_기획_P0와이어프레임_v01.html) 기준.
// v0.2 (11/15 에이전트 전환): 홈 1안 하이브리드(날씨, 할 일 한 줄 + 최근 기록 + 대화 입력창), #/chat 대화로 기록하기 (js/agent/)
// 해시 라우팅: #/login #/sent #/setup #/home #/chat #/write #/write/{id} #/saved/{id} #/list #/detail/{id} #/excel #/proof #/support #/me

import { CONFIG } from './config.js';
import { APP_VERSION, CROPS, STAGES, MATERIAL_KINDS, SEED, PHOTO_NOTICE, DILUTIONS, AREA_UNITS, SKY, EXCEL_HEADERS, tasksFor, pestsFor, typesFor, unitsFor } from './constants.js';
import { getStore, getDemoStore } from './storage/index.js';
import { auth, isValidEmail, DEMO_EMAIL } from './auth.js';
import { getWeather, weatherText, weatherSourceLabel, missingWeather } from './weather.js';
import { todayStr, weekday, newMaterial, emptyRecord, housesOf, cropOf, houseNames, autoText, detailOf, missingFields, isBackfill, isDisaster, fmtDateTime, recentNames } from './records.js';
import { buildSheet1Rows, buildDisasterRows, buildWorkbook, fileName, downloadBlob, canShareFile, shareBlob } from './excel.js';
import { DEMO_PROFILE, DEMO_SCENARIOS, buildDemoRecords, buildDemoScenario } from './demo.js';
import { createAgent } from './agent/agent.js';
import { vChat, chatBar, demoTalks, DEMO_TALKS } from './agent/chat-view.js';
import { runExtractTests } from './agent/extract-rules.js';
import { newVoiceState, wireRecognition } from './voice.js';
import { TABS, getView, getAction, tabOf } from './views/registry.js';
import { registerAllViews } from './views/index.js';
import { computeReadiness } from './insurance/score.js';
import { latestDisaster } from './insurance/rules.js';
import { getAlerts } from './weather/alerts.js';
import { demoAlertItems } from './weather/alert-check.js';
import { newNewsCount, resetDemoNews } from './views/info.js';
import { updateClaimSource, updateClaimButton } from './views/claim.js';

// 브라우저 콘솔에서 규칙 추출 단위 테스트: ncAgentTests()
window.ncAgentTests = () => runExtractTests();

const $app = document.getElementById('app');
const S = {
  session: null,
  profile: null,
  records: [],
  store: null,
  route: 'login',
  param: null,
  form: null,
  wxEdit: false,
  detailEditing: false,
  listFilter: 'all',
  excel: { period: 'month', from: '', to: '', sheets: [true, true, true, true] },
  setup: null,
  setupErr: '',
  loginErr: '',
  todayWx: null,
  installEvt: null,
  busy: false,
  agent: null,
  agentEdit: '',
  chatText: '',
  voice: newVoiceState(), // 음성 도구 실패 횟수(대화 인식 실패와 따로 셈, U-10)
  listening: false,
  recog: null,
  keepScroll: false,
};

function getAgent() {
  if (!S.agent) {
    S.agent = createAgent({
      getProfile: () => S.profile,
      getSession: () => S.session,
      getRecords: () => S.records,
      onUpdate: () => { if (S.route === 'chat') renderKeep(); },
    });
    S.agent.start();
  }
  return S.agent;
}

// ---------- 유틸 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (o) => Object.entries(o).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');

let toastTimer;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.display = 'none'), 2000);
}

function go(route) {
  if (location.hash === '#/' + route) render();
  else location.hash = '#/' + route;
}

function isDemoView() {
  return !!(S.session?.demo || S.profile?.demo || S.records.some((r) => r.demo));
}

function mdText(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}월 ${d}일 (${weekday(dateStr)})`;
}

function chips(list, selected, act, extra = {}) {
  return list.map((x) => {
    const on = Array.isArray(selected) ? selected.includes(x) : selected === x;
    return `<button class="chip${on ? ' on' : ''}" ${attr({ act, v: x, ...extra })}>${esc(x)}</button>`;
  }).join('');
}

function locShort() {
  const p = (S.profile?.location || '').trim().split(/\s+/);
  return p[p.length - 1] || '';
}

// ---------- 레이아웃 ----------
// v0.4 (11/16 보험금 받을 준비도 전환): 탭은 홈, 일지, 사고, 증빙, 더보기. 새 화면은 js/views/* 모듈(registry.js)
const TAB_OF = { home: 'home', chat: 'home', me: 'settings', write: 'journal', saved: 'journal', list: 'journal', detail: 'journal', excel: 'settings', proof: 'settings', support: 'info' };
// 탭을 누르면 가는 화면
const TAB_HOME = { home: 'home', journal: 'list', coverage: 'coverage', info: 'info', settings: 'me' };

// 화면 모듈에 넘기는 것. 점수는 여기서 한 번 계산하고 화면은 읽기만 한다
function viewCtx() {
  return {
    S, session: S.session, profile: S.profile, records: S.records, param: S.param, features: CONFIG.features,
    readiness: S.profile ? computeReadiness({ profile: S.profile, records: S.records, today: todayStr(), alerts: S.alerts ?? null }) : null,
    alerts: S.alerts ?? null, // 특보(읽기만). null은 못 불러옴
    go, toast, store: S.store, esc, reload, rerender: () => renderKeep(),
  };
}

function layout(inner, route) {
  const tab = TAB_OF[route] || tabOf(route);
  const newsCount = newNewsCount();
  const tabs = tab && route !== 'field'
    ? `<nav class="tabs">${TABS.map(([t, l]) => `<button class="${t === tab ? 'on' : ''}" ${attr({ act: 'go', v: TAB_HOME[t] })}><i></i>${l}${t === 'info' && newsCount ? ` <span aria-label="새 소식 ${newsCount}개">${newsCount > 9 ? '9+' : newsCount}</span>` : ''}</button>`).join('')}</nav>`
    : '';
  const badge = isDemoView() ? '<div class="demo-badge">가상 데이터로 보는 중이에요</div>' : '';
  return `${badge}${inner}<div class="toast" id="toast"></div>${tabs}`;
}

// ---------- 화면: 로그인 ----------
function vLogin() {
  const demoNote = CONFIG.auth === 'demo' ? '<p class="mut ctr" style="margin-top:6px">지금은 시연 모드라 실제 메일은 보내지 않아요</p>' : '';
  return `<section class="scr"><div class="bd white">
    <img class="logo" src="icons/icon.svg" alt="농사 처방">
    <h2 class="ctr" style="font-size:22px">농사 처방</h2>
    <p class="ctr t2" style="margin:6px 0 34px">기록하면 표준 영농기록장 엑셀이 바로 나와요</p>
    <div class="fld"><label for="email">이메일</label><input class="inp" id="email" type="email" inputmode="email" autocomplete="email" placeholder="이메일 주소" value="${esc(auth.getPendingEmail())}">
      ${S.loginErr ? `<p class="err">${esc(S.loginErr)}</p>` : ''}</div>
    <button class="big sm" data-act="sendLink">로그인 링크 받기</button>
    <p class="mut ctr" style="line-height:1.6">비밀번호 없이, 메일로 온 링크를 누르면 로그인돼요<br>(Firebase 이메일 링크 로그인)</p>
    ${demoNote}
    <div style="border-top:1px solid #EEE;margin:26px 0 16px"></div>
    <button class="ghost" data-act="go" data-v="info">지원사업 정보 보기</button><button class="ghost" data-act="demoAccount">데모로 시작하기</button>
    <p class="mut ctr">심사, 시연용 데모 계정은 바로 홈으로 이동</p>
  </div></section>`;
}

function vSent() {
  const email = auth.getPendingEmail();
  const demo = CONFIG.auth === 'demo';
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="go" data-v="login" aria-label="뒤로">&lt;</button><h1>메일 확인</h1></div>
    <div class="bd white">
      <div class="ph" style="height:150px;margin:24px 0">메일</div>
      <h2 class="ctr" style="font-size:19px;margin-bottom:8px">로그인 링크를 보냈어요</h2>
      <p class="ctr t2" style="line-height:1.6"><b>${esc(email)}</b><br>메일함에서 [농사 처방 로그인] 링크를 눌러주세요.<br>링크는 1시간 동안 유효해요.</p>
      ${demo ? `<div class="card" style="margin-top:24px;background:#FAFAFA">
        <h3>메일 미리보기 (시연)</h3>
        <p style="font-size:13px;line-height:1.6">제목: 농사 처방 로그인 링크<br>본문: 아래 버튼을 누르면 로그인됩니다.</p>
        <button class="big sm" style="margin:10px 0 0" data-act="completeDemoLink">링크 누르기 (시연)</button>
      </div>` : ''}
      <button class="lnk" style="display:block;margin:10px auto" data-act="resend">메일이 안 왔어요. 다시 보내기</button>
    </div></section>`;
}

// ---------- 화면: 농장, 하우스 동 등록 ----------
function setupDraft() {
  if (S.setup) return S.setup;
  const p = S.profile;
  S.setup = p
    ? JSON.parse(JSON.stringify({ name: p.name, farmName: p.farmName, location: p.location, houses: p.houses }))
    : { name: '', farmName: '', location: '', houses: [{ id: 'h1', name: '1동', lot: '', crop: '토마토' }] };
  return S.setup;
}

function vSetup() {
  const d = setupDraft();
  const editing = !!S.profile;
  const houses = d.houses.map((h, i) => h.hidden ? `<div class="house"><p>${esc(h.name)} (숨김)</p><button class="lnk" ${attr({ act: 'restoreHouse', i })}>다시 표시</button></div>` : `<div class="house">
      <div class="row"><input class="inp sm" style="width:90px;flex:none" placeholder="동 이름" value="${esc(h.name)}" ${attr({ in: 'house', i, k: 'name' })}>
        <input class="inp sm" placeholder="지번 (예: OO리 123)" value="${esc(h.lot)}" ${attr({ in: 'house', i, k: 'lot' })}>
        ${d.houses.filter(x => !x.hidden).length > 1 ? `<button class="lnk danger" ${attr({ act: 'rmHouse', i })}>삭제</button>` : ''}</div>
      <div class="row"><span class="mut" style="width:34px">작목</span><div class="chips">${chips(CROPS, h.crop, 'houseCrop', { i })}</div></div>
      <div class="row"><span class="mut" style="width:34px">면적</span><input class="inp sm" style="width:140px;flex:none" inputmode="decimal" placeholder="재배면적" value="${esc(h.area || '')}" ${attr({ in: 'house', i, k: 'area' })}><span class="mut">㎡ (선택)</span></div>
    </div>`).join('');
  return `<section class="scr">
    <div class="hd">${editing ? '<button class="bk" data-act="go" data-v="me" aria-label="뒤로">&lt;</button>' : ''}<h1>${editing ? '하우스 동, 작목 관리' : '처음 설정'}</h1><span class="mut">${editing ? '' : '최초 1회'}</span></div>
    <div class="bd">
      ${editing ? '' : '<div class="step"><i class="on"></i><i class="on"></i><i></i></div>'}
      <div class="fld"><label>이름<span class="req">*</span></label><input class="inp" placeholder="예: 홍길동" value="${esc(d.name)}" ${attr({ in: 'setup', k: 'name' })}></div>
      <div class="fld"><label>농장 이름<span class="req">*</span></label><input class="inp" placeholder="예: OO농장" value="${esc(d.farmName)}" ${attr({ in: 'setup', k: 'farmName' })}></div>
      <div class="fld"><label>농장 위치 (시군구)<span class="req">*</span><span class="opt">날씨 자동 입력에 사용</span></label><input class="inp" placeholder="예: 경상남도 OO군 OO면" value="${esc(d.location)}" ${attr({ in: 'setup', k: 'location' })}></div>
      <div class="fld"><label>하우스 동<span class="req">*</span><span class="opt">동 이름 + 지번 + 작목 + 재배면적(선택)</span></label>
        ${houses}
        <button class="ghost dash" data-act="addHouse">+ 하우스 동 추가</button>
      </div>
      ${S.setupErr ? `<p class="err" style="margin-bottom:10px">${esc(S.setupErr)}</p>` : ''}
      ${!editing && CONFIG.features.demoData ? `<div class="card" style="background:#FAFAFA"><h3>시연용</h3><button class="ghost" style="margin:0" data-act="fillDemoFarm">가상 데모 농장으로 채우기</button><p class="mut" style="margin-top:6px">시설 토마토, 방울토마토, 딸기 가상 농장과 일지 20건을 넣어요 (가상 표시)</p></div>` : ''}
    </div>
    <div class="ftr"><button class="big sm" style="margin:0" data-act="saveSetup">${editing ? '저장' : '시작하기'}</button></div>
  </section>`;
}

// ---------- 화면: 홈 (1안 바로 기록형 + 진행도 한 줄) ----------
function monthStats() {
  const ym = todayStr().slice(0, 7);
  const recs = S.records.filter((r) => r.workDate.startsWith(ym));
  const days = new Set(recs.map((r) => r.workDate)).size;
  const inc = recs.filter((r) => missingFields(r).length).length;
  return { month: Number(ym.slice(5)), days, inc };
}

function li(r) {
  const [, m, d] = r.workDate.split('-').map(Number);
  const dis = isDisaster(r);
  const mats = dis ? [r.facility_damage, r.crop_symptom].filter(Boolean).join(', ') : (r.materials || []).map((x) => `${x.kind} ${x.action}`).join(', ');
  const inc = missingFields(r).length;
  const title = dis ? `재해: ${r.cause_text || (Array.isArray(r.peril) ? r.peril.join(', ') : r.peril) || '종류 미입력'}` : r.task || r.stage || '작업 미입력';
  const chat = r.input_mode === 'chat' || r.input_mode === 'chat-handoff';
  return `<button type="button" class="li" ${attr({ act: 'openDetail', v: r.id })}>
    <span class="dt"><b>${d}</b><span>${m}월 ${weekday(r.workDate)}</span></span>
    <span class="ct"><span class="li-title"><b>${esc(title)}</b> <span class="t2">${esc(houseNames(S.profile, r.houseIds))} ${esc(r.crop)}</span></span>
      <span class="s">${esc(weatherText(r.weather))}${mats ? ', ' + esc(mats) : ''}</span></span>
    <span class="tags">${dis ? '<span class="tag dis">재해</span>' : ''}${inc ? '<span class="tag inc">미완성</span>' : ''}${chat ? '<span class="tag ac">대화</span>' : ''}${r.demo ? '<span class="tag demo">가상</span>' : ''}</span>
  </button>`;
}

function weatherLine(w, sub) {
  const miss = !w || w.status === 'missing';
  const t = weatherText(w);
  return `<div class="wx${miss ? ' miss' : ''}"><div class="sq">${miss ? '미수집' : esc(w.sky || '-')}</div><div class="sp"><b>${esc(t)}</b><div class="mut">${esc(sub)}</div></div></div>`;
}

// 홈 1안 하이브리드 (에이전트 전환 기획서 v1.0): 위 날씨, 할 일 카드 한 줄 / 가운데 최근 기록 / 아래 대화 입력창+마이크
// 기존 버튼(직접 입력, 전체, 보기, 내 농장)은 유지하고 대화 입력을 주 동선으로 둠
function vHome() {
  const st = monthStats();
  const recent = S.records.slice(0, 3).map(li).join('');
  const w = S.todayWx;
  const miss = !w || w.status === 'missing';
  const todo = CONFIG.showProgressLine ? `<button class="hbc" data-act="listInc"><span class="mut">할 일, ${st.month}월 기록 ${st.days}일</span><b>${st.inc ? `빠진 항목 ${st.inc}건` : '빠진 항목 없음'}</b><span class="lnk sm">보기</span></button>` : '';
  return `<section class="scr">
    <div class="hd"><h1>${esc(S.profile.farmName)}</h1><button class="ic" data-act="go" data-v="me" aria-label="내 농장">내</button></div>
    <div class="bd">
      <div class="hb">
        <div class="hbc${miss ? ' miss' : ''}" title="${esc(weatherSourceLabel(w))}"><span class="mut">오늘 날씨, ${esc(locShort())}</span><b>${esc(weatherText(w))}</b><span class="mut">${esc(mdText(todayStr()))}</span></div>
        ${todo}
      </div>
      <div class="card"><div class="row" style="margin-bottom:4px"><h3 style="margin:0">최근 기록</h3><span class="sp"></span><button class="lnk" data-act="go" data-v="list">전체</button></div>
        ${recent || '<p class="empty">아직 기록이 없어요. 아래 입력창에 오늘 한 작업을 남겨 보세요</p>'}
      </div>
      <button class="ghost" data-act="newRecord">직접 입력으로 일지 쓰기</button>
      ${demoTalks(false)}
    </div>
    <p class="chint">말이나 글로 남기면 일지 항목으로 정리해 드려요</p>
    ${chatBar(S)}
  </section>`;
}

// ---------- 화면: 일지 쓰기 ----------
function ensureForm(id) {
  if (S.form && (S.form.id || null) === (id || null)) return S.form;
  if (id) {
    const r = S.records.find((x) => x.id === id);
    S.form = r ? JSON.parse(JSON.stringify(r)) : emptyRecord(S.profile);
  } else {
    S.form = emptyRecord(S.profile);
  }
  if (!S.form.area) S.form.area = { value: '', unit: '㎡' };
  S.wxEdit = false;
  S.detailEditing = !!S.form.detailEdited;
  if (!id && !S.form.weather) loadFormWeather();
  return S.form;
}

async function loadFormWeather() {
  const f = S.form;
  const date = f.workDate;
  const w = await getWeather(date, S.profile);
  if (S.form === f && f.workDate === date && f.weather?.source !== 'manual') {
    f.weather = w;
    if (S.route === 'write') renderKeep();
  }
}

function materialCard(m, i, crop) {
  const P = m.kind === '농약';
  const names = recentNames(S.records, m.kind);
  return `<div class="mat">
    <div class="row" style="margin-bottom:10px">
      <div class="seg" style="flex:1.4">${MATERIAL_KINDS.map((k) => `<button class="${m.kind === k ? 'on' : ''}" ${attr({ act: 'matKind', i, v: k })}>${k === SEED ? '모종' : k}</button>`).join('')}</div>
      <div class="seg" style="flex:1">${['구입', '사용'].map((k) => `<button class="${m.action === k ? 'on' : ''}" ${attr({ act: 'matSet', i, k: 'action', v: k })}>${k}</button>`).join('')}</div>
      <button class="lnk danger" ${attr({ act: 'rmMat', i })}>삭제</button></div>
    <div class="fld"><label>${m.kind} 종류<span class="req">*</span></label><div class="chips">${chips(typesFor(m.kind), m.type, 'matSet', { i, k: 'type' })}</div></div>
    <div class="fld"><label>${m.kind === SEED ? '품종' : '제품명'}<span class="req">*</span><span class="opt">최근 사용 + 직접 입력</span></label>
      ${names.length ? `<div class="chips" style="margin-bottom:7px">${chips(names, m.name, 'matSet', { i, k: 'name' })}</div>` : ''}
      <input class="inp" placeholder="직접 입력" value="${esc(m.name)}" ${attr({ in: 'mat', i, k: 'name' })}></div>
    <div class="fld"><label>양, 단위<span class="req">*</span></label>
      <div class="qty"><input class="inp" inputmode="decimal" placeholder="숫자" value="${esc(m.qty)}" ${attr({ in: 'mat', i, k: 'qty' })}></div>
      <div class="chips" style="margin-top:7px">${chips(unitsFor(m.kind), m.unit, 'matSet', { i, k: 'unit' })}</div></div>
    ${P && m.action === '사용' ? `<div class="fld"><label>희석배수<span class="opt">선택</span></label><div class="chips">${DILUTIONS.map((x) => `<button class="chip${m.dilution === x ? ' on' : ''}" ${attr({ act: 'matToggle', i, k: 'dilution', v: x })}>${x}배</button>`).join('')}</div></div>
    <div class="fld" style="margin:0"><label>대상 병해충<span class="opt">선택</span></label><div class="chips">${chips(pestsFor(crop), m.pest, 'matToggle', { i, k: 'pest' })}</div></div>` : ''}
  </div>`;
}

function vWrite() {
  const f = ensureForm(S.param);
  const editing = !!f.id;
  const tasks = tasksFor(f.crop)[f.stage] || [];
  const w = f.weather;
  const miss = !w || w.status === 'missing';
  const wxSub = w ? `${w.rain != null && !miss ? `강수 ${w.rain}mm, ` : ''}${locShort()}, ${weatherSourceLabel(w)}` : (editing ? '기존 기록에 날씨가 없어요' : '불러오는 중');
  const wxEdit = S.wxEdit ? `<div class="wxedit">
      <div class="fld" style="margin-bottom:10px"><label>하늘상태</label><div class="chips">${chips(SKY, miss ? '' : w.sky, 'wxSky')}</div></div>
      <div class="row" style="margin-bottom:10px">
        <input class="inp sm" inputmode="decimal" placeholder="최저 ℃" value="${esc(miss ? '' : w.tmin ?? '')}" ${attr({ in: 'wx', k: 'tmin' })}>
        <input class="inp sm" inputmode="decimal" placeholder="최고 ℃" value="${esc(miss ? '' : w.tmax ?? '')}" ${attr({ in: 'wx', k: 'tmax' })}>
        <input class="inp sm" inputmode="decimal" placeholder="강수 mm" value="${esc(miss ? '' : w.rain ?? '')}" ${attr({ in: 'wx', k: 'rain' })}></div>
      <div class="row"><button class="lnk" data-act="wxAuto">자동값으로 되돌리기</button><span class="sp"></span><button class="lnk" data-act="wxClose">닫기</button></div>
    </div>` : '';
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="back" aria-label="뒤로">&lt;</button><h1>${editing ? '일지 수정' : '일지 쓰기'}</h1><span class="mut">* 필수</span></div>
    <div class="bd">
      <div class="fld"><label>작업일<span class="req">*</span></label>
        <div class="row"><input class="inp" type="date" style="flex:1" value="${esc(f.workDate)}" max="${todayStr()}" data-in="date">${f.workDate === todayStr() ? '<span class="tag ac">오늘</span>' : '<button class="chip" data-act="today">오늘</button>'}</div></div>
      <div class="fld"><label>하우스 동<span class="req">*</span><span class="opt">여러 개 선택 가능</span></label>
        <div class="chips">${S.profile.houses.filter(h => !h.hidden).map((h) => `<button class="chip${f.houseIds.includes(h.id) ? ' on' : ''}" ${attr({ act: 'toggleHouse', v: h.id })}>${esc(h.name)} <span class="lot">${esc(h.lot)}</span></button>`).join('')}</div></div>
      <div class="fld"><label>작목<span class="req">*</span><span class="opt">동에 맞춰 자동</span></label><div class="chips">${chips(CROPS, f.crop, 'setCrop')}</div></div>
      <div class="fld"><label>날씨<span class="opt">기상청 자동, 눌러서 수정</span></label>
        <div class="wx${miss ? ' miss' : ''}" data-act="wxToggle" style="cursor:pointer"><div class="sq">${miss ? '미수집' : esc(w.sky || '-')}</div><div class="sp"><b>${esc(w ? weatherText(w) : editing ? '미수집' : '...')}</b><div class="mut">${esc(wxSub)}</div></div><span class="lnk">수정</span></div>
        ${wxEdit}</div>
      <div class="fld"><label>작업단계<span class="req">*</span></label><div class="stg">${STAGES.map((x) => `<button class="${x === f.stage ? 'on' : ''}" ${attr({ act: 'setStage', v: x })}>${esc(x)}</button>`).join('')}</div></div>
      <div class="fld"><label>세부 작업</label><div class="chips">${tasks.length ? chips(tasks, f.task, 'setTask') : '<span class="mut">작업단계를 먼저 골라주세요</span>'}</div></div>
      ${f.task === '정식' ? `<div class="fld"><label>품종, 주수<span class="opt">선택, 보험 증빙(정식 주수)</span></label>
        <div class="row"><input class="inp sm" placeholder="품종 (예: 설향)" value="${esc(f.variety || '')}" ${attr({ in: 'fv', k: 'variety' })}><input class="inp sm" style="width:110px;flex:none" inputmode="numeric" placeholder="주수" value="${esc(f.plant_count || '')}" ${attr({ in: 'fv', k: 'plant_count' })}><span class="mut">주</span></div></div>` : ''}
      <div class="fld"><label>농약 / 비료 / 모종</label>
        ${f.materials.map((m, i) => materialCard(m, i, f.crop)).join('')}
        <button class="ghost dash" style="margin:0" data-act="addMat">+ 농약/비료/모종 추가</button></div>
      <div class="fld"><label>처리 면적<span class="opt">선택</span></label>
        <div class="row"><input class="inp sm" style="width:120px;flex:none" inputmode="decimal" placeholder="숫자" value="${esc(f.area.value)}" data-in="areaValue" ${f.area.unit === '동 전체' ? 'disabled' : ''}><div class="chips">${chips(AREA_UNITS, f.area.unit, 'areaUnit')}</div></div></div>
      <div class="fld"><label>세부작업내용<span class="opt">${S.detailEditing ? '직접 고친 문장' : '선택한 내용으로 자동 작성'}</span></label>
        ${S.detailEditing
          ? `<textarea class="inp" rows="3" data-in="detail">${esc(f.detail || autoText(S.profile, f))}</textarea><button class="lnk" data-act="detailAuto">자동 문장으로 되돌리기</button>`
          : `<div class="auto" id="autoBox">${esc(autoText(S.profile, f))}</div><button class="lnk" data-act="detailEdit">직접 고치기</button>`}</div>
      <div class="fld"><label>메모<span class="opt">키보드 음성 받아쓰기 가능</span></label><textarea class="inp" rows="2" placeholder="예: 아랫잎 위주로 방제" data-in="memo">${esc(f.memo)}</textarea></div>
      <p class="mut" style="margin-bottom:6px">빈 칸이 있어도 저장되고 "미완성"으로 표시돼요</p>
    </div>
    <div class="ftr"><button class="big sm" style="margin:0" data-act="saveRecord" ${S.busy ? 'disabled' : ''}>저장</button></div>
  </section>`;
}

function vSaved() {
  const r = S.records.find((x) => x.id === S.param);
  if (!r) return vList();
  const mis = missingFields(r);
  return `<section class="scr">
    <div class="hd"><h1>저장 완료</h1></div>
    <div class="bd white">
      <div class="done">저장됨</div>
      <h2 class="ctr" style="font-size:19px">일지를 저장했어요</h2>
      <p class="ctr t2" style="margin:8px 0 6px;line-height:1.5">${esc(r.workDate)}, ${esc(houseNames(S.profile, r.houseIds) || '동 미선택')}, ${esc(r.task || r.stage || '작업')}</p>
      <p class="ctr mut" style="margin-bottom:24px">${mis.length ? `<span class="tag inc">미완성</span> ${esc(mis.join(', '))} 빈칸 (나중에 채워도 돼요)` : '필수 항목을 모두 채웠어요'}</p>
      <button class="big sm" data-act="go" data-v="list">일지 목록 보기</button>
      <button class="ghost" data-act="newRecord">하나 더 쓰기</button>
      <button class="ghost" data-act="go" data-v="home">홈으로</button>
      <p class="mut ctr">입력 시각 ${esc(fmtDateTime(r.updatedAt || r.createdAt))} 자동 저장 (엑셀 시트2)</p>
    </div></section>`;
}

// ---------- 화면: 일지 목록 ----------
function vList() {
  const f = S.listFilter;
  let recs = S.records;
  if (f === 'inc') recs = recs.filter((r) => missingFields(r).length);
  else if (f !== 'all') recs = recs.filter((r) => r.houseIds.includes(f));
  let body = '';
  let curMonth = '';
  for (const r of recs) {
    const ym = r.workDate.slice(0, 7);
    if (ym !== curMonth) {
      curMonth = ym;
      const n = recs.filter((x) => x.workDate.startsWith(ym)).length;
      body += `<p class="month">${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월, ${n}건</p>`;
    }
    body += li(r);
  }
  const filters = [['all', '전체'], ...S.profile.houses.map((h) => [h.id, h.name]), ['inc', '미완성만']];
  return `<section class="scr">
    <div class="hd"><h1>일지</h1><button class="lnk" data-act="go" data-v="excel">엑셀 내보내기</button></div>
    <div class="bd">
      <div class="flt">${filters.map(([v, l]) => `<button class="chip${f === v ? ' on' : ''}" ${attr({ act: 'listFilter', v })}>${esc(l)}</button>`).join('')}</div>
      <div class="card" style="padding:4px 14px 8px">${body || '<p class="empty">기록이 없어요</p>'}</div>
      <div style="height:60px"></div>
    </div>
    <button class="big sm fab" data-act="newRecord">+ 일지 쓰기</button>
  </section>`;
}

// ---------- 화면: 일지 상세 ----------
function vDetail() {
  const r = S.records.find((x) => x.id === S.param);
  if (!r) return `<section class="scr"><div class="hd"><button class="bk" data-act="go" data-v="list">&lt;</button><h1>일지 상세</h1></div><div class="bd"><p class="empty">기록을 찾을 수 없어요</p></div></section>`;
  const mis = missingFields(r);
  if (isDisaster(r)) return vDisasterDetail(r, mis);
  const ed = CONFIG.features.editDelete;
  let h = '';
  if (mis.length) h += `<div class="prog inc"><span class="tag inc">미완성</span><span>${esc(mis.join(', '))} 빈칸</span><span class="sp"></span>${ed ? `<button class="lnk" ${attr({ act: 'editRecord', v: r.id })}>채우기</button>` : ''}</div>`;
  const hs = housesOf(S.profile, r.houseIds).map((x) => `${x.name}${x.lot ? ` (${x.lot})` : ''}`).join(', ');
  const w = r.weather;
  h += `<div class="card">
    <div class="kv"><span class="k">작업일</span><span class="v">${esc(r.workDate)} (${weekday(r.workDate)})</span></div>
    <div class="kv"><span class="k">하우스 동</span><span class="v">${hs ? esc(hs) : '<span class="mut">빈칸</span>'}</span></div>
    <div class="kv"><span class="k">작목</span><span class="v">${r.crop ? esc(r.crop) : '<span class="mut">빈칸</span>'}</span></div>
    <div class="kv"><span class="k">날씨</span><span class="v">${esc(weatherText(w))}${w && w.status !== 'missing' && w.rain != null ? `, 강수 ${w.rain}mm` : ''} <span class="mut">${esc(weatherSourceLabel(w))}</span></span></div>
    <div class="kv"><span class="k">작업단계</span><span class="v">${r.stage ? esc(r.stage + (r.task ? ' > ' + r.task : '')) : '<span class="mut">빈칸</span>'}</span></div>
    ${r.task === '정식' && (r.variety || r.plant_count) ? `<div class="kv"><span class="k">품종, 주수</span><span class="v">${esc([r.variety, r.plant_count ? r.plant_count + '주' : ''].filter(Boolean).join(', '))}</span></div>` : ''}
    ${r.pest_seen ? `<div class="kv"><span class="k">병해충 발견</span><span class="v">${esc(r.pest_seen)}</span></div>` : ''}
    ${r.control_target ? `<div class="kv"><span class="k">방제 대상</span><span class="v">${esc(r.control_target)}</span></div>` : ''}
    <div class="kv"><span class="k">사진 수</span><span class="v">${r.photo_count == null ? '미입력' : esc(r.photo_count + '장')}</span></div>
    ${r.area?.value || r.area?.unit === '동 전체' ? `<div class="kv"><span class="k">처리 면적</span><span class="v">${esc(r.area.unit === '동 전체' ? '동 전체' : r.area.value + r.area.unit)}</span></div>` : ''}
  </div>`;
  (r.materials || []).forEach((m) => {
    h += `<div class="card"><h3>${esc(m.kind)} ${esc(m.action)}</h3>
      <div class="kv"><span class="k">종류</span><span class="v">${m.type ? esc(m.type) : '<span class="mut">빈칸</span>'}</span></div>
      <div class="kv"><span class="k">제품명</span><span class="v">${m.name ? esc(m.name) : '<span class="mut">빈칸</span>'}</span></div>
      <div class="kv"><span class="k">양</span><span class="v">${m.qty !== '' ? esc(m.qty + ' ' + m.unit) : '<span class="mut">빈칸</span>'}</span></div>
      ${m.dilution ? `<div class="kv"><span class="k">희석배수</span><span class="v">${esc(m.dilution)}배</span></div>` : ''}
      ${m.pest ? `<div class="kv"><span class="k">대상 병해충</span><span class="v">${esc(m.pest)}</span></div>` : ''}</div>`;
  });
  h += `<div class="card"><h3>세부작업내용</h3><p style="line-height:1.5">${esc(detailOf(S.profile, r))}</p>${r.memo ? `<p class="mut" style="margin-top:6px">메모: ${esc(r.memo)}</p>` : ''}</div>`;
  if (CONFIG.features.claimCalc && S.session?.demo && S.session.uid === 'demo' && S.profile?.demo && r.demo) h += `<button class="ghost" ${attr({ act: 'claimOpen', v: r.id })}>약관 산식으로 계산해 보기</button>`;
  if (r.source_text) h += `<div class="card"><h3>대화 원문</h3><p style="line-height:1.5">"${esc(r.source_text)}"</p>${r.chat_answers ? `<p class="mut" style="margin-top:6px">되묻기에 답한 내용: ${esc(r.chat_answers)}</p>` : ""}<p class="mut" style="margin-top:6px">입력 방식: ${r.input_mode === 'chat-handoff' ? '대화 후 직접 입력' : '대화'}, 추출 ${esc(r.extract_method || '규칙')}</p></div>`;
  const editLabel = field => ({work_date:'작업일',plots:'작업한 동',crop:'작물',stage:'생육 단계',task:'작업',memo:'메모',detail:'세부 작업',detail_edited:'세부 작업',weather:'날씨',photo_count:'사진 수'})[field] || (field.startsWith('materials[') ? '자재 정보' : '기록 항목');
  if (r.editHistory?.length) h += `<div class="card"><h3>수정 이력</h3>${r.editHistory.map(entry => `<p>${esc(fmtDateTime(entry.at))}: ${esc([...new Set(entry.fields.map(editLabel))].join(', '))}</p>`).join('')}</div>`;
  h += `<div class="card" style="background:#FAFAFA"><p class="mut" style="line-height:1.6">작성 ${esc(fmtDateTime(r.createdAt))}, ${r.updatedAt ? '수정 ' + esc(fmtDateTime(r.updatedAt)) : '수정 없음'}, 작성자 ${esc(r.author || '')}${isBackfill(r) ? ', 사후입력' : ''}${r.demo ? ', 가상 데이터' : ''} (엑셀 시트2)</p></div>`;
  if (ed) h += `<button class="ghost danger" ${attr({ act: 'deleteRecord', v: r.id })}>삭제</button>`;
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="go" data-v="list" aria-label="뒤로">&lt;</button><h1>일지 상세</h1>${ed ? `<button class="lnk" ${attr({ act: 'editRecord', v: r.id })}>수정</button>` : ''}</div>
    <div class="bd">${h}</div></section>`;
}

// 피해 기록 상세 (v0.3). 작업 일지 수정 화면으로는 보내지 않음 (삭제만)
function vDisasterDetail(r, mis) {
  const ed = CONFIG.features.editDelete;
  const hs = housesOf(S.profile, r.houseIds).map((x) => `${x.name}${x.lot ? ` (${x.lot})` : ''}`).join(', ');
  const blank = '<span class="mut">빈칸</span>';
  let h = '';
  if (mis.length) h += `<div class="prog inc"><span class="tag inc">미완성</span><span>${esc(mis.join(', '))} 빈칸</span></div>`;
  h += `<div class="card dis"><div class="row" style="margin-bottom:6px"><h3 style="margin:0">피해 기록</h3><span class="tag dis">재해</span></div>
    <div class="kv"><span class="k">사고일</span><span class="v">${r.accident_date ? `<b>${esc(r.accident_date)} (${weekday(r.accident_date)})</b>${r.continuing ? ' 부터 계속' : ''}` : blank}</span></div>
    <div class="kv"><span class="k">피해 동</span><span class="v">${hs ? `<b>${esc(hs)}</b>` : blank} ${esc(r.crop || '')}</span></div>
    <div class="kv"><span class="k">재해 종류</span><span class="v">${r.cause_text || (Array.isArray(r.peril) ? r.peril.length : r.peril) ? esc(r.cause_text || (Array.isArray(r.peril) ? r.peril.join(', ') : r.peril)) : blank}</span></div>
    <div class="kv"><span class="k">시설 피해</span><span class="v">${(Array.isArray(r.facility_damage) ? r.facility_damage.length : r.facility_damage) ? esc(Array.isArray(r.facility_damage) ? r.facility_damage.join(', ') : r.facility_damage) : blank}</span></div>
    <div class="kv"><span class="k">작물 피해</span><span class="v">${r.crop_symptom ? esc(r.crop_symptom) : blank}</span></div>
    <div class="kv"><span class="k">날씨</span><span class="v">${esc(weatherText(r.weather))}</span></div>
    <div class="kv"><span class="k">접수일</span><span class="v">${r.reported_at ? esc(r.reported_at) : '아직 안 적었어요'}</span></div>
    <div class="kv"><span class="k">사진 수</span><span class="v">${r.photo_count == null ? '미입력' : esc(r.photo_count + '장')}</span></div>
    <div class="kv"><span class="k">사고 처리</span><span class="v">${r.closed ? '끝남' : '진행 중'}</span></div>
    ${r.memo ? `<div class="kv"><span class="k">메모</span><span class="v">${esc(r.memo)}</span></div>` : ''}
    <p class="photo-note">${esc(PHOTO_NOTICE)} (사진 첨부는 준비 중)</p></div>`;
  if (r.source_text) h += `<div class="card"><h3>대화 원문</h3><p style="line-height:1.5">"${esc(r.source_text)}"</p>${r.chat_answers ? `<p class="mut" style="margin-top:6px">되묻기에 답한 내용: ${esc(r.chat_answers)}</p>` : ""}</div>`;
  const editLabel = field => ({work_date:'작업일',plots:'작업한 동',crop:'작물',stage:'생육 단계',task:'작업',memo:'메모',detail:'세부 작업',detail_edited:'세부 작업',weather:'날씨',photo_count:'사진 수'})[field] || (field.startsWith('materials[') ? '자재 정보' : '기록 항목');
  if (r.editHistory?.length) h += `<div class="card"><h3>수정 이력</h3>${r.editHistory.map(entry => `<p>${esc(fmtDateTime(entry.at))}: ${esc([...new Set(entry.fields.map(editLabel))].join(', '))}</p>`).join('')}</div>`;
  h += `<div class="card" style="background:#FAFAFA"><p class="mut" style="line-height:1.6">작성 ${esc(fmtDateTime(r.createdAt))}, 작성자 ${esc(r.author || '')}${isBackfill(r) ? ', 사후입력' : ''}${r.demo ? ', 가상 데이터' : ''} (엑셀 시트3 피해 기록)</p></div>`;
  if (ed) h += `<button class="ghost danger" ${attr({ act: 'deleteRecord', v: r.id })}>삭제</button>`;
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="go" data-v="list" aria-label="뒤로">&lt;</button><h1>피해 기록 상세</h1></div>
    <div class="bd">${h}</div></section>`;
}

// ---------- 화면: 엑셀 내보내기 ----------
function excelRange() {
  const e = S.excel;
  const today = todayStr();
  if (e.period === 'month') return { from: today.slice(0, 8) + '01', to: today };
  if (e.period === 'all') {
    const dates = S.records.map((r) => r.workDate).sort();
    return { from: dates[0] || today.slice(0, 5) + '01-01', to: dates[dates.length - 1] > today ? dates[dates.length - 1] : today };
  }
  return { from: e.from || today.slice(0, 8) + '01', to: e.to || today };
}

function excelRecords() {
  const { from, to } = excelRange();
  return S.records.filter((r) => r.workDate >= from && r.workDate <= to);
}

function vExcel() {
  const { from, to } = excelRange();
  const recs = excelRecords();
  const rows = buildSheet1Rows(S.profile, recs);
  const drows = buildDisasterRows(S.profile, recs);
  const L = 'ABCDEFGHIJKLM'.split('');
  const prev = `<tr><th class="cl"></th>${L.map((l) => `<th class="cl">${l}</th>`).join('')}</tr>
    <tr><td class="cl">1</td>${EXCEL_HEADERS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
    ${rows.slice(0, 6).map((r, i) => `<tr><td class="cl">${i + 2}</td>${r.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
    ${rows.length > 6 ? `<tr><td class="cl">...</td><td colspan="13" class="mut">총 ${rows.length}행</td></tr>` : ''}`;
  const p = S.excel.period;
  const share = canShareFile();
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="go" data-v="home" aria-label="뒤로">&lt;</button><h1>증빙 엑셀 내보내기</h1></div>
    <div class="bd">
      <div class="fld"><label>기간</label>
        <div class="seg">${[['month', '이번 달'], ['all', '영농기간 전체'], ['custom', '직접 선택']].map(([v, l]) => `<button class="${p === v ? 'on' : ''}" ${attr({ act: 'excelPeriod', v })}>${l}</button>`).join('')}</div>
        ${p === 'custom' ? `<div class="dates"><label class="fld">시작일<input class="inp" type="date" value="${esc(from)}" data-in="xFrom"></label><label class="fld">종료일<input class="inp" type="date" value="${esc(to)}" data-in="xTo"></label></div>` : ''}
        <p class="mut" style="margin-top:6px">${esc(from)} ~ ${esc(to)}, 기록 ${recs.length}건, 자재 행 포함 ${rows.length}행, 피해 기록 ${drows.length}건</p></div>
      <div class="card">
        <h3>표준 영농기록장 양식 (농식품부 공익직불제)</h3>
        <div class="chk"><b>1</b>시트1: 표준 영농기록장 순서 A~M열<br><b>2</b>1행은 머리글만, 셀 병합 없음<br><b>3</b>날짜는 날짜 형식, 빈 값은 0이 아닌 빈칸<br><b>4</b>농약, 비료는 자재마다 1행<br><b>5</b>시트2: 작성, 수정 시각, 사후입력 여부 (증빙 신뢰도)<br><b>6</b>시트3: 피해 기록 (사고일, 피해 원인, 피해 동, 시설, 작물 피해, 원문)<br><b>7</b>시트4: 기록 모아보기 (점수, 작기, 요인, 빠진 기록, 피해 기록과 고지)</div>
      </div>
      <p class="mut">기록 모아보기는 선택 기간과 관계없이 전체 기록을 기준으로 만들어요.</p><fieldset class="card"><legend>포함할 시트</legend>${['영농기록장', '증빙정보', '피해 기록', '기록 모아보기'].map((name, i) => `<label class="record-choice"><input type="checkbox" data-sheet="${i}" ${S.excel.sheets[i] ? 'checked' : ''}> ${name}</label>`).join('')}</fieldset>
      <div class="fld"><label>미리보기 (시트1)</label><div class="xlw"><table class="xl">${prev}</table></div></div>
      <div class="card" style="background:#FAFAFA"><div class="mut">파일 이름</div><b style="font-size:13px;word-break:break-all">${esc(fileName(S.profile, from, to))}</b></div>
    </div>
    <div class="ftr">
      ${from > to ? '<p role="alert">시작일이 종료일보다 늦어요</p>' : !recs.length ? '<p>이 기간에 기록이 없어요. 빈 양식으로 받을까요?</p>' : ''}
      <button class="big sm" style="margin:0" data-act="downloadXlsx" ${!S.busy && from <= to ? '' : 'disabled'}>${S.busy ? '만드는 중' : recs.length ? '엑셀 다운로드 (.xlsx)' : '빈 양식 받기'}</button>
      ${share ? `<button class="ghost" style="margin:8px 0 0" data-act="shareXlsx" ${recs.length ? '' : 'disabled'}>휴대폰 공유로 보내기</button>` : ''}
    </div></section>`;
}

// ---------- 화면: 증빙 / 지원금 (준비 중 목업) ----------
function vProof() {
  return `<section class="scr">
    <div class="hd"><h1>증빙</h1><span class="tag">준비 중, P1</span></div>
    <div class="bd">
      <span class="mkb">준비 중, MVP(11/23)에서는 목업 화면</span>
      <div class="card ovl"><h3>증빙 완성도 (직불 점검 항목)</h3><div class="bar"><i style="width:72%"></i></div><p class="mut" style="margin-top:6px">구매, 사용 내역, 경운, 수확, 판매</p></div>
      <div class="card ovl"><h3>작기 관리</h3><p class="mut">정식일, 수확개시일, 면적, 주수</p></div>
      <div class="card ovl"><h3>수확과 출하 기록</h3><p class="mut">일자, 동, 수량, 판매처</p></div>
      <div class="card ovl"><h3>영수증 보관함</h3><div class="row"><div class="ph" style="width:70px;height:70px">사진</div><div class="ph" style="width:70px;height:70px">사진</div><div class="ph" style="width:70px;height:70px">사진</div></div></div>
      <div class="card ovl"><h3>피해 기록, 보험 증빙 묶음 내보내기</h3><p class="mut">재해 일시, 종류, 피해 동, 사진, 기간 일지 묶음</p></div>
    </div></section>`;
}

function vSupport() {
  return `<section class="scr">
    <div class="hd"><h1>지원금</h1><span class="tag">준비 중, P1</span></div>
    <div class="bd">
      <span class="mkb">준비 중, MVP(11/23)에서는 목업 화면</span>
      <div class="card ovl"><h3>조건 입력 3단계</h3><div class="step" style="justify-content:flex-start"><i class="on"></i><i></i><i></i></div><p class="mut">시군구 → 나이, 경력 → 작목</p></div>
      <div class="card ovl"><div class="row"><b>청년농 시설 지원 (예시)</b><span class="sp"></span><span class="tag ac">가능성 높음</span></div><p class="mut" style="margin-top:4px">마감 D-12, 구비서류 4종</p></div>
      <div class="card ovl"><div class="row"><b>스마트팜 보급 (예시)</b><span class="sp"></span><span class="tag">확인 필요</span></div></div>
      <div class="card ovl"><div class="row"><b>귀농 정착 지원 (예시)</b><span class="sp"></span><span class="tag">해당 안 될 가능성</span></div></div>
      <div class="card ovl"><h3>신청 가이드</h3><p class="mut">공식 신청처(농업e지, 정부24)로 이동. 신청은 농민이 직접 해요</p></div>
    </div></section>`;
}

// ---------- 화면: 내 농장 ----------
function vMe() {
  const p = S.profile;
  const hasDemo = S.records.some((r) => r.demo);
  return `<section class="scr">
    <div class="hd"><button class="bk" data-act="go" data-v="home" aria-label="뒤로">&lt;</button><h1>내 농장</h1></div>
    <div class="bd">
      <div class="card"><h3>프로필</h3>
        <div class="kv"><span class="k">이름</span><span class="v">${esc(p.name)}</span></div>
        <div class="kv"><span class="k">이메일</span><span class="v">${esc(S.session.email)}</span></div>
        <div class="kv"><span class="k">농장</span><span class="v">${esc(p.farmName)}</span></div>
        <div class="kv"><span class="k">위치</span><span class="v">${esc(p.location)}</span></div></div>
      <div class="card"><h3>하우스 동</h3>${p.houses.map((h) => `<div class="kv"><span class="k">${esc(h.name)}</span><span class="v">${esc(h.lot)} <span class="tag ac">${esc(h.crop)}</span>${h.area ? ` <span class="mut">${esc(h.area)}㎡</span>` : ''}</span></div>`).join('')}</div>
      <button class="ghost" data-act="fieldEnter">현장 모드 켜기</button><button class="ghost" data-act="go" data-v="farm">재배 면적과 주수</button>
      <button class="ghost" data-act="go" data-v="insurance">보험 정보</button>
      <button class="ghost" data-act="editSetup">하우스 동, 작목 관리</button>
      ${S.session?.demo && p.demo ? `<div class="card"><h3>시연 시나리오</h3><p class="mut">가상 기록을 바꾸고 홈에서 결과를 확인해요.</p><div class="chips">${Object.entries(DEMO_SCENARIOS).map(([key,label])=>`<button class="chip" data-act="homeScenario" data-v="${esc(key)}">${esc(label)}</button>`).join('')}</div></div>` : ''}
      ${CONFIG.features.demoData ? (hasDemo
        ? '<button class="ghost" data-act="removeDemo">가상 데모 일지 지우기</button>'
        : '<button class="ghost" data-act="addDemo">가상 데모 일지 넣기 (20건)</button>') : ''}
      ${S.installEvt ? '<button class="ghost" data-act="install">홈 화면에 설치</button>' : ''}
      <button class="ghost danger" data-act="logout">로그아웃</button><div id="logout-confirm" hidden role="alert"><p>로그아웃할까요?</p><button class="ghost" data-act="logoutCancel">계속 사용하기</button><button class="ghost danger" data-act="logoutConfirm">로그아웃하기</button></div>
      <p class="mut ctr" style="margin-top:10px">농사 처방 v${APP_VERSION}, 저장소 ${esc(CONFIG.storage)}, 로그인 ${esc(CONFIG.auth)}, 날씨 ${esc(CONFIG.weather)}</p>
    </div></section>`;
}

// ---------- 렌더 ----------
const VIEWS = { login: vLogin, sent: vSent, setup: vSetup, home: vHome, chat: () => { getAgent(); return vChat(S); }, write: vWrite, saved: vSaved, list: vList, detail: vDetail, excel: vExcel, proof: vProof, support: vSupport, me: vMe };

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [route, param] = h.split('/');
  return { route: route || '', param: param ? decodeURIComponent(param) : null };
}

function guard(route) {
  if (!S.session) return route === 'sent' || route === 'info' ? route : 'login';
  if (!S.profile) return route === 'info' ? 'info' : 'setup';
  if ((!VIEWS[route] && !getView(route)) || route === 'login' || route === 'sent') return 'home';
  if (route === 'home' && S.profile.settings?.field_mode) return 'field';
  return route;
}

function render() {
  const { route, param } = parseHash();
  const r = guard(route);
  if (r !== route) {
    location.replace('#/' + r);
    return;
  }
  if (S.route !== r) {
    if (S.route === 'accident' && r !== 'accident') S.accidentDraft = null;
    if (S.route === 'claim' && r !== 'claim') S.claim = null;
    if (r !== 'write') S.form = r === 'saved' ? S.form : null;
    if (r !== 'setup') { S.setup = null; S.setupErr = ''; }
  }
  S.route = r;
  S.param = param;
  // 화면 모듈이 있으면 기존 화면보다 우선(예: 홈은 home.js 준비도 화면)
  const mod = getView(r);
  $app.innerHTML = layout(mod ? mod.render(viewCtx()) : VIEWS[r](), r);
  if (r === 'claim') { $app.querySelectorAll('label:has([data-claim-source]) input, label:has([data-claim-source]) select').forEach(el => updateClaimSource(el, S.claim?.input)); updateClaimButton(); }
  if (r === 'chat' && !S.keepScroll) {
    const b = document.getElementById('chatBd');
    if (b) b.scrollTop = b.scrollHeight;
  }
}

function renderKeep() {
  const bd = $app.querySelector('.bd');
  const top = bd ? bd.scrollTop : 0;
  S.keepScroll = true;
  try { render(); } finally { S.keepScroll = false; }
  const bd2 = $app.querySelector('.bd');
  if (bd2) bd2.scrollTop = top;
}

// ---------- 대화 ----------
async function talk(text, label) {
  const ag = getAgent();
  S.agentEdit = '';
  if (S.route !== 'chat') location.hash = '#/chat';
  const p = ag.send(text, label);
  render();
  let res;
  try {
    res = await p;
  } catch (err) {
    // 대화 처리 중 오류가 나도 "정리하는 중"에 멈추지 않게 다시 그리고 직접 입력을 안내
    console.error(err);
    render();
    toast('처리하지 못했어요. 직접 입력으로 기록해 주세요');
    return;
  }
  if (res?.action === 'saved') await reload();
  if (res?.action === 'handoff') return handoffTo(res.form);
  if (res?.action === 'go') { render(); setTimeout(() => go(res.to), 500); return; }
  render();
}

function handoffTo(form) {
  S.form = form;
  S.wxEdit = false;
  S.detailEditing = false;
  if (!S.form.weather) loadFormWeather();
  toast('대화에서 알아낸 값을 채워 뒀어요');
  go('write');
}

// 기록을 다시 읽는다. 홈의 "바뀐 이유"를 위해 읽기 전 준비도를 S.readinessPrev에 둔다(처음 읽을 때와 시나리오 교체 때는 비움)
async function reload(opts = {}) {
  const before = S.recordsLoaded && S.profile && !opts.resetPrev
    ? computeReadiness({ profile: S.profile, records: S.records, today: todayStr(), alerts: S.alerts ?? null })
    : null;
  S.records = S.session && S.profile ? await S.store.listRecords(S.session.uid) : [];
  S.readinessPrev = before;
  S.recordsLoaded = true;
  await loadAlerts();
}

// 준비도 R-14용 기상특보. 마지막 피해 기록의 사고일 전후 1일
// - 사고와 조회 범위가 연결되지 않은 기존 시연 특보는 쓰지 않는다.
// - 그 밖에는 특보 어댑터(js/weather/alerts.js, Codex). 못 불러오면 null(모름), 특보 없음과 구분
async function loadAlerts() {
  const request = S.alertRequestSeq = (S.alertRequestSeq || 0) + 1;
  const d = S.profile ? latestDisaster({ records: S.records }) : null;
  if (!d || !d.accident_date) { S.alerts = []; return; }
  // 현재 어댑터는 가상 자료만 제공한다. 실제 농장의 사고에는 결과를 적용하지 않는다.
  if (!S.session?.demo || !S.profile?.demo || !d.demo) { S.alerts = null; return; }
  const sigungu = (S.profile.location || '').split(/\s+/).find((w) => /(군|시|구)$/.test(w)) || '';
  const t = Date.parse(d.accident_date + 'T00:00:00Z');
  if (!sigungu || !Number.isFinite(t)) { S.alerts = null; return; }
  const day = (n) => new Date(t + n * 86400000).toISOString().slice(0, 10);
  if (day(0) !== d.accident_date) { S.alerts = null; return; }
  const from=day(-1), to=day(1), demo=demoAlertItems(d,S.profile,from,to);
  if (demo !== null) { S.alerts=demo; return; }
  S.alerts = null;
  try { const alerts=await getAlerts({ sigungu, from, to }); const current=latestDisaster({ records:S.records }); if (S.alertRequestSeq===request && S.session?.demo && S.profile?.demo && current?.demo && current.id===d.id && current.accident_date===d.accident_date) S.alerts=alerts; } catch (e) { if (S.alertRequestSeq===request) S.alerts = null; }
}

// ---------- 동작 ----------
async function seedDemo() {
  const recs = buildDemoRecords(S.profile, S.profile.name, S.session.email);
  await S.store.saveRecordsBulk(S.session.uid, recs);
  await reload();
}

const ACTIONS = {
  go: (el) => go(el.dataset.v),
  back: () => history.length > 1 ? history.back() : go('home'),

  async sendLink() {
    const email = document.getElementById('email').value.trim();
    if (!isValidEmail(email)) {
      S.loginErr = '이메일 주소를 확인해 주세요';
      return render();
    }
    S.loginErr = '';
    try {
      await auth.sendLink(email);
      go('sent');
    } catch (e) {
      S.loginErr = '메일을 보내지 못했어요: ' + e.message;
      render();
    }
  },
  async resend() {
    const email = auth.getPendingEmail();
    if (email) await auth.sendLink(email);
    toast(CONFIG.auth === 'demo' ? '링크를 다시 보냈어요 (시연)' : '링크를 다시 보냈어요');
  },
  async completeDemoLink() {
    S.session = await auth.completeDemoLink();
    S.profile = await S.store.getProfile(S.session.uid);
    await reload();
    go(S.profile ? 'home' : 'setup');
  },
  async demoAccount() {
    S.session = await auth.demoAccount();
    S.store = await getDemoStore();
    const sc = buildDemoScenario('ga');
    await S.store.clearAll(S.session.uid);
    S.profile = await S.store.saveProfile(S.session.uid, { ...sc.profile, settings: { ...(sc.profile.settings || {}), field_mode: false } });
    S.field = null;
    S.readinessPrev = null;
    resetDemoNews();
    await reload({ resetPrev: true });
    go('home');
  },
  logout() { const box = document.getElementById('logout-confirm'); if (box) box.hidden = false; },
  logoutCancel() { const box = document.getElementById('logout-confirm'); if (box) box.hidden = true; },
  async logoutConfirm() {
    await auth.signOut();
    S.store = await getStore();
    S.agent = null;
    S.session = null;
    S.profile = null;
    S.records = [];
    go('login');
  },

  // 설정
  addHouse() {
    const d = setupDraft();
    const n = d.houses.length + 1;
    d.houses.push({ id: 'h' + Date.now().toString(36), name: `${n}동`, lot: '', crop: d.houses[d.houses.length - 1]?.crop || '토마토' });
    renderKeep();
  },
  rmHouse(el) {
    const houses = setupDraft().houses, i = Number(el.dataset.i), house = houses[i];
    if (!house || house.hidden || houses.filter(h => !h.hidden).length <= 1) return;
    if (S.records.some(r => (r.houseIds || []).includes(house.id))) house.hidden = true;
    else houses.splice(i, 1);
    renderKeep();
  },
  restoreHouse(el) {
    const house = setupDraft().houses[Number(el.dataset.i)];
    if (house) house.hidden = false;
    renderKeep();
  },
  houseCrop(el) {
    setupDraft().houses[Number(el.dataset.i)].crop = el.dataset.v;
    renderKeep();
  },
  async fillDemoFarm() {
    S.setup = JSON.parse(JSON.stringify(DEMO_PROFILE));
    await ACTIONS.saveSetup(null, true);
  },
  async saveSetup(_el, withDemo = false) {
    const d = setupDraft();
    d.houses.forEach((h) => { h.name = h.name.trim(); h.lot = h.lot.trim(); h.area = String(h.area || '').replace(/[^\d.]/g, ''); });
    const errs = [];
    if (!d.name?.trim()) errs.push('이름');
    if (!d.farmName?.trim()) errs.push('농장 이름');
    if (!d.location?.trim()) errs.push('농장 위치');
    if (!d.houses.some(h => !h.hidden) || d.houses.some((h) => !h.name || !h.crop)) errs.push('하우스 동 이름, 작목');
    if (new Set(d.houses.map((h) => h.name)).size !== d.houses.length) errs.push('동 이름 중복');
    if (errs.length) {
      S.setupErr = errs.join(', ') + ' 을(를) 확인해 주세요';
      return renderKeep();
    }
    const first = !S.profile;
    S.profile = await S.store.saveProfile(S.session.uid, { ...(S.profile || {}), ...d, name: d.name.trim(), farmName: d.farmName.trim(), location: d.location.trim() });
    S.setup = null;
    if (withDemo) await seedDemo();
    await reload();
    toast(first ? '농장을 등록했어요' : '저장했어요');
    go(first ? 'home' : 'me');
  },
  editSetup() {
    S.setup = null;
    go('setup');
  },
  async addDemo() {
    await seedDemo();
    toast('가상 데모 일지 20건을 넣었어요');
    render();
  },
  async removeDemo() {
    if (!confirm('가상 데모 일지를 모두 지울까요? 직접 쓴 일지는 남아요')) return;
    await S.store.deleteDemoRecords(S.session.uid);
    await reload();
    toast('가상 데모 일지를 지웠어요');
    render();
  },
  async install() {
    if (!S.installEvt) return;
    S.installEvt.prompt();
    await S.installEvt.userChoice;
    S.installEvt = null;
    render();
  },

  // 대화로 기록하기
  async chatSend() {
    const el = document.getElementById('chatInput');
    const t = ((el && el.value) || S.chatText || '').trim();
    if (!t) { el && el.focus(); return; }
    S.chatText = '';
    await talk(t);
  },
  async agQuick(el) {
    await talk(el.dataset.v, el.dataset.l);
  },
  agEdit(el) {
    S.agentEdit = el.dataset.k || '';
    renderKeep();
  },
  agSet(el) {
    getAgent().setField(el.dataset.k, el.dataset.v);
    if (/remove$/.test(el.dataset.k)) S.agentEdit = '';
    renderKeep();
  },
  async agSave() {
    await talk('__save', '저장');
  },
  agForm() {
    handoffTo(getAgent().toForm());
  },
  async demoTalk(el) {
    const d = DEMO_TALKS[Number(el.dataset.v)];
    if (!d) return;
    for (const t of d.texts) await talk(t);
  },
  // 마이크: Web Speech API(ko-KR) 있으면 사용, 없으면 키보드 받아쓰기 안내
  mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast('이 브라우저는 음성 인식을 지원하지 않아요. 키보드 받아쓰기를 써주세요 (키보드의 마이크 버튼)');
      document.getElementById('chatInput')?.focus();
      return;
    }
    // 농민이 직접 멈춘 것은 실패로 세지 않는다(Codex 34986ef 재현: 멈춤 뒤 오류 없는 종료가 실패로 세임)
    if (S.recog) { S.recog.__manualStop = true; S.recog.stop(); return; }
    // 두 번 실패한 뒤에는 음성을 쉬고 글로 쓰기를 권한다(U-10). 다시 누르면 한 번 더 시도할 수 있다.
    if (S.voice.off) {
      S.voice = newVoiceState();
      toast('글로 쓰시는 게 더 빨라요. 그래도 다시 들을게요');
    }
    const r = new SR();
    r.lang = 'ko-KR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    // 이벤트 처리는 voice.js wireRecognition (시험 runWireTests). 받아쓴 글은 입력창에만 채운다.
    // 농민이 확인하고 [보내기]를 눌러야 전송된다(기획서 U-09, 계약 v1 S-5).
    wireRecognition(r, {
      getVoice: () => S.voice,
      setVoice: (v) => { S.voice = v; },
      notify: (n) => toast(n),
      focusInput: () => document.getElementById('chatInput')?.focus(),
      appendText: (t) => {
        const el = document.getElementById('chatInput');
        const prev = ((el && el.value) || S.chatText || '').trim();
        S.chatText = prev ? `${prev} ${t}` : t;
        if (el) { el.value = S.chatText; el.focus(); }
      },
      onEnd: () => { S.recog = null; S.listening = false; renderKeep(); },
    });
    S.recog = r;
    S.listening = true;
    try { r.start(); } catch (e) { S.recog = null; S.listening = false; toast('키보드 받아쓰기를 써주세요'); }
    renderKeep();
  },

  // 일지 쓰기
  newRecord() {
    S.form = null;
    go('write');
  },
  editRecord(el) {
    S.form = null;
    go('write/' + el.dataset.v);
  },
  today() {
    S.form.workDate = todayStr();
    if (S.form.weather?.source !== 'manual') { S.form.weather = null; loadFormWeather(); }
    renderKeep();
  },
  toggleHouse(el) {
    const f = S.form;
    const id = el.dataset.v;
    f.houseIds = f.houseIds.includes(id) ? f.houseIds.filter((x) => x !== id) : [...f.houseIds, id];
    if (!f.cropManual) {
      const c = cropOf(S.profile, f.houseIds);
      if (c && c !== f.crop) {
        f.crop = c;
        if (!(tasksFor(c)[f.stage] || []).includes(f.task)) f.task = '';
      }
    }
    renderKeep();
  },
  setCrop(el) {
    S.form.crop = el.dataset.v;
    S.form.cropManual = true;
    if (!(tasksFor(S.form.crop)[S.form.stage] || []).includes(S.form.task)) S.form.task = '';
    renderKeep();
  },
  setStage(el) {
    const f = S.form;
    f.stage = el.dataset.v;
    const T = tasksFor(f.crop)[f.stage] || [];
    f.task = T.length === 1 ? T[0] : '';
    renderKeep();
  },
  setTask(el) {
    S.form.task = S.form.task === el.dataset.v ? '' : el.dataset.v;
    renderKeep();
  },
  addMat() {
    const last = S.form.materials[S.form.materials.length - 1];
    S.form.materials.push(newMaterial(last ? last.kind : (S.form.task === '병해충 방제' ? '농약' : '비료')));
    renderKeep();
  },
  rmMat(el) {
    S.form.materials.splice(Number(el.dataset.i), 1);
    renderKeep();
  },
  matKind(el) {
    const i = Number(el.dataset.i);
    if (S.form.materials[i].kind === el.dataset.v) return;
    const a = S.form.materials[i].action;
    S.form.materials[i] = { ...newMaterial(el.dataset.v), action: a };
    renderKeep();
  },
  matSet(el) {
    const m = S.form.materials[Number(el.dataset.i)];
    m[el.dataset.k] = el.dataset.v;
    if (el.dataset.k === 'action' && el.dataset.v === '구입') { m.dilution = ''; m.pest = ''; }
    renderKeep();
  },
  matToggle(el) {
    const m = S.form.materials[Number(el.dataset.i)];
    m[el.dataset.k] = m[el.dataset.k] === el.dataset.v ? '' : el.dataset.v;
    renderKeep();
  },
  areaUnit(el) {
    S.form.area.unit = el.dataset.v;
    if (el.dataset.v === '동 전체') S.form.area.value = '';
    renderKeep();
  },
  wxToggle() {
    S.wxEdit = !S.wxEdit;
    renderKeep();
  },
  wxClose() {
    S.wxEdit = false;
    renderKeep();
  },
  wxSky(el) {
    const w = S.form.weather && S.form.weather.status !== 'missing' ? S.form.weather : { ...missingWeather(), tmin: null, tmax: null, rain: null };
    S.form.weather = { ...w, status: 'ok', sky: el.dataset.v, source: 'manual', reason: '' };
    renderKeep();
  },
  async wxAuto() {
    S.form.weather = null;
    S.wxEdit = false;
    renderKeep();
    await loadFormWeather();
  },
  detailEdit() {
    S.form.detail = autoText(S.profile, S.form);
    S.form.detailEdited = true;
    S.detailEditing = true;
    renderKeep();
  },
  detailAuto() {
    S.form.detail = '';
    S.form.detailEdited = false;
    S.detailEditing = false;
    renderKeep();
  },
  async saveRecord() {
    if (S.busy) return;
    const f = S.form;
    S.busy = true;
    try {
      const rec = {
        ...f,
        weather: f.weather || (f.id ? null : missingWeather('미수집')),
        materials: f.materials.map((m) => ({ ...m, qty: String(m.qty ?? '').trim() })),
        detail: f.detailEdited ? f.detail : autoText(S.profile, f),
        author: f.author || S.profile.name,
        authorEmail: f.authorEmail || S.session.email,
        location: S.profile.location,
        demo: !!f.demo,
      };
      rec.missing = missingFields(rec);
      const saved = await S.store.saveRecord(S.session.uid, rec);
      await reload();
      S.form = null;
      go('saved/' + saved.id);
    } catch (e) {
      toast('저장하지 못했어요: ' + e.message);
    } finally {
      S.busy = false;
    }
  },

  // 목록, 상세
  openDetail(el) {
    go('detail/' + el.dataset.v);
  },
  listFilter(el) {
    S.listFilter = el.dataset.v;
    renderKeep();
  },
  listInc() {
    S.listFilter = 'inc';
    go('list');
  },
  async deleteRecord(el) {
    if (!confirm('이 일지를 삭제할까요? 되돌릴 수 없어요')) return;
    await S.store.deleteRecord(S.session.uid, el.dataset.v);
    await reload();
    toast('삭제했어요');
    go('list');
  },

  // 엑셀
  excelPeriod(el) {
    S.excel.period = el.dataset.v;
    if (el.dataset.v === 'custom' && !S.excel.from) {
      const r = excelRange();
      S.excel.from = r.from;
      S.excel.to = r.to;
    }
    renderKeep();
  },
  async downloadXlsx() {
    await makeXlsx(false);
  },
  async shareXlsx() {
    await makeXlsx(true);
  },
};

async function makeXlsx(share) {
  const { from, to } = excelRange();
  const recs = excelRecords();
  if (from > to) return toast('시작일이 종료일보다 늦어요');
  const sheets = [...document.querySelectorAll('[data-sheet]')].map(el => el.checked);
  if (!sheets.some(Boolean)) return toast('시트를 하나 이상 골라 주세요');
  S.excel.sheets = sheets;
  S.busy = true;
  renderKeep();
  try {
    // 증빙 엑셀에 준비도 요약 시트(M-08). 점수는 전체 기록 기준(기간과 무관)
      const blob = await buildWorkbook(S.profile, S.session, recs, viewCtx().readiness, sheets, S.records);
    const name = fileName(S.profile, from, to);
    if (share) await shareBlob(blob, name);
    else downloadBlob(blob, name);
    S.lastExport = { name, size: blob.size, rows: buildSheet1Rows(S.profile, recs).length, at: new Date().toISOString() };
    window.__lastExport = S.lastExport;
    toast('다 만들었어요');
  } catch (e) {
    if (e.name !== 'AbortError') toast('엑셀을 만들지 못했어요: ' + e.message);
  } finally {
    S.busy = false;
    renderKeep();
  }
}

// 입력값 (다시 그리지 않고 상태만 갱신해 커서 유지)
function onInput(e) {
  const el = e.target;
  if (S.route === 'claim') { updateClaimSource(el, S.claim?.input); updateClaimButton(); }
  if (el.dataset.sheet !== undefined) { S.excel.sheets[Number(el.dataset.sheet)] = el.checked; return; }
  const k = el.dataset.in;
  if (!k) return;
  const v = el.value;
  if (k === 'chat') { S.chatText = v; return; }
  if (k === 'ag') { getAgent().setField(el.dataset.k, v, true); return; }
  if (k === 'setup') setupDraft()[el.dataset.k] = v;
  else if (k === 'house') setupDraft().houses[Number(el.dataset.i)][el.dataset.k] = v;
  else if (k === 'mat') S.form.materials[Number(el.dataset.i)][el.dataset.k] = v;
  else if (k === 'fv') S.form[el.dataset.k] = v;
  else if (k === 'memo') S.form.memo = v;
  else if (k === 'detail') S.form.detail = v;
  else if (k === 'areaValue') S.form.area.value = v.trim();
  else if (k === 'wx') {
    const w = S.form.weather && S.form.weather.status !== 'missing' ? S.form.weather : { ...missingWeather(), sky: '' };
    const n = v.trim() === '' ? null : Number(v);
    S.form.weather = { ...w, status: 'ok', [el.dataset.k]: Number.isFinite(n) ? n : null, source: 'manual', reason: '' };
    const only = S.form.weather;
    if (!only.sky && only.tmin == null && only.tmax == null && only.rain == null) S.form.weather = missingWeather('직접 비움 (미수집)');
  }
  const box = document.getElementById('autoBox');
  if (box && S.form) box.textContent = autoText(S.profile, S.form);
}

function onChange(e) {
  const el = e.target;
  if (S.route === 'claim') { updateClaimSource(el, S.claim?.input); updateClaimButton(); }
  const k = el.dataset.in;
  if (k === 'date') {
    S.form.workDate = el.value || todayStr();
    if (S.form.weather?.source !== 'manual') {
      S.form.weather = null;
      loadFormWeather();
    }
    renderKeep();
  } else if (k === 'agDate') {
    getAgent().setField('workDate', el.value);
    renderKeep();
  } else if (k === 'xFrom' || k === 'xTo') {
    S.excel[k === 'xFrom' ? 'from' : 'to'] = el.value;
    renderKeep();
  } else if (k === 'wx') {
    renderKeep();
  }
}

$app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const reg = ACTIONS[el.dataset.act] ? null : getAction(el.dataset.act);
  const fn = ACTIONS[el.dataset.act] || (reg && ((x) => reg.fn(x, viewCtx())));
  if (!fn) return;
  e.preventDefault();
  try {
    await fn(el);
  } catch (err) {
    console.error(err);
    toast('오류: ' + err.message);
  }
});
$app.addEventListener('input', onInput);
$app.addEventListener('change', onChange);
$app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'email') ACTIONS.sendLink();
  // 한글 조합 중(IME) Enter 는 무시
  if (e.key === 'Enter' && e.target.id === 'chatInput' && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    ACTIONS.chatSend().catch((err) => toast('오류: ' + err.message));
  }
});
window.addEventListener('hashchange', render);
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  S.installEvt = e;
});

// ---------- 시작 ----------
async function start() {
  registerAllViews(Object.keys(ACTIONS)); // 화면 모듈의 action 이름이 기존 ACTIONS와 겹치면 시작 때 바로 알림
  try { S.store = await getStore(); } catch (e) {
    console.error(e);
    $app.innerHTML = '<section class="scr"><div class="bd"><h1>앱 설정을 확인해 주세요</h1><p>저장소를 준비하지 못했어요. 관리자에게 알려 주세요.</p></div></section>';
    return;
  }
  try {
    S.session = await auth.init();
  } catch (e) {
    console.error(e);
    S.session = CONFIG.auth === 'firebase' ? null : auth.getSession();
  }
  if (S.session?.demo && S.session.provider === 'demo-account') S.store = await getDemoStore();
  if (S.session) {
    try {
      S.profile = await S.store.getProfile(S.session.uid);
      await reload();
    } catch (e) {
      console.error(e);
      $app.innerHTML = '<section class="scr"><div class="bd"><h1>기록을 불러오지 못했어요</h1><p>저장된 자료를 확인할 수 없어 화면을 열지 않았어요. 자료를 지우지 말고 관리자에게 알려 주세요.</p></div></section>';
      return;
    }
  }
  S.todayWx = await getWeather(todayStr(), S.profile);
  render();
  if (CONFIG.features.pwa && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW 등록 실패', e));
  }
}

start();
