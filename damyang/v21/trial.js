/* 1단계 기능 데모 체험 회차(261126 PRD F01·F06).
   체험본은 주소의 trial=1로만 정한다(탭에 남는 표시 없음). 앱 안 링크에는 trial=1을 이어 붙인다.
   체험 자료는 damyang-trial-v21-r<회차>- 구역에만 둔다. 일반 v21 저장값(damyang-public-v21-)은 읽지도 지우지도 않는다.
   외부 전송 없음. 회차 ID와 시작 한국 날짜(D)만 이 브라우저에 둔다. */
(() => {
  'use strict';
  const BASE = 'damyang-public-v21-', ROOT = 'damyang-trial-v21-', CURRENT = ROOT + 'current', RETIRED = ROOT + 'retired';
  let query = new URLSearchParams();
  try { query = new URLSearchParams(location.search); } catch {}
  // 화면 검수용 미리보기(atlas·branch·mallPreview)와는 섞지 않는다.
  const on = query.get('trial') === '1' && !query.has('atlas') && !query.has('branch') && !query.has('mallPreview');

  const kstDay = d => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(d);
  const nextDay = day => new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  const newId = () => (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12);
  const realDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(Date.parse(d + 'T00:00:00Z')).toISOString().slice(0, 10) === d;
  const valid = r => !!r && typeof r.id === 'string' && /^[a-z0-9]{6,32}$/i.test(r.id) && realDay(r.day);
  const nsOf = id => ROOT + 'r' + id + '-';
  const storageOf = name => { try { return window[name] || null; } catch { return null; } };
  const LS = storageOf('localStorage'), SS = storageOf('sessionStorage');

  // 회차 포인터 읽기: {round} | {absent} | {error}. 읽기 오류나 깨진 값은 '처음 방문'으로 보지 않는다(기존 회차를 덮지 않게).
  function readRound() {
    if (!LS) return {error: true};
    let raw;
    try { raw = LS.getItem(CURRENT); } catch { return {error: true, read: true}; }
    if (raw === null) return {absent: true};
    try { const r = JSON.parse(raw); return valid(r) ? {round: r} : {error: true}; } catch { return {error: true}; }
  }
  function startRound() {
    const r = {id: newId(), day: kstDay(new Date()), startedAt: new Date().toISOString()};
    LS.setItem(CURRENT, JSON.stringify(r)); // 포인터 키는 쓰기 차단 대상이 아니다(실패 주입 시험 가능)
    return r;
  }
  function retired() { try { const a = JSON.parse(LS.getItem(RETIRED) || '[]'); return Array.isArray(a) ? a.filter(id => /^[a-z0-9]{6,32}$/i.test(id)) : []; } catch { return []; } }
  // '다시 시작'으로 끝난 회차(retired)의 키만 지운다. 현재 회차나 나중에 생긴 회차는 절대 지우지 않는다.
  function purge(ids) {
    const prefixes = ids.map(nsOf);
    const mine = k => typeof k === 'string' && prefixes.some(p => k.startsWith(p));
    let left = 0;
    for (const store of [LS, SS]) {
      if (!store) continue;
      try {
        for (let i = store.length - 1; i >= 0; i--) { const k = store.key(i); if (mine(k)) { try { store.removeItem(k); } catch {} } }
        for (let i = 0; i < store.length; i++) if (mine(store.key(i))) left++;
      } catch { left++; }
    }
    return left;
  }

  let round = null, ns = BASE, state = 'off';
  if (on) {
    try { document.documentElement.classList.add('trial'); } catch {} // 체험본에서만 쓰는 화면 규칙(trial.css)
    const read = readRound();
    if (read.round) { round = read.round; state = 'ready'; }
    else if (read.absent) { try { round = startRound(); state = 'ready'; } catch { state = 'unavailable'; } }
    else state = 'unavailable';
    // 포인터를 쓰거나 읽지 못하면 이 탭은 체험 자료를 저장하지 않는다(일반 v21 구역으로 새지 않게 체험 구역을 그대로 쓴다).
    if (!round) round = {id: 'unavailable', day: kstDay(new Date()), memoryOnly: true};
    ns = nsOf(round.id);
    if (state === 'ready') {
      const old = retired().filter(id => id !== round.id);
      if (old.length) purge(old); // 다른 탭이 늦게 써서 남은 '끝난 회차' 키 정리
    }
    // 끝난 회차나 알 수 없는 회차의 키를 쓰려 하면 막는다(지운 체험 자료가 옛 탭에서 되살아나지 않게).
    const native = Storage.prototype.setItem;
    let reloading = false;
    Storage.prototype.setItem = function (key, value) {
      if (typeof key === 'string' && key.startsWith(ROOT) && key !== CURRENT && key !== RETIRED) {
        const now = readRound();
        if (!now.round) throw new DOMException('체험 회차를 확인하지 못해 저장하지 않았어요.', 'InvalidStateError');
        if (!key.startsWith(nsOf(now.round.id))) {
          if (state === 'ready' && now.round.id !== round.id && !reloading) { reloading = true; // 회차를 확인 못 한 탭은 새로고침을 반복하지 않게 저장만 막는다
            setTimeout(() => location.reload(), 0); }
          throw new DOMException('이 체험 회차는 다시 시작되었어요.', 'InvalidStateError');
        }
      }
      return native.call(this, key, value);
    };
    const changed = () => { const now = readRound(); return state === 'ready' && now.round && now.round.id !== round.id; };
    window.addEventListener('storage', e => { if ((e.key === CURRENT || e.key === null) && changed() && !reloading) { reloading = true; location.reload(); } });
    window.addEventListener('pageshow', e => { if (e.persisted && changed() && !reloading) { reloading = true; location.reload(); } });
    // 앱 안의 다른 문서(보험·약관·농장)로 가는 링크에 trial=1을 이어 붙인다.
    const keep = a => {
      try {
        const url = new URL(a.getAttribute('href'), location.href);
        if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname) || url.searchParams.get('trial') === '1') return;
        url.searchParams.set('trial', '1'); a.href = url.href;
      } catch {}
    };
    document.addEventListener('click', e => { const a = e.target.closest?.('a[href]'); if (a) keep(a); }, true);
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('a[href]').forEach(keep);
      document.querySelectorAll('[data-trial-only]').forEach(el => { el.hidden = false; });
    });
  }

  let pending = [];
  // 이 회차만 끝내고 새 회차를 연다. 기본 예시와 일반 v21·v15·v18 기록은 건드리지 않는다.
  // ① 이 탭이 현재 회차인지 확인(옛 탭이면 아무것도 안 함) ② 새 포인터를 먼저 쓴다(실패하면 아무것도 지우지 않음)
  // ③ 끝난 회차 목록에 올린 뒤 그 회차 키만 지운다. 다른 탭의 늦은 쓰기가 올 수 있어 짧게 몇 번 더 정리한다.
  async function restart() {
    if (!on) return {ok: false, reason: 'off'};
    const now = readRound();
    if (now.read) return {ok: false, reason: 'pointer'}; // 포인터를 읽지 못하는 동안은 새 회차를 쓰지 않는다
    const mine = state === 'ready' ? now.round?.id === round.id : !now.round; // 확인 불가 탭은 포인터가 없거나 깨졌을 때만
    if (!mine) { if (now.round) setTimeout(() => location.reload(), 0); return {ok: false, reason: 'stale'}; }
    const old = state === 'ready' ? [round.id] : [];
    let next;
    try { next = startRound(); } catch { return {ok: false, reason: 'pointer'}; }
    try { LS.setItem(RETIRED, JSON.stringify([...new Set([...retired(), ...old])].slice(-50))); } catch {}
    pending = old;
    let left = purge(old);
    for (let i = 0; i < 3; i++) { await new Promise(r => setTimeout(r, 150)); left = purge(old); }
    return left ? {ok: false, reason: 'partial', left} : {ok: true, next: next.id};
  }
  // 부분 삭제 뒤 '한 번 더': 방금 끝낸 회차의 남은 키만 다시 지운다.
  function cleanup() { const left = purge(pending); return left ? {ok: false, reason: 'partial', left} : {ok: true}; }

  window.FarmTrial = {
    on, ns, round, state,
    nextDay,
    planDay: () => (round ? nextDay(round.day) : ''),
    restart, cleanup
  };
})();
