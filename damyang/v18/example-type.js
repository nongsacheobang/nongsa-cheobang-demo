/* Independent examples use the demo's text preference without changing its state. */
(() => {
  const params = new URLSearchParams(location.search);
  const preferenceKey = 'damyang-261123-v11-typeface-' + (params.get('branch') || params.get('atlas') || 'demo');
  function syncTextSize() {
    try {
      const large = params.has('frame') && params.has('typeSize')
        ? params.get('typeSize') === 'large' : localStorage.getItem(preferenceKey) === 'large';
      document.documentElement.classList.toggle('large-text', large);
    } catch {
      // The examples can also open with browser storage disabled.
    }
  }
  syncTextSize();
  window.addEventListener('pageshow', syncTextSize);
  window.addEventListener('storage', event => {
    if (event.key === preferenceKey || event.key === null) syncTextSize();
  });
})();
