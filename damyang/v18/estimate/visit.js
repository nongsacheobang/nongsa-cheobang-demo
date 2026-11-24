/* Carry one independent insurance example through its two pages in the same tab. */
(() => {
  const query = new URLSearchParams(location.search);
  const entry = query.get('from');
  const inApp = entry === 'home' || entry === 'tab';
  const supplied = query.get('visit') || history.state?.insuranceVisit || '';
  const visit = /^[a-zA-Z0-9-]{5,60}$/.test(supplied) ? supplied
    : globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const prefix = 'damyang-v16-example-' + visit + '-';
  try {
    history.replaceState({...history.state, insuranceVisit: visit}, '');
  } catch {}
  document.documentElement.classList.toggle('insurance-in-app', inApp);
  function link(path) {
    const url = new URL(path, location.href);
    if (inApp) {
      FarmNav.copyContext(query, url.searchParams);
      url.searchParams.set('from', entry);
    }
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
    nav.hidden = false;
    const home = document.querySelector('a[href="../index.html#home"]');
    if (home) home.href = FarmNav.farmHref('home', context);
  });
})();
