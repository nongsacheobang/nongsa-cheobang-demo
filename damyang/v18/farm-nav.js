/* Routes shared by the farm shell and the two insurance documents. */
(() => {
  'use strict';
  const items = [
    {id:'home', label:'홈', icon:'<path d="m2.5 10 9.5-8 9.5 8v10h-7v-6h-5v6h-7z"/>'},
    {id:'journal', label:'농장 일지', icon:'<rect x="4" y="3" width="15" height="18" rx="2"/><path d="M8 3v18m3-13h5m-5 4h4"/>'},
    {id:'insurance', label:'보험', icon:'<path d="M12 2.5 20 6v6c0 4.5-3.7 7.6-8 9.5C7.7 19.6 4 16.5 4 12V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>'},
    {id:'shop', label:'쇼핑', icon:'<path d="M4.5 7.5h15l1 13h-17zM8.5 8V6a3.5 3.5 0 0 1 7 0v2"/>'},
    {id:'settings', label:'설정', icon:'<path d="m9.5 3 .6-1h3.8l.6 1 .6 1.6 1.6.9 1.7-.3 1.2.1 1.8 3.1-.6 1.2-1.1 1.2v2l1.1 1.2.6 1.2-1.8 3.1-1.2.1-1.7-.3-1.6.9-.6 1.6-.6 1h-3.8l-.6-1-.6-1.6-1.6-.9-1.7.3-1.2-.1-1.8-3.1.6-1.2 1.1-1.2v-2L3.2 9.9l-.6-1.2 1.8-3.1 1.2-.1 1.7.3 1.6-.9Z"/><circle cx="12" cy="12" r="3"/>'}
  ];
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
  window.FarmNav = {items, copyContext, insuranceHref, farmHref, render};
})();
