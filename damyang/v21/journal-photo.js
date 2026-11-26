(() => {
  'use strict';
  const inProgress = new WeakMap();
  const views = new WeakMap();
  const dataUrl = /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+$/i;
  const icons = {
    camera: '<path d="M3 8h4l1.6-3h6.8L17 8h4v11H3z"/><circle cx="12" cy="13" r="3.3"/>',
    album: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.3"/><path d="m4 17 5-5 3 3 3-4 5 6"/>'
  };
  function markup() {
    const button = (kind, label) => '<button type="button" data-photo-pick="'+kind+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+icons[kind]+'</svg>'+label+'</button>';
    return '<div class="journal-photo-tools"><div class="journal-photo-actions">'+button('camera','사진 촬영')+button('album','앨범에서 선택')+'</div>'+
      '<input type="file" hidden accept="image/*" capture="environment" data-photo-source="camera" aria-label="현장 사진 촬영">'+
      '<input type="file" hidden accept="image/*" data-photo-source="album" aria-label="앨범 사진 선택">'+
      '<img class="journal-photo-preview" data-photo-preview hidden alt="첨부할 현장 사진">'+
      '<p class="journal-photo-status" role="status" data-photo-status></p>'+
      '<button type="button" data-photo-clear hidden>사진 선택 해제</button></div>';
  }
  function localImage(record) {
    return record.photo === 'local' && dataUrl.test(record.data || '') ? record.data : '';
  }
  async function prepare(file) {
    if (file.type && !file.type.startsWith('image/')) throw Error('사진 파일을 골라 주세요.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1152 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL('image/jpeg', .76);
      return jpeg.length > 320000 ? canvas.toDataURL('image/jpeg', .52) : jpeg;
    } finally { URL.revokeObjectURL(url); }
  }
  function chooseSample(draft, value) {
    inProgress.delete(draft);
    Object.assign(draft, {photo:value, data:'', photoTitle:''});
    views.get(draft)?.paint(value ? '예시 사진을 선택했어요.' : '사진 선택을 해제했어요.');
  }
  function bind(field, draft, persist, setBusy) {
    const tools = field.querySelector('.journal-photo-tools');
    const img = tools.querySelector('[data-photo-preview]');
    const clear = tools.querySelector('[data-photo-clear]');
    const status = tools.querySelector('[data-photo-status]');
    function paint(message) {
      if (!tools.isConnected) return;
      const busy = inProgress.has(draft);
      setBusy(busy);
      const src = localImage(draft);
      if (src && img.getAttribute('src') !== src) img.src = src;
      if (!src) img.removeAttribute('src');
      img.hidden = !src;
      clear.hidden = !draft.photo && !busy;
      status.textContent = message ?? (busy ? '사진을 준비하고 있어요.' : src ? '첨부한 사진 · '+draft.photoTitle : '');
      field.querySelectorAll('[name="photoSample"]').forEach(el => { el.checked = el.value === draft.photo; });
      field.querySelectorAll('[data-act="photo"]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.value === draft.photo)));
    }
    views.set(draft, {paint});
    paint();
    tools.querySelectorAll('[data-photo-pick]').forEach(button => {
      button.onclick = () => tools.querySelector('[data-photo-source="'+button.dataset.photoPick+'"]').click();
    });
    clear.onclick = () => {
      chooseSample(draft, '');
      persist();
      tools.querySelector('[data-photo-pick="camera"]').focus({preventScroll:true});
    };
    tools.querySelectorAll('[data-photo-source]').forEach(input => {
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        input.value = '';
        const ticket = {};
        inProgress.set(draft, ticket);
        paint();
        let message;
        try {
          const data = await prepare(file);
          if (inProgress.get(draft) !== ticket) return;
          Object.assign(draft, {photo:'local', data, photoTitle:file.name || '현장 사진'});
          message = persist();
        } catch {
          message = '이 사진을 열 수 없어요. 다른 사진을 골라 주세요.';
        } finally {
          if (inProgress.get(draft) === ticket) {
            inProgress.delete(draft);
            views.get(draft)?.paint(message);
          }
        }
      };
    });
  }
  window.FarmPhoto = {markup, bind, chooseSample, localImage, busy:draft => inProgress.has(draft)};
})();
