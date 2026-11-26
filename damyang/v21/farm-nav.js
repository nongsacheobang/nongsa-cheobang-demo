/* Routes shared by the farm shell and the two insurance documents. */
(() => {
  'use strict';
  const items = [
    {id:'home', label:'홈', icon:'<path d="m2.5 10 9.5-8 9.5 8v10h-7v-6h-5v6h-7z"/>'},
    {id:'journal', label:'농장 일지', icon:'<rect x="4" y="3" width="15" height="18" rx="2"/><path d="M8 3v18m3-13h5m-5 4h4"/>'},
    {id:'insurance', label:'보험', icon:'<path d="M12 2.5 20 6v6c0 4.5-3.7 7.6-8 9.5C7.7 19.6 4 16.5 4 12V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>'},
    {id:'shop', label:'쇼핑', icon:'<path d="M4.5 7.5h15l1 13h-17zM8.5 8V6a3.5 3.5 0 0 1 7 0v2"/>'},

    {id:'news', label:'소식', icon:'<path d="M4 5.5h12.5v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M16.5 9H20v9.5a2 2 0 0 1-4 0M7.5 9h5.5m-5.5 3.5h5.5M7.5 16h3.5"/>'}
  ];
  // 설정 아이콘은 홈 위쪽 톱니 버튼에서 쓴다
  const settingsIcon = '<path d="m9.5 3 .6-1h3.8l.6 1 .6 1.6 1.6.9 1.7-.3 1.2.1 1.8 3.1-.6 1.2-1.1 1.2v2l1.1 1.2.6 1.2-1.8 3.1-1.2.1-1.7-.3-1.6.9-.6 1.6-.6 1h-3.8l-.6-1-.6-1.6-1.6-.9-1.7.3-1.2-.1-1.8-3.1.6-1.2 1.1-1.2v-2L3.2 9.9l-.6-1.2 1.8-3.1 1.2-.1 1.7.3 1.6-.9Z"/><circle cx="12" cy="12" r="3"/>';
  const contextKeys = {
    atlas:/^\d{1,2}$/, view:/^field$/, branch:/^[a-z0-9-]{1,50}$/,
    mallPreview:/^[a-z0-9-]{1,50}$/, frame:/^(?:[4-9]|[1-5]\d|6[0-6])$/,
    atlasRun:/^[\w.-]{1,90}$/, typeSize:/^(?:large|basic)$/
  };
  const editorPages = {journal:6, shop:27, settings:5};
  function copyContext(source, dest) {
    for (const [name, allowed] of Object.entries(contextKeys)) {
      const value = source?.get(name);
      if (value && allowed.test(value)) dest.set(name, value);
    }
    return dest;
  }
  function paramsFor(params, visit) {
    const result = copyContext(params, new URLSearchParams());
    if (visit && /^[a-zA-Z0-9-]{5,60}$/.test(visit)) result.set('visit', visit);
    return result;
  }
  function insuranceHref({base='', params, visit} = {}) {
    const query = paramsFor(params, visit);
    const house = window.FarmFlow?.context().id || params?.get('house');
    if (/^[1-9]$/.test(house)) query.set('house', house);
    query.set('from', 'tab');
    return base + 'estimate/index.html?' + query;
  }
  function farmHref(id, {base='', params, visit} = {}) {
    if (!base) return '#' + id;
    const query = paramsFor(params, visit);
    if (query.has('frame') && query.has('atlasRun')) {
      if (editorPages[id]) {
        query.set('p', String(editorPages[id]));
        query.set('tab', id);
        return base + 'atlas/screen.html?' + query;
      }
      query.set('atlas', '3');
    }
    const search = query.toString();
    return base + 'index.html' + (search ? '?' + search : '') + '#' + id;
  }
  function render(options) {
    return items.map(({id,label,icon}) => {
      const href = id === 'insurance' ? insuranceHref(options) : farmHref(id,options);
      const current = id === options.section ? ' aria-current="page"' : '';
      return `<a data-nav="${id}" href="${href.replaceAll('&','&amp;')}"${current}><span class="n-icon"><svg aria-hidden="true" class="shell-icon" viewBox="0 0 24 24">${icon}</svg></span><span class="n-label">${label}</span></a>`;
    }).join('');
  }


  const LAST = 'damyang-public-v21-nav';
  const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let shown = '';
  function place(nav, a, animate) {
    const bubble = nav.querySelector('.nav-bubble');
    if (!bubble || !a) return;
    const x = a.offsetLeft + a.offsetWidth / 2 - bubble.offsetWidth / 2;
    if (!animate) bubble.style.transition = 'none';
    bubble.style.transform = `translateX(${x}px)`;
    if (!animate) { void bubble.offsetWidth; bubble.style.transition = ''; }
  }
  function decorate(nav) {
    const links = [...nav.querySelectorAll('a[data-nav]')];
    const cur = links.find(a => a.getAttribute('aria-current') === 'page');
    if (!links.length) return;
    nav.classList.add('has-bubble');
    let bubble = nav.querySelector('.nav-bubble');
    const fresh = !bubble;
    if (!bubble) { bubble = document.createElement('span'); bubble.className = 'nav-bubble'; bubble.setAttribute('aria-hidden', 'true'); nav.prepend(bubble); }
    bubble.hidden = !cur;
    const id = cur?.dataset.nav || '';
    let prevId = shown;
    if (!prevId) { try { prevId = sessionStorage.getItem(LAST) || ''; } catch {} }
    try { if (id) sessionStorage.setItem(LAST, id); } catch {}
    const prev = links.find(a => a.dataset.nav === prevId);
    const move = !!(cur && prev && prev !== cur && !still());
    // 같은 메뉴를 다시 그리거나(감시+직접 호출로 두 번 불릴 때) 이미 움직이는 중이면 건드리지 않는다
    if (id === shown && !move) { if (fresh) place(nav, cur, false); return; }
    shown = id;
    if (!move) { place(nav, cur, false); return; }
    place(nav, prev, false);
    prev.classList.add('nav-leave');
    cur.classList.add('nav-enter');
    requestAnimationFrame(() => requestAnimationFrame(() => place(nav, cur, true)));
    setTimeout(() => { prev.classList.remove('nav-leave'); cur.classList.remove('nav-enter'); }, 500);
  }
  function watch() {
    const nav = document.getElementById('mobile-nav');
    if (!nav || nav.dataset.watched) return;
    nav.dataset.watched = '1';
    new MutationObserver(list => {
      if (list.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && n.matches?.('a[data-nav]')))) requestAnimationFrame(() => decorate(nav));
    }).observe(nav, {childList: true});
    if (nav.querySelector('a[data-nav]')) requestAnimationFrame(() => decorate(nav));
    addEventListener('resize', () => place(nav, nav.querySelector('a[aria-current=page]'), false));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  addEventListener('load', watch);
  // 메뉴를 그린 화면 코드가 바로 부른다(처음 그릴 때 감시가 아직 붙지 않았을 수 있어서).
  function refresh() { watch(); const nav = document.getElementById('mobile-nav'); if (nav) requestAnimationFrame(() => decorate(nav)); }
  window.FarmNav = {items, settingsIcon, copyContext, insuranceHref, farmHref, render, refresh};
})();
