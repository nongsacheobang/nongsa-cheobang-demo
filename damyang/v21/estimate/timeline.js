(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const preview = query.get('branch') ? 'branch-' + query.get('branch') : query.get('atlas');
  const scope = preview ? 'preview-' + preview + '-' : '';
  // v21: 1·2동 + 농장 화면에서 추가한 동(같은 기기 저장값). 작물을 정했으면 그 이름을 쓴다.
  let farmHouses = {custom: [], crops: {}};
  try { farmHouses = {...farmHouses, ...JSON.parse(localStorage.getItem((window.FarmTrial?.ns||'damyang-public-v21-')+'houses-' + scope) || '{}')}; } catch {}
  const known = ['1', '2', ...(Array.isArray(farmHouses.custom) ? farmHouses.custom.map(String).filter(id => /^[3-9]$/.test(id)) : [])];
  let house = query.get('house');
  if (!known.includes(house)) {
    try { house = sessionStorage.getItem((window.FarmTrial?.ns||'damyang-public-v21-')+'flow-' + scope + 'house'); } catch {}
  }
  if (!known.includes(house)) house = '2';
  const cropName = ['토마토','방울토마토','딸기'].includes(farmHouses.crops?.[house]?.crop) ? farmHouses.crops[house].crop : '딸기';
  // v21: '피해 기록하기'가 이 화면에 보이는 동의 피해 양식을 열도록 동 번호를 링크에 넘긴다.
  const damageLink = get('damage-link');
  if (damageLink) damageLink.href = InsuranceVisit.farmLink('damage', house);
  const key = (window.FarmTrial?.ns||'damyang-public-v21-')+'season-' + scope + house + '-unconfirmed';
  const dates = {plant: house === '1' ? '2026-10-20' : '', end: ''};
  const day = s => /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T00:00:00Z') / 86400000 : NaN;
  const format = s => s ? s.replaceAll('-', '.') : '미확인';
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && ['plant','end'].every(k => stored[k] === '' || Number.isFinite(day(stored[k])))) {
      dates.plant = stored.plant;
      dates.end = stored.end;
    }
  } catch {}
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function draw() {
    get('season-house').textContent = '하우스 ' + house + '동 · ' + cropName;
    get('plant-label').textContent = format(dates.plant);
    get('end-label').textContent = format(dates.end);
    get('season-plant').value = dates.plant;
    get('season-end').value = dates.end;
    const start = day(dates.plant), end = day(dates.end), now = day(today);
    const complete = Number.isFinite(start) && Number.isFinite(end) && end >= start;
    const marker = get('season-progress');
    marker.hidden = !complete;
    let status;
    if (complete) {
      const ratio = now < start ? 0 : now >= end ? 1 : (now - start) / (end - start);
      marker.style.width = (ratio * 100) + '%';
      status = now < start ? '정식 전' : now > end ? '수확 종료 예정일 지남' : '정식 후 ' + (now - start) + '일';
    } else {
      status = dates.plant && now >= start ? '정식 후 ' + (now - start) + '일 · 수확 종료 예정일 미확인' : '날짜를 입력하면 현재 위치를 볼 수 있어요.';
    }
    get('season-position').textContent = '오늘 ' + format(today) + ' · ' + status;
  }
  get('season-form').addEventListener('submit', event => {
    event.preventDefault();
    const plant = get('season-plant').value, end = get('season-end').value;
    if (plant && end && end < plant) {
      get('season-error').textContent = '수확 종료 예정일이 정식일보다 앞서 있어요.';
      get('season-end').focus();
      return;
    }
    try { localStorage.setItem(key, JSON.stringify({plant, end})); }
    catch { get('season-error').textContent = '이 기기에 일정을 저장할 수 없어요. 다시 시도해 주세요.'; return; }
    // v21: 작물을 정한 동이면 농장 화면의 정식일도 같은 값으로(교차검토 4번)
    try {
      const k = (window.FarmTrial?.ns||'damyang-public-v21-')+'houses-' + scope, s = JSON.parse(localStorage.getItem(k) || '{}') || {};
      if (s.crops?.[house]) { s.crops[house].plant = plant; localStorage.setItem(k, JSON.stringify(s)); }
    } catch {}
    Object.assign(dates, {plant, end});
    get('season-error').textContent = '';
    draw();
    get('season-settings').open = false;
    get('season-settings').querySelector('summary').focus();
  });
  get('terms-link').href = InsuranceVisit.link('../atlas/insurance.html?p=69&house=' + house);
  if (query.get('panel') === 'dates') get('season-settings').open = true;
  draw();
})();
