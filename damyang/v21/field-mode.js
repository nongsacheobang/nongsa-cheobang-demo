// 261127 허간 결정: 현장 모드를 다시 만들었다.
//  - 켜면 홈 화면 전체(머리·하단 탭·새참이 버튼 포함)가 현장 화면으로 바뀐다. 기록·피해 화면에 다녀와도 홈으로 오면 현장 화면이 다시 나온다.
//  - 끄기는 현장 화면 위쪽 '끄기'. 켬/끔은 이 기기에 저장한다.
//  - 근거: 효신 13·14(현장에서 큰 버튼 몇 개로 사진·메모), 효신 목업 '농작업 현장' 화면. 허간: "엄청 심플하게", "촌스러운 배경색 지양".
//  - 예전 방식(앱 전체 125% 확대, 화면 머리 스위치, shell.js fieldHome)은 쓰지 않는다: FarmField.enabled 는 늘 false, switchMarkup 은 빈 문자열.
//  - 사진 찍기·메모 쓰기는 flow.js 의 [data-field-entry] 처리기를 그대로 쓴다(기록 화면을 채워 연다). 저장 로직은 바꾸지 않는다.
(() => {
  'use strict';
  const root = document.documentElement;
  const NS = window.FarmTrial?.ns || 'damyang-public-v21-';
  const KEY = NS + 'field-on';
  root.classList.remove('field-mode');
  try { localStorage.removeItem(NS + 'field-mode'); } catch { /* 예전 확대 값은 쓰지 않는다. */ }

  let on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch { /* 이번 방문 동안만 기억한다. */ }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const svg = d => `<svg class="fm-ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
    memo: svg('<path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 7l4 4" stroke="currentColor" stroke-width="1.8"/>'),
    alert: svg('<path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    arrow: svg('<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    down: svg('<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  };
  // shell.js go()는 pushState로 화면을 바꿔 hashchange가 나지 않는다. 실제 그려진 화면(body[data-screen])을 기준으로 삼는다.
  // 앱 홈(shell.js가 data-screen="home"을 그린 때)에서만 현장 화면을 띄운다. 보험 화면(estimate) 등 다른 페이지에서는 띄우지 않는다.
  const isHome = () => document.body?.dataset.screen === 'home' && !!document.getElementById('main-area');
  // 다른 페이지(보험 화면 위 막대 등)에 붙이는 진입 버튼. 누르면 현장 모드를 켜고 앱 홈으로 간다.
  // data-field-href 가 있으면 그 주소로, 없으면 ../index.html(같은 주소 조건 유지)#home 으로 간다.
  const entryMarkup = (href = '') => `<button type="button" class="field-entry" data-field-open${href ? ` data-field-href="${esc(href)}"` : ''}>현장 모드</button>`;
  const APP = ['bar', 'main-area', 'mobile-nav', 'sidebar'];

  function todayTask(ctx, rows) {
    try { return (window.FarmSaecham?.briefing?.(ctx, rows) || []).find(t => !t.done) || null; } catch { return null; }
  }
  function latestOwn(rows) {
    return rows.filter(r => !r.sample && Number.isFinite(Date.parse(r.created)))
      .sort((a, b) => Date.parse(b.created) - Date.parse(a.created))[0] || null;
  }
  function html() {
    const flow = window.FarmFlow;
    const ctx = flow?.context?.() || {};
    const rows = flow?.records?.() || [];
    const task = todayTask(ctx, rows);
    const last = latestOwn(rows);
    const md = d => d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : '';
    const today = new Intl.DateTimeFormat('ko-KR', {month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul'}).format(new Date());
    return `<div class="fm-inner">
      <div class="fm-top"><span class="fm-badge"><i aria-hidden="true"></i>현장 모드</span>
        <button type="button" class="fm-off" data-fm-off>끄기</button></div>
      <p class="fm-date">${esc(today)}</p>
      <h1 id="fm-title" class="fm-sr">현장 모드</h1>
      <button type="button" class="fm-house" data-fm-house aria-label="${esc(ctx.house)} 동 바꾸기"><strong>${esc(ctx.house || '동 미선택')}</strong>${ICON.down}<span>${esc(ctx.crop || '')}</span></button>
      ${task ? `<button type="button" class="fm-task" data-fm-task><span><small>오늘 할 일</small><strong>${esc(task.title)}</strong></span>${ICON.arrow}</button>` : ''}
      <div class="fm-big">
        <button type="button" class="fm-camera" data-field-entry="camera">${ICON.camera}<strong>사진 찍기</strong><small>찍으면 기록 화면이 열려요</small></button>
        <button type="button" class="fm-memo" data-field-entry="memo">${ICON.memo}<strong>메모 쓰기</strong><small>키보드 마이크로 말해도 돼요</small></button>
      </div>
      <a class="fm-damage" href="#damage">${ICON.alert}<span>피해 생겼어요</span>${ICON.arrow}</a>
      <p class="fm-safety">응급조치를 먼저 하고, 안전할 때 찍어요. 저장은 기록 화면에서 직접 해요.</p>
      <nav class="fm-links" aria-label="현장 모드 바로가기">
        ${last ? `<a href="#journal" data-fm-last="${esc(last.id)}"><span><small>방금 남긴 기록 · ${esc(md(last.date))}</small><strong>${esc((last.memo || last.task || '사진 기록').slice(0, 40))}</strong></span>${ICON.arrow}</a>` : ''}
        <a href="#journal"><span><strong>일지 전체 보기</strong></span>${ICON.arrow}</a>
      </nav>
    </div>`;
  }
  function screen() {
    let s = document.getElementById('field-screen');
    if (!s) {
      s = document.createElement('section');
      s.id = 'field-screen';
      s.className = 'field-screen';
      s.setAttribute('aria-labelledby', 'fm-title');
      s.hidden = true;
      document.body.appendChild(s);
    }
    return s;
  }
  function sync(focus) {
    const s = screen();
    const show = on && isHome();
    if (show) s.innerHTML = html();
    s.hidden = !show;
    root.classList.toggle('fm-on', show);
    for (const id of APP) { const el = document.getElementById(id); if (el) el.inert = show; }
    if (show && focus) s.querySelector('.fm-camera')?.focus();
  }
  // 사진·메모: flow.js가 같은 누름 안에서 기록 화면을 열고 카메라·메모 칸에 포커스를 준다. 그 전에 화면을 내리고 잠금을 푼다.
  function stepAway() {
    const s = document.getElementById('field-screen');
    if (s) s.hidden = true;
    root.classList.remove('fm-on');
    for (const id of APP) { const el = document.getElementById(id); if (el) el.inert = false; }
    setTimeout(() => sync(false), 0);
  }
  function setOn(value) {
    on = value;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* 이번 방문 동안만 */ }
    sync(true);
    window.announceFarmStatus?.(on ? '현장 모드를 켰어요. 큰 버튼으로 사진과 메모를 남겨요.' : '현장 모드를 껐어요.');
    if (!on) setTimeout(() => (document.querySelector('.h21-field') || document.querySelector('[data-field-open]'))?.focus(), 0);
  }
  // 머리 막대 스위치(role=switch)의 켜짐/꺼짐 표시를 지금 상태에 맞춘다.
  function syncSwitches() {
    for (const b of document.querySelectorAll('.field-switch[role="switch"]')) {
      b.setAttribute('aria-checked', String(on));
      b.setAttribute('aria-label', `현장 모드 ${on ? '켜짐' : '꺼짐'}`);
    }
  }

  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-field-open]');
    if (opener) {
      e.preventDefault();
      const inApp = !!(document.getElementById('main-area') && window.FarmFlow);
      // 스위치가 '켜짐'일 때 누르면 끈다(스위치로 보이는 버튼은 켜고 끌 수 있어야 한다).
      if (opener.matches('[role="switch"]') && on) {
        if (inApp) setOn(false);
        else { on = false; try { localStorage.setItem(KEY, 'off'); } catch { /* */ } syncSwitches(); window.announceFarmStatus?.('현장 모드를 껐어요.'); }
        syncSwitches();
        return;
      }
      if (inApp) {
        setOn(true); syncSwitches();
        if (!isHome()) location.hash = '#home'; // 기록 화면 등에서 켜면 홈(현장 화면)으로
        return;
      }
      on = true;
      try { localStorage.setItem(KEY, 'on'); } catch { /* 이번 방문 동안만 */ }
      location.href = opener.dataset.fieldHref || new URL('../index.html' + location.search + '#home', location.href).href;
      return;
    }
    const s = document.getElementById('field-screen');
    if (!s || s.hidden || !s.contains(e.target)) return;
    if (e.target.closest('[data-field-entry]')) { stepAway(); return; }
    if (e.target.closest('[data-fm-off]')) { setOn(false); return; }
    if (e.target.closest('[data-fm-house]')) { document.getElementById('house-switch')?.click(); return; }
    if (e.target.closest('[data-fm-task]')) { window.FarmSaecham?.openSheet?.(); return; }
    const last = e.target.closest('[data-fm-last]');
    if (last && window.FarmFlow?.openRecent) { e.preventDefault(); stepAway(); window.FarmFlow.openRecent(last.dataset.fmLast); }
  }, true);
  new MutationObserver(() => sync(false)).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-screen'] });
  // 홈에 들어올 때·동을 바꾼 뒤·다른 탭에서 켜고 끌 때 다시 그린다.
  window.addEventListener('hashchange', () => setTimeout(() => sync(true), 0));
  window.addEventListener('pageshow', () => sync(false));
  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { try { on = localStorage.getItem(KEY) === 'on'; } catch { /* */ } sync(false); } });
  document.addEventListener('close', e => { if (e.target.id === 'switcher' || /^sc-/.test(e.target.id)) setTimeout(() => sync(false), 0); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => sync(true)); else sync(true);

  // 예전 호출부 호환(shell.js·estimate·saecham.js): 이름은 남기되 예전 확대·스위치는 그리지 않는다.
  // 261127 허간: 머리 막대 오른쪽 위에 예전처럼 '현장 모드 꺼짐/켜짐' 스위치. 누르면 현장 화면을 켜고 앱 홈으로(entryMarkup과 같은 동작)
  const switchMarkup = (href = '') => `<button type="button" class="field-switch" data-field-open${href ? ` data-field-href="${esc(href)}"` : ''} role="switch" aria-checked="${on}" aria-label="현장 모드 ${on ? '켜짐' : '꺼짐'}"><span class="field-switch-label">현장 모드</span><span class="field-switch-track" aria-hidden="true"><span class="field-switch-knob"></span></span></button>`;
  window.FarmField = Object.freeze({ switchMarkup, entryMarkup, enabled: false, get on() { return on; }, setOn, sync });
})();
