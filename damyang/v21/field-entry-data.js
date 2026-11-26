(() => {
  'use strict';
  const types = {work:'일반 작업', damage:'피해', pest:'병·벌레 기록'};
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  function day(offset = 0) {
    const current = new Date(Date.now() + offset * 86400000);
    return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(current);
  }
  function defaults() {
    return {entryDate:'', entryType:'', entryHouse:'', quantity:'', unit:'', discoveredAt:'', accidentAt:'', manualFields:'', memoHints:'', inferredBaseline:'{}', entryRoute:''};
  }
  function prepare(d, active, route) {
    if (!d.entryDate) d.entryDate = day();
    if (!d.entryType || (route === 'damage' && d.entryRoute === 'record')) {
      d.entryType = route === 'damage' ? 'damage' : 'work';
      if (route === 'damage') {
        d.manualFields = (d.manualFields || '').split(',').filter(Boolean).filter(k => k !== 'entryType').join(',');
        const original = baseline(d);
        delete original.entryType;
        d.inferredBaseline = JSON.stringify(original);
      }
    }
    d.entryRoute = route;
    if (!d.entryHouse) d.entryHouse = String(active);

    // 예전 초안·미리보기처럼 입력 이벤트 없이 메모가 바뀐 경우, 이전 메모에서 읽은 동·날짜·종류가 남지 않게.
    // 같은 날짜 단어로 이미 반영한 날짜는 다시 계산하지 않는다(다음 날 다시 열거나 메모를 덧붙여도 '어제'가 그날 기준으로 밀리지 않게).
    const synced = reconcile(d, d.memo || '', true);
    if (synced.changed || d.memoHints) d.memoHints = hintText(synced.applied);
  }
  const autoFields = ['entryDate','entryHouse','entryType','quantity','unit','accidentAt','discoveredAt'];
  function hintText(applied) {
    return applied && applied.length ? '메모에서 읽은 ' + applied.join(' · ') + '을 반영했어요. 아래에서 바꿀 수 있어요.' : '';
  }
  // 메모 단서로 자동 반영한 값만 다룬다. 농가가 직접 고른 값(manualFields)은 건드리지 않는다.
  function reconcile(d, memo, keepApplied = false) {
    const manual = new Set((d.manualFields || '').split(',').filter(Boolean));
    const found = cues(memo);
    const original = baseline(d);
    const before = autoFields.map(k => d[k]).join('|');
    const applied = [];
    for (const key of Object.keys(original)) {
      if (found[key] || manual.has(key) || !autoFields.includes(key)) continue;
      d[key] = original[key];
      delete original[key];
      if (key === 'entryDate') delete original.dateWord;
    }
    for (const [key, val] of Object.entries(found)) {
      if (manual.has(key)) continue;
      const label = key === 'entryType' ? types[val] : key === 'entryHouse' ? val + '동' : val;
      // 날짜만: 같은 단어('어제' 등)로 이미 반영했으면 그 날짜를 유지한다. 동·종류는 단서대로 다시 맞춘다.
      if (keepApplied && key === 'entryDate' && key in original && (original.dateWord === undefined || original.dateWord === found.dateWord)) { original.dateWord = found.dateWord; applied.push(d[key]); continue; }
      if (!(key in original)) original[key] = d[key];
      d[key] = val;
      if (key === 'entryDate') original.dateWord = found.dateWord;
      applied.push(label);
    }
    d.inferredBaseline = JSON.stringify(original);
    return {applied, changed: before !== autoFields.map(k => d[k]).join('|')};
  }
  // v21: 동 목록은 FarmFlow(1·2동 + 이 기기에서 추가한 동)에서 받는다.
  const houseIds = () => (window.FarmFlow?.contexts?.() || [{id:'1'},{id:'2'}]).map(h => h.id).sort();
  const houseOptions = () => houseIds().map(id => [id, '하우스 ' + id + '동']);
  function editor(d) {
    const input = (name, type, caption, attrs='') => '<label>' + caption + '<input name="' + name + '" type="' + type + '" value="' + escape(d[name]) + '" ' + attrs + '></label>';
    const options = (pairs, selected) => pairs.map(([v,label]) => '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + label + '</option>').join('');
    return '<section class="ff-block entry-check"><h2>기록 정보</h2><p class="ff-note" data-memo-hints aria-live="polite">' + escape(d.memoHints) + '</p><div class="entry-pair">' +
      input('entryDate','date','기록 날짜','required') +
      '<label>하우스 동<select id="ff-house" name="entryHouse">' + options(houseOptions(), d.entryHouse) + '</select></label></div>' +
      '<label>기록 종류<select name="entryType">' + options(Object.entries(types), d.entryType) + '</select></label>' +
      // v21 1차(검수 2·9순위): 덜 쓰는 수량·단위는 접어 둔다. 값이 있으면 펼친 채로.
      '<details class="entry-more"' + (d.quantity || d.unit ? ' open' : '') + '><summary>수량·단위 (선택)</summary><div class="entry-pair">' + input('quantity','number','수량 (선택)','min="0" step="any" inputmode="decimal"') + input('unit','text','단위 (선택)','maxlength="20" placeholder="장, m, 상자 등"') + '</div></details></section>';
  }
  // v21: 피해 시각 칸은 메모 아래에 따로 둔다. 메모로 피해가 감지돼도 쓰던 메모 칸이 밀리지 않게.
  function times(d) {
    const input = (name, caption) => '<label>' + caption + '<input name="' + name + '" type="datetime-local" value="' + escape(d[name]) + '"></label>';
    return '<section class="ff-block entry-check entry-times" data-incident-times' + (d.entryType !== 'damage' ? ' hidden' : '') + '><h2>피해 시각 <small>선택</small></h2><p class="ff-note">시각을 모르면 비워 두세요.</p>' +
      input('discoveredAt','처음 발견한 때 (선택)') + input('accidentAt','실제 사고 시각 (선택)') + '</section>';
  }
  // Only explicit cues in the farmer's own note are reflected. Manual choices always win.
  function cues(memo) {
    const result = {};
    const days = [...new Set(memo.match(/그저께|그제|어제|오늘/g) || [])];
    if (days.length === 1) { result.entryDate = day(({그저께:-2,그제:-2,어제:-1,오늘:0})[days[0]]); Object.defineProperty(result, 'dateWord', {value: days[0] === '그제' ? '그저께' : days[0]}); }
    const houses = [...new Set(Array.from(memo.matchAll(/(?:^|[^\d])([1-9])\s*동/g), m => m[1]))].filter(id => houseIds().includes(id));
    if (houses.length === 1) result.entryHouse = houses[0];
    const damageVerbs = /(?:찢어졌|파손됐|파손되었|침수됐|침수되었|무너졌|부러졌)(?:다(?![면고니])|습니다|어요|고(?=\s|$)|지만|는데|네요)/;
    if (damageVerbs.test(memo)) result.entryType = 'damage';
    return result;
  }
  function baseline(d) {
    try { return JSON.parse(d.inferredBaseline || '{}') || {}; } catch { return {}; }
  }
  function bind(form, d, changed) {
    const box = form.querySelector('.entry-check');
    if (!box) return;
    const timesBox = form.querySelector('[data-incident-times]');
    const manual = new Set((d.manualFields || '').split(',').filter(Boolean));
    const drawTimes = () => { if (timesBox) timesBox.hidden = d.entryType !== 'damage'; };
    const named = key => box.querySelector('[name="' + key + '"]') || timesBox?.querySelector('[name="' + key + '"]');
    const fields = ['entryDate','entryHouse','entryType','quantity','unit','accidentAt','discoveredAt'];
    function update(e) {
      const field = e.target;
      if (!fields.includes(field.name)) return;
      if (field.tagName === 'SELECT' && e.type !== 'change') return;
      if (field.tagName !== 'SELECT' && e.type !== 'input') return;
      d[field.name] = field.value;
      manual.add(field.name);
      const original = baseline(d);
      delete original[field.name];
      d.inferredBaseline = JSON.stringify(original);
      d.manualFields = Array.from(manual).join(',');
      if (['entryDate','entryType','entryHouse'].includes(field.name)) {
        d.memoHints = '';
        box.querySelector('[data-memo-hints]').textContent = '';
      }
      drawTimes();
      changed();
    }
    for (const host of [box, timesBox].filter(Boolean)) {
      host.addEventListener('input',update);
      host.addEventListener('change',update);
    }
    const memo = form.querySelector('[name=memo]');
    memo?.addEventListener('input', () => {
      d.manualFields = Array.from(manual).join(',');
      const {applied} = reconcile(d, memo.value, true);
      for (const key of fields) { const el = named(key); if (el && el.value !== d[key]) el.value = d[key]; }
      d.memoHints = hintText(applied);
      box.querySelector('[data-memo-hints]').textContent = d.memoHints;
      drawTimes();
      changed();
    });
  }
  function valid(d, form) {
    return !!(types[d.entryType] && houseIds().includes(d.entryHouse) && /^\d{4}-\d\d-\d\d$/.test(d.entryDate) && form.reportValidity());
  }
  window.FarmEntry = {defaults,prepare,editor,times,bind,valid};
})();
