/* Carry one independent insurance example through its two pages in the same tab. */
(() => {
  const query = new URLSearchParams(location.search);
  const entry = query.get('from');
  const inApp = entry === 'home' || entry === 'tab';
  // 261126 체험본: 홈 카드처럼 visit 없이 다시 들어와도 이 탭의 마지막 보험 방문을 이어 간다(확인 상태·바꾼 조건 유지)
  const lastKey = window.FarmTrial?.on ? window.FarmTrial.ns + 'example-last-visit' : '';
  let last = ''; try { last = lastKey ? sessionStorage.getItem(lastKey) || '' : ''; } catch {}
  const supplied = query.get('visit') || history.state?.insuranceVisit || last || '';
  const visit = /^[a-zA-Z0-9-]{5,60}$/.test(supplied) ? supplied
    : globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const prefix = (window.FarmTrial?.ns||'damyang-public-v21-')+'example-' + visit + '-';
  try {
    history.replaceState({...history.state, insuranceVisit: visit}, '');
  } catch {}
  try { if (lastKey) sessionStorage.setItem(lastKey, visit); } catch {}
  document.documentElement.classList.toggle('insurance-in-app', inApp);
  function link(path) {
    const url = new URL(path, location.href);
    if (inApp) {
      FarmNav.copyContext(query, url.searchParams);
      url.searchParams.set('from', entry);
    }
    if (window.FarmTrial?.on) url.searchParams.set('trial', '1');
    url.searchParams.set('visit', visit);
    return url.href;
  }
  function read(page) {
    try { return JSON.parse(sessionStorage.getItem(prefix + page)); } catch { return null; }
  }
  function save(page, values) {
    try { sessionStorage.setItem(prefix + page, JSON.stringify(values)); } catch {}
  }
  window.InsuranceVisit = {link, read, save};
  if (inApp) document.addEventListener('DOMContentLoaded', () => {
    const context = {base:'../', visit, params:query};
    const nav = document.getElementById('mobile-nav');
    nav.innerHTML = FarmNav.render({...context, section:'insurance'});
    FarmNav.refresh?.();
    nav.hidden = false;
    const home = document.querySelector('a[href="../index.html#home"]');
    if (home) home.href = FarmNav.farmHref('home', context);
    // v21 1차(검수 7순위): 앱 안에서는 다른 탭처럼 위쪽 막대를 '‹ 농장 홈 + 시연용 예시 + 현장 모드'로 통일
    const bar = document.querySelector('.example-nav');
    if (bar) {
      const tools = document.createElement('span'); tools.className = 'example-nav-tools';
      const chip = document.querySelector('.top .example'); if (chip) tools.append(chip);
      // 261127: 현장 모드는 '현장 화면' 진입 버튼(FarmField.entryMarkup, 현장 모드 세션 제공). 없으면 예전 스위치
      if (window.FarmField?.switchMarkup) tools.insertAdjacentHTML('beforeend', FarmField.switchMarkup(FarmNav.farmHref('home', context)));   // 허간: 다른 화면과 같은 오른쪽 위 스위치
      bar.append(tools);
    }
  });
  // v21: 앱 화면 링크(피해 기록 등)에 이 화면의 동 번호(house)를 함께 넘긴다. 앱 안·독립 화면 공통.
  function farmLink(id, house) {
    const url = new URL(inApp ? FarmNav.farmHref(id, {base:'../', visit, params:query}) : '../index.html#' + id, location.href);
    if (/^[1-9]$/.test(house || '')) url.searchParams.set('house', house);
    return url.href;
  }
  window.InsuranceVisit.farmLink = farmLink;
})();
