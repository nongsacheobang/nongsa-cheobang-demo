(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const preview = params.has('atlas') || params.has('branch') || params.has('frame') ||
    (/\/atlas\/(screen|insurance)\.html$/.test(location.pathname) && !['home','tab'].includes(params.get('from')));
  const demoKey = 'damyang-field-mode-v16-demo';
  const fieldPreview = params.get('view') === 'field' && preview;
  const key = preview ? 'damyang-field-preview-v17-' + (fieldPreview ? 'field' : 'normal') : demoKey;
  const root = document.documentElement;
  let enabled = fieldPreview;

  function setMode(value) {
    const changed = root.classList.contains('field-mode') !== value;
    enabled = value;
    root.classList.toggle('field-mode', enabled);
    for (const button of document.querySelectorAll('[data-field-mode]')) {
      button.setAttribute('aria-checked', String(enabled));
      button.querySelector('.field-state').textContent = enabled ? '켜짐' : '꺼짐';
    }
    if (changed) window.dispatchEvent(new Event('farm-field-change'));
  }
  function restore() {
    try {
      const stored = (preview ? sessionStorage : localStorage).getItem(key);
      setMode(stored === null ? fieldPreview : stored === 'on');
    } catch { setMode(enabled); }
  }
  function switchMarkup() {
    return `<button type="button" class="field-switch" data-field-mode role="switch"
      aria-label="현장 모드" aria-checked="${enabled}">
      <span>현장 모드</span><span class="field-state" aria-hidden="true">${enabled ? '켜짐' : '꺼짐'}</span>
      <span class="field-track" aria-hidden="true"></span></button>`;
  }
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-field-mode]')) return;
    setMode(!enabled);
    try { (preview ? sessionStorage : localStorage).setItem(key, enabled ? 'on' : 'off'); } catch { /* Works for this visit. */ }
    window.announceFarmStatus?.(enabled ? '현장 모드를 켰어요. 홈에서 바로 사진과 메모를 남길 수 있어요.' : '기본 화면으로 돌아왔어요.');
  });
  window.addEventListener('storage', event => { if (!preview && (event.key === key || event.key === null)) restore(); });
  window.addEventListener('pageshow', restore);
  window.FarmField = { switchMarkup, get enabled() { return enabled; } };
  if (fieldPreview && performance.getEntriesByType('navigation')[0]?.type === 'navigate' &&
      !history.state?.farmEntry && !params.has('from') && !params.has('visit')) {
    try { sessionStorage.setItem(key, 'on'); } catch { /* The URL still selects this preview. */ }
  }
  restore();
})();
