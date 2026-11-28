/* Editable local mockup. No network requests or notifications are sent. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const branchKey=params.get('branch');
  const preview = branchKey ? 'branch-' + branchKey : params.get('atlas');
  const prefix = (window.FarmTrial?.ns||'damyang-public-v21-')+'flow-' + (preview ? 'preview-' + preview + '-' : '');
  const mallPreview=params.get('mallPreview')||'';

  // season('작기 미확인')은 기록을 찾는 내부 열쇠라 그대로 두고, 화면에는 seasonLabel(작물·정식일)을 보여준다.
  // 보험 화면(estimate/timeline.js)도 같은 저장 키를 읽어 작물 이름과 정식일을 맞춘다.
  const houseKey = (window.FarmTrial?.ns||'damyang-public-v21-')+'houses-' + (preview ? 'preview-' + preview + '-' : '');
  const seasonKey = id => (window.FarmTrial?.ns||'damyang-public-v21-')+'season-' + (preview ? 'preview-' + preview + '-' : '') + id + '-unconfirmed';
  const CROPS = ['토마토', '방울토마토', '딸기'];
  const DEFAULT_CROPS = {'1': {crop: '딸기', plant: '2026-10-20'}, '2': {crop: '딸기', plant: ''}};
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
  function loadHouses() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(houseKey) || '{}') || {}; } catch (_) {}
    const custom = [...new Set((Array.isArray(s.custom) ? s.custom : []).map(String).filter(id => /^[3-9]$/.test(id)))].sort();
    const crops = {};
    for (const [id, c] of Object.entries(s.crops && typeof s.crops === 'object' ? s.crops : {})) {
      if (/^[1-9]$/.test(id) && CROPS.includes(c?.crop)) crops[id] = {crop: c.crop, plant: isDate(c.plant) ? c.plant : ''};
    }
    // 시연 농장(김민수의 시설 딸기 농장) 기본값: 1·2동은 딸기. 1동 정식일은 보험 작기 카드의 기존 시연값(10월 20일).
    for (const [id, c] of Object.entries(DEFAULT_CROPS)) if (!crops[id]) crops[id] = {...c};
    return {custom, crops};
  }
  function saveHouses(s) { try { localStorage.setItem(houseKey, JSON.stringify(s)); return true; } catch (_) { return false; } }
  const seasonLabel = c => !c ? '작기 미확인' : c.crop + ' · ' + (c.plant ? Number(c.plant.slice(5,7)) + '월 ' + Number(c.plant.slice(8,10)) + '일 정식' : '정식일 미입력');
  let houses = [];
  function buildHouses() {
    const s = loadHouses();
    houses = ['2', '1', ...s.custom].map(id => ({
      id, house: '하우스 ' + id + '동', season: '작기 미확인', seasonLabel: seasonLabel(s.crops[id]),
      crop: s.crops[id]?.crop || '', plant: s.crops[id]?.plant || '', custom: !['1','2'].includes(id),
      score: id === '2' ? 65 : null, coverage: null
    }));
  }
  buildHouses();
  const pictures = [
    {key: 'aisle', name: '통로 전체 물 고임', path: 'flow-assets/aisle.webp?v=261127d'},
    {key: 'film', name: '비닐 하단 물자국', path: 'flow-assets/film.webp?v=261127d'}
  ];
  const seeds = [
    {id:'example-2',houseId:'2',memo:'통로 가운데 물이 고였어요.',date:'2026-11-22',time:'16:40',photo:'aisle'},
    {id:'example-1',houseId:'1',memo:'비닐 아래에 물자국이 남았어요.',date:'2026-11-22',time:'09:10',photo:'film'}
  ].map(row => ({...row, season:'작기 미확인',kind:'damage',sample:true,cause:'', fire:'', receiptAt:'', office:''}));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function session(key,value) {
    try {
      if(value === undefined) return sessionStorage.getItem(prefix + key);
      sessionStorage.setItem(prefix + key, value);
      return true;
    } catch (_) { /* current-tab in-memory navigation remains usable */ }
  }
  let active = houses.some(h => h.id === session('house')) ? session('house') : '2';
  let lastSaved = session('lastSaved') || '';
  let lastOpened = session('lastOpened') || '';
  let selectedDate = session('calendarDate') || '';
  let sourceRoute = session('detailBack') || 'journal';
  let repairBack = session('repairBack') || 'journal';
  let damageBack = 'home';
  let choice = {damage:'', plan:false};
  try {
    const state=JSON.parse(session('repairChoice')||'null');
    if(state?.house===active && state.season===context().season && state.record===lastOpened && ['','yes','none','unknown'].includes(state.damage)) {
      choice={damage:state.damage,plan:state.damage==='yes' && state.plan===true};
    }
  } catch (_) {}
  let basis = false;
  let drafts = new Map();

  // 피해 화면(#damage)으로 올 때만 적용하고, 저장 안 한 초안에 남은 동 값도 같은 동으로 맞춘다.
  // 한 번 적용한 뒤 주소에서 지워, 새로고침이나 뒤로 가기 때 사용자가 바꾼 동을 다시 덮지 않게 한다.
  const linkedHouse = houses.some(h => h.id === params.get('house')) && location.hash === '#damage' ? params.get('house') : '';
  if (linkedHouse) {
    selectContext(linkedHouse);
    const d = draft();
    // v21 2차: 넘겨받은 동은 농가가 고른 값으로 본다. 초안 메모에 다른 동 이름이 있어도 덮지 않게.
    const manual = new Set((d.manualFields || '').split(',').filter(Boolean)); manual.add('entryHouse');
    let base = {}; try { base = JSON.parse(d.inferredBaseline || '{}') || {}; } catch (_) {}
    delete base.entryHouse;
    Object.assign(d, {entryHouse: linkedHouse, manualFields: Array.from(manual).join(','), inferredBaseline: JSON.stringify(base)});
    keepDraft(linkedHouse, d);
  }
  if (params.has('house')) {
    try {
      const url = new URL(location.href); url.searchParams.delete('house');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    } catch (_) {}
  }
  const notice = '이 기록은 농협이나 보험사에 전달되지 않아요';
  const disclosure = '보험금 지급을 보장하지 않으며, 손해평가, 손해사정이 아닙니다.';
  const alertLine = '피해를 알게 되면 바로 가입한 농축협에 알리기';
  function context() {return houses.find(h => h.id === active);}
  function selectContext(id) {
    id = String(id);
    if (!houses.some(h => h.id === id) || id === active) return;
    active = id; session('house',id);
    lastOpened = ''; lastSaved = ''; sourceRoute = 'journal'; repairBack = 'journal';
    session('lastOpened',''); session('lastSaved',''); session('detailBack','journal');session('repairBack',repairBack);
    saveChoice({damage:'',plan:false}); basis = false;
  }
  function scopeKey(house = active) {return prefix + 'records-' + house + '-unconfirmed/';}
  function houseRecordKeys(id) {
    const keys = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(scopeKey(id))) keys.push(k); } } catch (_) {}
    return keys;
  }
  function addHouse(setting = {}) {
    const s = loadHouses(), used = new Set(['1','2', ...s.custom]);
    const id = ['3','4','5','6','7','8','9'].find(n => !used.has(n));
    if (!id) throw Error('동은 9동까지 추가할 수 있어요.');
    s.custom.push(id);
    if (CROPS.includes(setting.crop)) s.crops[id] = {crop: setting.crop, plant: isDate(setting.plant) ? setting.plant : ''};
    if (!saveHouses(s)) throw Error('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    syncSeason(id, s.crops[id]);
    buildHouses();
    return id;
  }
  function setHouseCrop(id, setting = {}) {
    id = String(id);
    if (!houses.some(h => h.id === id)) throw Error('동을 다시 골라 주세요.');
    const s = loadHouses();
    if (CROPS.includes(setting.crop)) s.crops[id] = {crop: setting.crop, plant: isDate(setting.plant) ? setting.plant : ''};
    else delete s.crops[id];
    if (!saveHouses(s)) throw Error('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    syncSeason(id, s.crops[id]);
    buildHouses();
  }
  // 보험 화면의 작기 일정(정식일)도 같은 값으로 맞춘다. 수확 종료 예정일은 그대로 둔다.
  function syncSeason(id, c) {
    try {
      let old = {}; try { old = JSON.parse(localStorage.getItem(seasonKey(id)) || '{}') || {}; } catch (_) {}
      // 정식일을 지우거나 작물을 '정하지 않음'으로 바꾸면 보험 화면 정식일도 비운다(교차검토 4번)
      const end = isDate(old.end) ? old.end : '';
      if (c?.plant || old.plant) localStorage.setItem(seasonKey(id), JSON.stringify({plant: c?.plant || '', end}));
    } catch (_) {}
  }
  function removeHouse(id) {
    id = String(id);
    const s = loadHouses();
    if (!s.custom.includes(id)) throw Error('시연 기본 동(1·2동)은 지울 수 없어요.');
    s.custom = s.custom.filter(n => n !== id); delete s.crops[id];
    if (!saveHouses(s)) throw Error('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    try { for (const k of houseRecordKeys(id)) localStorage.removeItem(k); localStorage.removeItem(seasonKey(id)); } catch (_) {}
    // 지운 동의 저장 안 한 초안·수정 초안도 지운다. 다시 같은 번호로 추가했을 때 옛 메모가 살아나지 않게(교차검토 2번)
    drafts.delete?.(id); session('draft-' + id, '');
    try { for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k?.startsWith(prefix + 'edit-' + id + '-')) sessionStorage.removeItem(k); } } catch (_) {}
    buildHouses();
    if (active === id) selectContext('2');
    // 다른 동 초안이 지운 동을 가리키면 그 초안의 동으로 되돌린다(저장이 말없이 막히지 않게, 교차검토 3번)
    for (const h of houses) {
      let d = drafts.get?.(h.id);
      if (!d) { try { d = JSON.parse(session('draft-' + h.id) || 'null'); } catch (_) { d = null; } }
      if (d?.entryHouse === id) { d.entryHouse = h.id; keepDraft(h.id, d); }
    }
  }
  function records() {
    let rows = [...seeds, ...window.FarmJournalSamples].filter(r => r.houseId === active && r.season === context().season);
    try {
      const start = scopeKey();
      for (let i=0;i<localStorage.length;i++) {
        const key=localStorage.key(i);
        if (!key?.startsWith(start)) continue;
        try {
          const r=JSON.parse(localStorage.getItem(key));
          if (r.houseId === active && r.season === context().season && typeof r.id === 'string' && typeof r.date === 'string' && typeof r.time === 'string') {
            rows=rows.filter(row => row.id !== r.id); rows.push(r);
          }
        } catch (_) { /* Ignore any malformed isolated entry. */ }
      }
    } catch (_) { /* Display the original sample even when storage is unavailable. */ }
    return rows.sort((a,b)=>(b.date+b.time+(b.created||'')).localeCompare(a.date+a.time+(a.created||'')));
  }
  function getRecord(id) {return records().find(r => r.id === id);}
  // 261126 기능 데모(PRD F03): 체험본(?trial=1)에서만. 고정 예시 질문 한 가지와 다음 날 일정 한 건.
  // 참가자 메모를 분석하지 않고 밖으로 보내지 않는다. 일정은 일지와 다른 자료라 records()·준비도에 넣지 않는다.
  const trial = window.FarmTrial?.on ? window.FarmTrial : null;
  const NEXT = {kind:'aisle-water', houseId:'2', crop:'딸기', title:'가운데 통로 물 빠짐 확인', question:'다음에 뭘 확인할까요?',
    answer:'다음 점검 때 가운데 통로에 물이 남아 있는지 확인해 보세요.', label:'AI 일정 제안 예시: 미리 준비한 기록과 답변입니다',
    basis:['2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22','2026-11-23']};
  // 같은 제안 판별: 회차(저장 구역) + 2동 + 작기 + 제안 종류 + 예정일(회차 시작 한국 날짜 D의 다음 날, 다시 열어도 밀리지 않음)
  // 작물·정식일은 다른 탭에서 바뀔 수 있어 저장소에서 바로 읽는다. 정식일(작기)이 바뀌면 다른 일정으로 본다.
  const season2 = () => { const c=loadHouses().crops[NEXT.houseId]; return {crop:c?.crop||'', plant:c?.plant||''}; };
  const planKey = (due,plant) => prefix+'plans-'+NEXT.houseId+'-unconfirmed/'+NEXT.kind+'-'+due+'-'+(plant||'noplant');
  function readPlan() {
    if(!trial) return null;
    const due=trial.planDay(), s=season2();
    if(s.crop!==NEXT.crop) return null;
    try { const p=JSON.parse(localStorage.getItem(planKey(due,s.plant))||'null'); if(p?.kind===NEXT.kind && p.due===due && p.houseId===NEXT.houseId && p.crop===NEXT.crop && (p.plant||'')===s.plant) return p; } catch (_) {}
    return null;
  }
  const nextHere = () => active===NEXT.houseId && season2().crop===NEXT.crop;
  function plansFor(date) { const p=nextHere()?readPlan():null; return p && (!date || p.due===date) ? [p] : []; }
  function ensurePlan() {
    const had=readPlan(); if(had) return had;
    const due=trial.planDay(), s=season2();
    if(s.crop!==NEXT.crop) throw Error('not strawberry');
    const p={id:'plan-'+trial.round.id+'-'+NEXT.houseId+'-'+NEXT.kind+'-'+due+'-'+(s.plant||'noplant'),kind:NEXT.kind,houseId:NEXT.houseId,crop:NEXT.crop,plant:s.plant,season:'작기 미확인',due,title:NEXT.title,source:'fixed-example',created:new Date().toISOString()};
    localStorage.setItem(planKey(due,s.plant),JSON.stringify(p));
    const saved=readPlan(); if(!saved) throw Error('plan not saved');
    return saved;
  }
  const ownCount = () => records().filter(r=>!r.sample).length;
  const canRepair=r=>r?.kind==='damage' && r.cause!=='화재' && r.cause!=='병해충';
  function readinessLabel(score,coverage) {
    if (coverage === false || ['미가입','uninsured','unsubscribed'].includes(coverage)) return '가입이 먼저예요';
    if (!Number.isFinite(score)) return '준비도 미확인';
    if (score >= 80) return '기록이 잘 쌓였어요';
    if (score >= 50) return '기록을 더 하면 좋아요';
    return '기록이 적어요';
  }
  function readinessSummary(count) {
    const c=context(), label=readinessLabel(c.score,c.coverage);
    const countLabel='이번 작기 기록 '+count+'건';
    if(label==='준비도 미확인'){
      return {caption:'기록 준비도',status:countLabel,note:'준비도 점수 정보가 없어요.'};
    }
    return {caption:'기록 준비도'+(Number.isFinite(c.score)?' · '+c.score+'점':''),status:label,note:countLabel};
  }
  function stamp(now) {
    const format = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const o = Object.fromEntries(format.formatToParts(now).map(x=>[x.type,x.value]));
    return {date:o.year+'-'+o.month+'-'+o.day,time:o.hour+':'+o.minute};
  }
  function dateLabel(str) {
    if (!str) return '';
    const [y,m,d] = str.split('-').map(Number);
    return y+'년 '+m+'월 '+d+'일';
  }
  const go = (route,options) => window.navigate(route,options);
  const tag = () => '<p class="ff-kicker">'+context().house+' <span>·</span> '+esc(context().seasonLabel)+'</p>';
  const heading = (name,caption='') => '<header class="ff-heading">'+tag()+'<h1>'+name+'</h1>'+(caption?'<p class="ff-lead">'+caption+'</p>':'')+'</header>';
  const btn = (label,key,primary=false) => '<button type="button" class="ff-btn '+(primary?'ff-primary':'ff-secondary')+'" data-ff-action="'+key+'">'+label+'</button>';
  const line = (key,value) => '<div class="ff-line"><dt>'+key+'</dt><dd>'+value+'</dd></div>';
  const wrap = content => '<article class="ff-screen">'+content+'</article>';
  const error = '<p class="ff-error" id="ff-error" role="alert" hidden></p>';
  const cta = (main,extra='') => '<div class="ff-actions">'+main+extra+'</div>';
  // v21: 시연 일지는 사진 여러 장(photos, journal-diary-data.js). 직접 쓴 기록은 기존처럼 한 장.
  const diaryPhotos = r => (r.photos||[]).map(k=>window.FarmDiaryPhotos?.[k]).filter(Boolean);
  const getPhoto = r => FarmPhoto.localImage(r) ? {path:r.data,name:r.photoTitle||'첨부한 사진'} : pictures.find(p=>p.key===r.photo) || diaryPhotos(r)[0];
  function photoFigure(r) {
    const many=diaryPhotos(r);
    if(many.length&&!FarmPhoto.localImage(r)&&!pictures.some(p=>p.key===r.photo)){
      return '<section class="ff-gallery" aria-label="사진 '+many.length+'장"><div class="ff-gallery-row">'+many.map((p,i)=>'<figure class="ff-gallery-item"><img src="'+esc(p.path)+'" alt="'+esc(p.name)+'" loading="lazy"><figcaption>'+(i+1)+'/'+many.length+' · '+esc(p.name)+'</figcaption></figure>').join('')+'</div>'+(window.FarmTrial?.on?'<button type="button" class="ff-gal-nav ff-gal-prev" data-gal="-1" aria-label="이전 사진" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" class="ff-gal-nav ff-gal-next" data-gal="1" aria-label="다음 사진" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>':'')+'<p class="ff-note">시연용으로 만든 사진이에요.</p></section>';
    }
    const p=getPhoto(r);
    return p?'<figure class="ff-figure"><img src="'+esc(p.path)+'" alt="'+esc(p.name)+'"><figcaption>'+esc(p.name)+(r.photo==='local'?'':' · 시연 사진')+'</figcaption></figure>':'';
  }
  const kinds = ['강풍/태풍','눈(대설)','우박','비(호우)','추위(한파/서리)','더위(폭염)','새/짐승','화재','그 밖'];
  function draft() {
    if (!drafts.has(active)) {
      const row={memo:'',cause:'',fire:'',receiptAt:'',office:'',photo:'',data:'',photoTitle:'',...FarmEntry.defaults()};
      try {
        const stored=JSON.parse(session('draft-'+active)||'null');
        if(stored)for(const k of Object.keys(row))if(typeof stored[k]==='string')row[k]=stored[k];
      } catch (_) {}
      drafts.set(active,row);
    }
    return drafts.get(active);
  }
  function keepDraft(house, row) {
    if (!session('draft-'+house,JSON.stringify(row)) && row.photo === 'local') {
      return '사진은 이 탭에 있어요. 새로고침하기 전에 기록을 저장해 주세요.';
    }
  }
  function check(name,value,text,chosen,type='radio') {
    return '<label class="ff-choice"><input type="'+type+'" name="'+name+'" value="'+esc(value)+'"'+(chosen?' checked':'')+'><span>'+text+'</span></label>';
  }
  function fireHint(value) {
    if(value==='모름') return '보험증권의 화재 특약 가입란을 보거나 가입한 농축협에 문의하세요.';
    if(value==='가입') return '보험증권에 적힌 화재 특약을 확인하세요.';
    if(value==='미가입') return '화재 특약 미가입으로 기록해요.';
    return '보험증권에서 확인한 상태를 선택해 주세요.';
  }

  function entrySections(d,route) {
    const memo='<section class="ff-block"><div class="ff-labelrow"><label for="ff-memo">관찰 메모</label>'+btn('예시 메모 넣기','example')+'</div>'+
      '<textarea id="ff-memo" name="memo" maxlength="2000" rows="3" aria-describedby="ff-dictate" placeholder="예: 통로에 물이 고였어요">'+esc(d.memo)+'</textarea><p id="ff-dictate" class="ff-note ff-dictate"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg><span>입력칸을 누른 뒤 휴대폰 키보드의 받아쓰기 버튼으로 말해 보세요.</span></p></section>';
    const photo='<section class="ff-block" id="ff-photo"><h2>현장 사진 <small>선택</small></h2>'+FarmPhoto.markup()+'<details class="journal-photo-samples"'+(pictures.some(p=>p.key===d.photo)?' open':'')+'><summary>예시 사진 고르기</summary><div class="ff-pics">'+pictures.map(p=>'<label class="ff-pic"><img src="'+p.path+'" alt=""><span><input type="radio" name="photoSample" value="'+p.key+'" '+(d.photo===p.key?'checked':'')+'>'+p.name+'</span></label>').join('')+'</div></details></section>';
    const causes='<fieldset class="ff-block" id="ff-causes"><legend>원인 <small>선택</small></legend><div class="ff-choices">'+kinds.map(k=>check('cause',k,k,d.cause===k)).join('')+'</div><div class="ff-sub" id="ff-branch"></div></fieldset>';
    const info=FarmEntry.editor(d), times=FarmEntry.times(d);
    return route==='damage' ? info+times+causes+memo+photo : info+memo+times+photo+causes;
  }
  function damageView(route) {
    const d=draft();
    FarmEntry.prepare(d,active,route);
    return wrap('<div class="ff-alert" id="ff-damage-alert"><span aria-hidden="true">!</span><strong>'+alertLine+'</strong></div>'+
      '<h1 id="ff-entry-title"></h1><p class="ff-lead" id="ff-safety">안전한 곳에서 피해가 더 커지지 않도록 먼저 조치하세요. 사진은 나중에 남겨도 돼요.</p>'+
      // 261128 효신(손해평가사 검토): 수확 전 연락 안내. 피해 기록일 때만 보인다(필수 확인·기한·미지급 조건 없음)
      '<p class="ff-lead" id="ff-harvest">피해를 입은 작물을 수확할 예정이라면, 수확 전에 가입한 농축협에 알려 주세요.</p>'+
      // v21 1차(검수 2순위): 이미 농축협에 알린 농가가 맨 아래 접수 칸을 바로 찾도록 위에서 이동
      '<button type="button" class="ff-jump" id="ff-jump-reception" data-ff-action="jump-reception">농축협 접수 기록 적기 <span aria-hidden="true">›</span></button>'+
      '<form id="ff-form"><div class="ff-grid"><div class="ff-col">'+entrySections(d,route)+
      '</div><div class="ff-col"><section class="ff-block" id="ff-reception"><h2>농축협 접수 기록 <small>선택</small></h2><p class="ff-note">직접 접수한 뒤 일시와 접수처를 적어 주세요.</p>'+
      '<label for="ff-receipt">접수 일시</label><input type="datetime-local" id="ff-receipt" name="receiptAt" value="'+esc(d.receiptAt)+'"><label for="ff-office">접수처</label><input id="ff-office" name="office" maxlength="150" value="'+esc(d.office)+'" placeholder="직접 접수한 농축협 이름"></section>'+
      '</div></div>'+
      '<div class="ff-actions ff-save-bar">'+error+'<p class="ff-save-summary" data-entry-summary></p><p class="ff-save-need" id="ff-save-need" hidden>관찰한 내용을 적거나 사진 한 장을 골라 주세요.</p><p class="ff-save-notice" id="ff-save-notice" hidden>이 기록은 농협이나 보험사에 전달되지 않아요</p><button class="ff-btn ff-primary" id="ff-save" type="submit">기록 저장</button></div></form>');
  }
  function drawBranch() {
    const d=draft(), host=document.querySelector('#ff-branch');
    if (!host) return;
    const damage=d.entryType==='damage', pest=d.entryType==='pest', fire=damage && d.cause==='화재';
    const fireInput=host.querySelector('input[name="fire"]');
    if(fire && !fireInput)host.innerHTML='<fieldset class="ff-fire"><legend>화재 특약</legend><div class="ff-choices">'+['가입','미가입','모름'].map(x=>check('fire',x,x,d.fire===x)).join('')+'</div><p class="ff-note" aria-live="polite">'+fireHint(d.fire)+'</p></fieldset>';
    if(!fire)host.replaceChildren();
    document.querySelector('#ff-entry-title').textContent=damage?'피해 기록':pest?'병·벌레 기록':'농장 기록';
    for(const id of ['ff-safety','ff-harvest','ff-causes'])document.getElementById(id).hidden=!damage;
    document.getElementById('ff-damage-alert').hidden=!(damage||pest);
    document.getElementById('ff-reception').hidden=!(damage||pest);
    document.getElementById('ff-save-notice').hidden=!(damage||pest);
    document.getElementById('ff-jump-reception').hidden=!(damage||pest);
    document.querySelector('#ff-save').textContent='기록 저장';
  }
  // 화면 표시만: 저장 바의 오류는 그 원인이 풀렸을 때만 지운다(메모·사진 없음, 화재 특약 미선택).
  function clearResolvedError() {
    const el=document.querySelector('#ff-error'),d=draft();
    if(!el||el.hidden)return;
    // 폼 입력 처리기보다 먼저 불릴 수 있어 화면의 현재 값으로 판단한다.
    const q=s=>document.querySelector('#ff-form '+s);
    const memo=q('#ff-memo')?.value??d.memo, cause=q('input[name="cause"]:checked')?.value??d.cause, fire=q('input[name="fire"]:checked')?.value??d.fire;
    const photo=d.photo||q('input[name="photoSample"]:checked')?.value;
    const memoOpen=!memo.trim()&&!photo, fireOpen=d.entryType==='damage'&&cause==='화재'&&!fire;
    // 261126(T12): 저장 실패 같은 다른 안내는 다음 저장 시도 전까지 남긴다(메모 칸을 떠나는 순간 지워지던 문제)
    if(window.FarmTrial?.on&&!el.textContent.startsWith('관찰한')&&!el.textContent.startsWith('화재 특약'))return;
    if((el.textContent.startsWith('관찰한')&&memoOpen)||(el.textContent.startsWith('화재 특약')&&fireOpen))return;
    showError('');
  }
  function showError(message) {
    const el=document.querySelector('#ff-error');
    if (el) {el.hidden=!message;el.textContent=message;}
    const need=document.querySelector('#ff-save-need');if(need&&message)need.hidden=true;
  }
  function saveDraft(event) {
    event.preventDefault();
    const form=event.currentTarget,d=draft();
    if(form.dataset.saved==='true') return;
    if(FarmPhoto.busy(d)) {showError('사진을 준비한 뒤 저장해 주세요.');return;}
    if(!d.memo.trim() && !d.photo) { showError('관찰한 내용을 적거나 사진 한 장을 골라 주세요.');form.querySelector('textarea').focus();return; }
    if(!FarmEntry.valid(d,form))return;
    if(d.entryType==='damage' && d.cause==='화재' && !d.fire) {showError('화재 특약 상태를 선택해 주세요. 확인 전이면 모름을 선택하세요.');form.querySelector('input[name="fire"]').focus();return;}
    const now=new Date(), id=crypto.randomUUID?.() || now.getTime()+'-'+Math.random().toString(36).slice(2);
    const target=houses.find(h=>h.id===d.entryHouse);
    if(!target){showError('기록을 남길 동을 선택해 주세요.');return;}
    const damage=d.entryType==='damage', pest=d.entryType==='pest';
    const row={id,date:d.entryDate,time:stamp(now).time,houseId:target.id,season:target.season,created:now.toISOString(),entryType:d.entryType,
      quantity:d.quantity,unit:d.unit,photo:d.photo,data:d.data,photoTitle:d.photoTitle,
      kind:damage?'damage':'journal',cause:pest?'병해충':damage?d.cause:'',memo:d.memo,office:damage||pest?d.office:'',receiptAt:damage||pest?d.receiptAt:'',fire:damage && d.cause==='화재'?d.fire:'',
      discoveredAt:damage?d.discoveredAt:'',accidentAt:damage?d.accidentAt:''};
    try {localStorage.setItem(scopeKey(target.id)+id,JSON.stringify(row));}
    catch (_) {showError('이 브라우저에 저장하지 못했어요. 입력은 그대로 있어요. 저장 공간을 확인하거나 사진을 빼고 다시 시도해 주세요.');return;}
    form.dataset.saved='true';form.querySelector('#ff-save').disabled=true;
    drafts.delete(active);session('draft-'+active,'');selectContext(target.id);setDate(row.date);lastSaved=id;lastOpened=id;
    session('lastSaved',id);session('lastOpened',id);saveChoice({damage:'',plan:false});basis=false;
    sourceRoute='journal';session('detailBack',sourceRoute);go('saved');
  }
  function bindDamage() {
    const form=document.querySelector('#ff-form'),d=draft(), formHouse=active;
    FarmEntry.bind(form,d,()=>{
      if(d.entryType==='damage' && d.cause==='병해충'){
        d.cause='';
      }
      keepDraft(formHouse,d);drawBranch();
    });
    drawBranch();
    let afterPhoto=()=>{};
    FarmPhoto.bind(form.querySelector('#ff-photo'),d,()=>{keepDraft(formHouse,d);afterPhoto();},busy=>{form.querySelector('#ff-save').disabled=busy;});
    form.addEventListener('submit',saveDraft);
    // 화면 표시만: 저장 버튼 위에 지금 고른 동·날짜·종류를 보여 준다. 저장 값은 d 그대로.
    const summary=form.querySelector('[data-entry-summary]');
    // v21 1차(검수 1·2순위): 메모가 있으면 '예시 메모 넣기'를 숨겨 다른 문장으로 바꾸는 일을 막고, 메모·사진이 모두 없으면 저장 조건을 미리 보여 준다
    const exampleBtn=form.querySelector('[data-ff-action="example"]'),need=form.querySelector('#ff-save-need');
    const showSummary=()=>{const pick=n=>form.querySelector('[name="'+n+'"]')?.selectedOptions?.[0]?.text||'';summary.textContent=[pick('entryHouse'),dateLabel(d.entryDate).replace(new RegExp('^'+new Date().getFullYear()+'년 '),''),pick('entryType')].filter(Boolean).join(' · ');
      const memo=form.querySelector('#ff-memo')?.value||'';
      if(exampleBtn)exampleBtn.hidden=!!memo.trim();
      if(need)need.hidden=!!(memo.trim()||d.photo)||!document.querySelector('#ff-error')?.hidden;};

    const refreshHints=()=>setTimeout(()=>{showSummary();clearResolvedError();});
    afterPhoto=refreshHints;
    form.addEventListener('input',()=>{showSummary();clearResolvedError();});form.addEventListener('change',refreshHints);showSummary();
    form.addEventListener('input',e=>{const el=e.target;if(['memo','office','receiptAt'].includes(el.name)){d[el.name]=el.value;keepDraft(formHouse,d);}});
    form.addEventListener('change',async e=>{
      const el=e.target;
      if(el.name==='cause'){d.cause=el.value;d.fire='';drawBranch();}
      if(el.name==='fire'){d.fire=el.value;form.querySelector('.ff-fire .ff-note').textContent=fireHint(d.fire);}
      if(el.name==='photoSample')FarmPhoto.chooseSample(d,el.value);
      if(['cause','fire','photoSample'].includes(el.name))keepDraft(formHouse,d);
    });
  }
  function receiptInfo(r) {
    return '<dl class="ff-rows">'+line('접수 일시',r.receiptAt?esc(r.receiptAt.replace('T',' ')):'<span class="ff-muted">미입력</span>')+line('접수처',r.office?esc(r.office):'<span class="ff-muted">미입력</span>')+'</dl>';
  }
  function receiptEditor(r) {
    return '<details class="ff-fold ff-receipt-edit"><summary>접수 정보 직접 적기</summary><form id="ff-receipt-form" class="ff-block"><p class="ff-note">농축협에 직접 접수한 뒤 입력하세요.</p><label for="ff-edit-at">접수 일시</label><input type="datetime-local" id="ff-edit-at" name="receiptAt" value="'+esc(r.receiptAt)+'"><label for="ff-edit-office">접수처</label><input id="ff-edit-office" name="office" maxlength="150" value="'+esc(r.office)+'"><div class="ff-actions"><button type="submit" class="ff-btn ff-secondary">접수 정보 저장</button></div><p role="alert" class="ff-error"></p></form></details>';
  }
  function facts(r) {
    const type=FarmJournalEdit.typeOf(r);
    return '<dl class="ff-rows">'+line('기록 날짜',dateLabel(r.date))+line('기록 종류',FarmJournalEdit.typeNames[type])+
      (r.created?line('처음 저장한 때',esc(FarmJournalEdit.stamp(r.created))):'')+
      (r.quantity||r.unit?line('수량',esc([r.quantity,r.unit].filter(Boolean).join(' '))):'')+
      (type==='damage'?line('원인',esc(r.cause||'미선택'))+line('처음 발견한 때',esc(r.discoveredAt?.replace('T',' ')||'미입력'))+line('실제 사고 시각',esc(r.accidentAt?.replace('T',' ')||'미입력')):'')+
      (r.cause==='화재'?line('화재 특약',esc(r.fire||'미선택')):'')+'</dl>';
  }
  function emptyState(title,desc) {return wrap(heading(title,desc)+cta(btn('농장 일지 보기','journal',true)));}
  function missingRecord() {return emptyState('이 기록을 찾을 수 없어요','삭제되었거나 이 동의 일지에서 열 수 없는 기록이에요.');}
  function savedView() {
    const r=getRecord(lastSaved);
    if(!r) return missingRecord();
    const type=FarmJournalEdit.typeOf(r), p=getPhoto(r);
    const summary=r.memo?.trim()?r.memo:'현장 사진 1장';
    return wrap('<header class="ff-saved-heading je-saved"><div class="ff-successmark" aria-hidden="true">✓</div>'+
      '<h1>농장 일지에 저장했어요</h1><p class="ff-notice">'+notice+'</p>'+
      '<div class="je-saved-preview"><div class="je-preview-text"><p class="je-record-type">'+FarmJournalEdit.typeNames[type]+'</p>'+
      '<p class="je-preview-place">'+esc(context().house)+' · '+dateLabel(r.date)+' 일지</p>'+
      '<p class="je-preview-meta">'+esc(r.season)+' · '+savedCaption(r)+'</p>'+
      '<p class="ff-memo">'+esc(summary)+'</p></div>'+
      (p?'<img class="je-thumb" src="'+esc(p.path)+'" alt="첨부 사진">':'')+'</div>'+
      cta(btn('방금 쓴 기록 보기','open-saved',true))+'</header>'+
      (type!=='work'?'<section class="ff-block"><h2>직접 적은 접수 정보</h2>'+receiptInfo(r)+'</section>':'')+
      nextPrompt('saved')+'<div class="je-saved-links">'+(canRepair(r)?btn('비닐 수리비 확인','begin-repair'):'')+btn('일지 목록 보기','journal')+btn('홈으로','home')+'</div>');
  }
  function savedCaption(r){
    if(r.sample)return esc(r.time)+' · 시연 기록';
    const saved=new Date(r.created);
    if(!Number.isFinite(saved.getTime()))return esc(r.time)+' 저장';
    const actual=stamp(saved);
    return (actual.date!==r.date?dateLabel(actual.date)+' ':'')+esc(actual.time)+' 저장';
  }
  function journalRow(r) {
    const p=getPhoto(r), n=diaryPhotos(r).length;
    return '<button type="button" class="ff-entry" data-ff-record="'+esc(r.id)+'">'+(p?'<span class="ff-entry-thumb"><img src="'+esc(p.path)+'" alt="" loading="lazy">'+(n>1?'<i aria-label="사진 '+n+'장">'+n+'</i>':'')+'</span>':'<span class="ff-entry-mark" aria-hidden="true">☰</span>')+
    '<span class="ff-entry-text"><span>'+esc(r.memo||'사진 기록')+'</span><small>'+savedCaption(r)+(FarmJournalEdit.typeOf(r)==='pest'?' · 병·벌레 기록':'')+'</small></span><b aria-hidden="true">›</b></button>';
  }

  function nextPrompt(where) {
    if(!trial || !nextHere()) return '';
    if(where==='journal' && !ownCount() && !readPlan()) return '';
    return '<section class="ff-block ff-next" aria-labelledby="ff-next-'+where+'"><p class="ff-next-tag">AI 일정 제안 예시</p><h2 id="ff-next-'+where+'">다음 작업 확인</h2>'+
      '<p class="ff-note">미리 준비한 기록과 답변이에요. 직접 쓴 메모는 분석하지 않아요.</p>'+btn(NEXT.question,'ask-next')+'<p class="ff-error" data-next-error role="alert" hidden></p></section>';
  }
  function nextView() {
    if(!trial) return emptyState('체험본에서 여는 예시예요','농장 일지로 돌아가 주세요.');
    if(!nextHere()) return emptyState('딸기 하우스 2동 예시예요','동을 딸기 하우스 2동으로 바꾸면 이 예시를 볼 수 있어요.');
    // 근거: 11월 17~23일 2동 시연 일지(11월 22일 물 고임 기록 example-2 포함)
    const p=readPlan(), basis=records().filter(r=>r.sample && NEXT.basis.includes(r.date));
    const latest=basis[0], rest=basis.slice(1);
    const failText=ownCount()?'일지는 저장됐고 일정은 추가되지 않았어요.':'일정은 추가되지 않았어요.';
    return wrap('<header class="ff-heading">'+tag()+'<h1>'+NEXT.question+'</h1><p class="ff-next-tag">'+NEXT.label+'</p></header>'+
      '<section class="ff-block"><h2>답변</h2><p class="ff-memo">'+NEXT.answer+'</p><p class="ff-note">병해충 진단, 약량 처방이나 보험 판단이 아니에요. 직접 쓴 메모를 바꿔도 이 답변은 같아요.</p></section>'+
      (p?'<section class="ff-block" id="ff-plan"><h2>추가한 일정</h2><dl class="ff-rows">'+line('할 일',esc(p.title))+line('예정일',dateLabel(p.due))+line('동',context().house)+line('출처','고정 예시 답변')+'</dl>'+
          '<p class="ff-note">이미 한 일을 적는 일지와 다른 자료예요. 일지 건수와 기록 준비도에 더하지 않아요.</p></section>'
        :ownCount()?'<section class="ff-block" id="ff-plan"><h2>추가한 일정</h2><p class="ff-error" role="alert">'+failText+'</p>'+btn('일정만 다시 추가','ask-next')+'<p class="ff-error" data-next-error role="alert" hidden></p></section>'
        :'<section class="ff-block" id="ff-plan"><h2>추가한 일정</h2><p class="ff-note">오늘 일지를 먼저 저장하면 예시 질문을 고를 수 있어요.</p>'+btn('새 기록 남기기','record')+'</section>')+
      '<section class="ff-block"><h2>답변 근거</h2><p class="ff-note">11월 17~23일 하우스 2동 시연 일지예요. 참가자가 쓴 메모가 아니에요.</p>'+(latest?journalRow(latest):'')+
      (rest.length?'<details class="ff-fold"><summary>11월 17~22일 기록 '+rest.length+'건 더 보기</summary>'+rest.map(journalRow).join('')+'</details>':'')+'</section>'+
      cta(p?btn('달력에서 일정 보기','plan-calendar',true):'',btn('일지 목록 보기','journal')));
  }
  const planRow = p => '<button type="button" class="ff-entry ff-plan-entry" data-ff-action="open-plan"><span class="ff-entry-mark" aria-hidden="true">◷</span><span class="ff-entry-text"><span>'+esc(p.title)+'</span><small>예정 일정 · AI 일정 제안 예시(고정 답변)</small></span><b aria-hidden="true">›</b></button>';

  const JOURNAL_OPEN_DAYS=5;

  const journalFilter=mineOnly=>'<div class="ff-filter" role="group" aria-label="기록 보기">'+
    '<button type="button" class="ff-btn ff-secondary" data-ff-action="filter-all" aria-pressed="'+!mineOnly+'">전체</button>'+
    '<button type="button" class="ff-btn ff-secondary" data-ff-action="filter-mine" aria-pressed="'+mineOnly+'">직접 쓴 기록</button></div>';
  function journalView() {
    const mineOnly=session('journalFilter')==='mine';
    const all=records(), rows=mineOnly?all.filter(r=>!r.sample):all, grouped=new Map();
    rows.forEach(r=>{if(!grouped.has(r.date))grouped.set(r.date,[]);grouped.get(r.date).push(r);});
    const groups=[...grouped].map(([d,items])=>'<section class="ff-block"><h2>'+dateLabel(d)+'</h2>'+items.map(journalRow).join('')+'</section>');
    const older=groups.slice(JOURNAL_OPEN_DAYS), olderCount=[...grouped].slice(JOURNAL_OPEN_DAYS).reduce((n,[,items])=>n+items.length,0);
    return wrap(heading('농장 일지')+'<div class="ff-jtabs"><strong>목록</strong>'+btn('달력','calendar')+'</div>'+journalFilter(mineOnly)+
      cta(btn('새 기록 남기기','record',true))+nextPrompt('journal')+
      (rows.length?'':'<p class="ff-note">이 동에 직접 쓴 기록이 없어요.</p>')+
      groups.slice(0,JOURNAL_OPEN_DAYS).join('')+
      (older.length?'<details class="ff-fold ff-older"'+(session('journalOlderOpen')==='yes'?' open':'')+'><summary>지난 기록 '+olderCount+'건 더 보기</summary>'+older.join('')+'</details>':''));
  }
  function ensureDate() {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate))setDate(records()[0]?.date || stamp(new Date()).date);
  }
  function setDate(value) {selectedDate=value;session('calendarDate',value);}
  // v21(C4): 달 이동은 제목 양옆의 화살표 버튼. 버튼 이름은 화면 읽기 프로그램용으로 남긴다.
  const monthNav=(label,key,mark)=>'<button type="button" class="ff-btn ff-secondary ff-month-nav" data-ff-action="'+key+'" aria-label="'+label+'"><span aria-hidden="true">'+mark+'</span></button>';
  // 261127 효신 요청: 체험본 달력에 24절기 표시
  const termOf=key=>trial&&window.FarmJeolgi?FarmJeolgi.at(key):'';
  // 261127 허간: 달력 제목(2026년 11월)을 누르면 아래로 말풍선이 열리고 지난 달들로 바로 이동(체험본)
  function monthPicker(year,month,rows){
    const pad=n=>String(n).padStart(2,'0'), today=stamp(new Date()).date, [ty,tm]=today.split('-').map(Number);
    const count=new Map();for(const r of rows){const k=String(r.date).slice(0,7);count.set(k,(count.get(k)||0)+1);}
    const items=[];for(let i=-11;i<=2;i++){const d=new Date(Date.UTC(ty,tm-1+i,1)),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,k=y+'-'+pad(m);items.push({y,m,k,n:count.get(k)||0,now:i===0,sel:y===year&&m===month});}
    return '<div class="ff-month-pick"><button type="button" class="ff-month-btn" data-ff-action="month-open" aria-haspopup="true" aria-expanded="false" aria-controls="ff-month-pop"><h2>'+year+'년 '+month+'월</h2><span class="ff-month-caret" aria-hidden="true"></span></button>'+
      '<div class="ff-month-pop" id="ff-month-pop" role="menu" aria-label="달 고르기" hidden>'+items.reverse().map(it=>'<button type="button" role="menuitemradio" aria-checked="'+it.sel+'" class="ff-month-item'+(it.sel?' is-sel':'')+'" data-ff-action="month-go" data-month="'+it.k+'"><span>'+it.y+'년 '+it.m+'월'+(it.now?' <em>이번 달</em>':'')+'</span><small>'+(it.n?it.n+'건':'기록 없음')+'</small></button>').join('')+'</div></div>';
  }
  function calendarView() {
    ensureDate();
    const mineOnly=session('journalFilter')==='mine';
    const [year,month]=selectedDate.split('-').map(Number),rows=mineOnly?records().filter(r=>!r.sample):records(),counts=new Map(),mine=new Set(),today=stamp(new Date()).date;
    for(const row of rows){counts.set(row.date,(counts.get(row.date)||0)+1);if(!row.sample)mine.add(row.date);}
    const planDays=new Set(plansFor().map(p=>p.due));
    const sc=trial&&window.FarmSaecham?FarmSaecham.calendarBits(context(),records()):null;   // 261127 구르미 달력 제안(체험본)
    const scCell=key=>{const l=sc?.byDay.get(key);if(!l)return '';const ok=l.every(p=>p.accepted);return '<span class="ff-cal-sug'+(ok?' is-accepted':'')+'" aria-hidden="true">'+(ok?'할 일':'제안')+'</span>';};
    const first=new Date(Date.UTC(year,month-1,1)).getUTCDay(),num=new Date(Date.UTC(year,month,0)).getUTCDate();
    const pad=n=>String(n).padStart(2,'0');
    let days='<span aria-hidden="true"></span>'.repeat(first);
    for(let i=1;i<=num;i++){
      const key=year+'-'+pad(month)+'-'+pad(i);
      const count=counts.get(key)||0;

      const isToday=key===today, hasMine=mine.has(key);
      const name=dateLabel(key)+(termOf(key)?', 절기 '+termOf(key):'')+', 기록 '+count+'건'+(hasMine?', 직접 쓴 기록 있음':'')+(planDays.has(key)?', 예정 일정 1건':'')+(sc?.byDay.has(key)?', 구르미 제안 '+sc.byDay.get(key).length+'건':'')+(isToday?', 오늘':'');
      days+='<button type="button" data-ff-date="'+key+'" aria-label="'+name+'" aria-pressed="'+(selectedDate===key)+'"'+(isToday?' aria-current="date"':'')+'><span class="ff-cal-day">'+i+'</span>'+(count?'<span class="ff-cal-count">'+count+'건</span>':'')+(hasMine?'<i class="ff-cal-mine" aria-hidden="true"></i>':'')+(planDays.has(key)?'<span class="ff-cal-plan" aria-hidden="true">일정</span>':'')+(termOf(key)?'<span class="ff-cal-term" aria-hidden="true">'+termOf(key)+'</span>':'')+scCell(key)+'</button>';
    }
    const items=rows.filter(r=>r.date===selectedDate);
    return wrap(heading('농장 일지')+'<div class="ff-jtabs">'+btn('목록','journal')+'<strong>달력</strong></div>'+journalFilter(mineOnly)+(sc?FarmSaecham.calendarBanner(context(),records()):'')+
      '<section class="ff-block"><div class="ff-month">'+monthNav('이전 달','prev-month','‹')+(trial?monthPicker(year,month,rows):'<h2>'+year+'년 '+month+'월</h2>')+monthNav('다음 달','next-month','›')+'</div><div class="ff-calendar">'+[...'일월화수목금토'].map(x=>'<b>'+x+'</b>').join('')+days+'</div><p class="ff-cal-legend"><i class="ff-cal-mine" aria-hidden="true"></i>직접 쓴 기록이 있는 날'+(planDays.size?'<span class="ff-cal-plan-legend">일정 = AI 일정 제안 예시로 추가한 예정 일정</span>':'')+(trial?'<span class="ff-cal-term-legend">절기 이름 = 24절기(시연용 계산값)</span>':'')+(sc?'<span class="ff-cal-sug-legend">제안·할 일 = 구르미(AI 비서)가 정리한 일정</span>':'')+'</p></section>'+
      '<section class="ff-block"><h2>'+dateLabel(selectedDate)+(termOf(selectedDate)?' <span class="ff-day-term">'+termOf(selectedDate)+' · '+FarmJeolgi.meaning(termOf(selectedDate))+'</span>':'')+'</h2>'+(items.length?items.map(journalRow).join(''):'<p class="ff-note">이날 저장한 기록이 없어요.</p>')+(plansFor(selectedDate).length?'<h3 class="ff-plan-head">예정 일정</h3>'+plansFor(selectedDate).map(planRow).join(''):'')+(sc?FarmSaecham.dayList(context(),records(),selectedDate):'')+'</section>');
  }
  function detailView(r) {
    if(!r) return missingRecord();
    const authored=directRow(r.id);
    const backLabel={calendar:'선택한 날짜로 돌아가기',home:'홈으로',journal:'일지 목록으로'}[sourceRoute]||'일지 목록으로';
    const type=FarmJournalEdit.typeOf(r);
    return wrap('<header class="ff-heading je-detail-heading">'+tag()+

      '<h1>'+dateLabel(r.date)+' 일지</h1><p class="je-preview-meta">'+FarmJournalEdit.typeNames[type]+' · '+savedCaption(r)+'</p>'+
      (authored?'<div class="je-note-actions je-record-actions">'+btn('수정','edit-record',true)+btn('삭제','delete-record')+'</div>':'')+'</header>'+
      '<section class="ff-block je-detail-note"><div class="je-note-head"><h2>관찰 메모</h2>'+
      '</div><p class="ff-memo">'+esc(r.memo?.trim()?r.memo:'메모 없음')+'</p>'+photoFigure(r)+'</section>'+
      (authored?FarmJournalEdit.history(r):'')+
      (type!=='work'?'<section class="ff-block"><h2>직접 적은 접수 정보</h2>'+receiptInfo(r)+'<p class="ff-note">'+notice+'</p>'+(trial&&r.sample?'<p class="ff-note">시연 예시 기록은 체험에서 고칠 수 없어요.</p>':receiptEditor(r))+'</section>':'')+
      '<section class="ff-block"><h2>기록 정보</h2>'+facts(r)+(r.fire?'<p class="ff-note">'+fireHint(r.fire)+'</p>':'')+'</section>'+
      cta(canRepair(r)?btn('비닐 수리비 확인','begin-repair'):'',btn(backLabel,'detail-back')));
  }
  function directRow(id){
    if(!id || [...seeds,...window.FarmJournalSamples].some(r=>r.id===id))return;
    try{
      const r=JSON.parse(localStorage.getItem(scopeKey()+id));
      if(r?.id===id && !r.sample && r.houseId===active && r.season===context().season && r.created)return r;
    }catch{}
  }
  function revision(r){return JSON.stringify([r.created,r.updatedAt||'',r.editHistory?.length||0,r.receiptAt,r.office]);}
  function editDraft(id){
    try{return JSON.parse(session('edit-'+active+'-'+id)||'null');}catch{return null;}
  }
  function editView(id,deleting){
    const r=directRow(id);
    if(!r)return emptyState('직접 쓴 기록을 찾을 수 없어요','농장 일지에서 기록을 다시 선택해 주세요.');
    const saved=editDraft(id);
    return wrap(heading(deleting?'기록 삭제':'기록 수정',context().house+' · '+dateLabel(r.date))+
      (deleting?FarmJournalEdit.confirm(r):FarmJournalEdit.editor(r,saved?.working)));
  }
  function bindEdit(id){
    const form=document.querySelector('#je-form,#je-delete'),base=directRow(id);
    if(!form||!base)return;
    const house=active,key=scopeKey()+id,draftKey='edit-'+house+'-'+id;
    const version=form.id==='je-form'?(editDraft(id)?.version||revision(base)):revision(base);
    FarmJournalEdit.bind(form,base,{
      remember:working=>session(draftKey,JSON.stringify({version,working})),discard:()=>session(draftKey,''),
      save:async update=>{
        function commit(){
          const current=directRow(id);
          if(active!==house||!current||revision(current)!==version)throw Error('기록이 다른 화면에서 바뀌었어요. 취소한 뒤 기록을 다시 열어 주세요.');
          try{
            if(update){const next=FarmJournalEdit.apply(current,update,new Date().toISOString());localStorage.setItem(key,JSON.stringify(next));}
            else localStorage.removeItem(key);
          }catch{throw Error('이 브라우저에 반영하지 못했어요. 입력을 유지했어요. 다시 시도해 주세요.');}
        }
        if(navigator.locks)await navigator.locks.request(key,commit);else commit();
      },
      finish:deleted=>{
        if(!deleted){go('detail/'+id,{replace:true});return;}
        if(lastSaved===id){lastSaved='';session('lastSaved','');}
        if(lastOpened===id){lastOpened='';session('lastOpened','');}
        saveChoice({damage:'',plan:false});basis=false;
        go(sourceRoute,{replace:true});window.announceFarmStatus('선택한 기록 한 건을 삭제했어요.');
      }
    });
  }
  function readView() {
    const result=readinessSummary(records().length);
    const explanation='기록 건수에는 시연 일지가 포함돼요.'+(active==='2'?' 2동의 65점은 미리 정한 시연 점수예요.':'');
    return wrap(heading('기록 준비도',explanation)+
      '<div class="ff-result"><p class="ff-note">'+result.caption+'</p><h2>'+result.status+'</h2><p>'+result.note+'</p><p>수리비와는 별개예요.</p></div><p class="ff-note">'+disclosure+'</p>'+
      '<section class="ff-block"><h2>준비도 구간</h2><dl class="ff-rows">'+line('가입 · 80점 이상','기록이 잘 쌓였어요')+line('가입 · 50~79점','기록을 더 하면 좋아요')+line('가입 · 50점 미만','기록이 적어요')+line('미가입','가입이 먼저예요')+'</dl></section>'+cta(btn('홈으로','home',true)));
  }
  function repairSuffix() {return '/from-record-'+active+'-'+lastOpened;}
  function shopOrigin(route){
    const token=String(route).split('/').at(-1);
    return canRepair(getRecord(lastOpened)) && choice.damage==='yes' && choice.plan && '/'+token===repairSuffix()?'/'+token:'';
  }
  function mallOptions(route) {
    return {assetBase:'',preview:mallPreview,origin:shopOrigin(route),go};
  }
  function repairView(id) {
    const r=(!id||id===lastOpened)&&getRecord(lastOpened);
    if(!canRepair(r))return emptyState('수리 조건을 확인할 기록이 없어요','농장 일지에서 하우스 기록을 선택해 주세요.');
    return wrap(heading('수리 조건 확인','사진이나 관찰 메모와 별도로 직접 선택해 주세요.')+
      '<p class="ff-context">'+context().house+' · '+dateLabel(r.date)+' · '+esc(r.memo||'사진 기록')+'</p>'+
      '<fieldset class="ff-block"><legend>비닐 손상 여부</legend><div class="ff-options">'+[['yes','직접 손상을 확인했어요'],['none','비닐 손상 없음'],['unknown','손상 여부 미확인']].map(([v,t])=>check('damaged',v,t,choice.damage===v)).join('')+'</div></fieldset>'+
      (choice.damage==='yes'?'<fieldset class="ff-block"><legend>수리 계획</legend><div class="ff-options">'+check('plan','yes','손상된 비닐 수리 예정',choice.plan,'checkbox')+'</div></fieldset>':'')+
      '<p class="ff-error" id="repair-error" role="alert" hidden></p>'+
      cta(btn('결과 확인','repair-result',true),btn('기록으로 돌아가기','repair-back')));
  }
  function repairResult(id) {
    const r=(!id||id===lastOpened)&&getRecord(lastOpened);
    if(!canRepair(r))return emptyState('수리 조건을 확인할 기록이 없어요','농장 일지에서 하우스 기록을 선택해 주세요.');
    const ok=choice.damage==='yes'&&choice.plan;
    const missing={
      '':['비닐 손상 여부를 아직 선택하지 않았어요.','직접 확인한 비닐 상태를 선택해 주세요.','손상 여부 선택하기'],
      none:['비닐 손상이 없어 수리비를 계산하지 않아요.','확인한 현장 상태가 달라지면 수리 조건을 바꿀 수 있어요.','수리 조건 다시 보기'],
      unknown:['비닐 손상 여부를 아직 확인하지 않았어요.','안전해진 뒤 비닐 상태를 직접 확인해 주세요.','손상 여부 다시 보기'],
      yes:['손상된 비닐의 수리 예정을 선택하지 않았어요.','수리할 계획이 있으면 ‘손상된 비닐 수리 예정’을 선택해 주세요.','수리 계획 선택하기']
    }[choice.damage];
    return wrap('<section class="ff-cost-card"><header class="ff-cost-heading">'+tag()+'<h1>'+(ok?'비닐 수리비<br>예상 범위':'비닐 수리 조건')+'</h1><small>시설 예시 이미지</small></header><div class="ff-cost-result">'+(ok?'<p>직접 손상 확인 · 손상된 비닐 수리 예정</p><h2 class="ff-range"><span>약 </span>70만~99만 <span>원</span></h2><p>담양 시연의 수리비예요. 보험금과는 별개예요.</p>':'<h2>'+missing[0]+'</h2><p class="ff-next-condition">'+missing[1]+'</p>')+'</div></section>'+
      (ok?'<details class="ff-block ff-fold" '+(basis?'open':'')+'><summary>계산 내역 보기</summary><p>수리 견적에서 농가 부담금을 뺀 범위예요.</p><dl class="ff-rows">'+line('80만 원 − 10만 원','70만 원')+line('110만 원 − 11만 원','99만 원')+'</dl></details>':'')+
      '<section class="ff-block"><h2>'+(r.sample?'이 기록의 관찰 메모':'내가 남긴 관찰')+'</h2><p class="ff-memo">'+esc(r.memo||'메모 없음')+'</p></section>'+
      cta(ok?btn('새 조건으로 다시 보기','reset-repair',true):btn(missing[2],'repair',true),btn('기록으로 돌아가기','repair-back'))+
      (ok?'<a class="ff-shop-text-link" href="#shop/category/film'+repairSuffix()+'">하우스 자재 보기 <b aria-hidden="true">›</b></a>':''));
  }
  function setRecord(id,from) {
    if(!getRecord(id))return;
    const changed=id!==lastOpened;
    lastOpened=id;session('lastOpened',id);sourceRoute=from;session('detailBack',from);
    if(changed){saveChoice({damage:'',plan:false});basis=false;}
  }
  function view(route) {
    if(FarmMall.isRoute(route))return FarmMall.view(route,mallOptions(route));
    const [key,id]=String(route).split('/');
    if(key==='detail' && id && getRecord(id) && id!==lastOpened) setRecord(id,'journal');
    switch(key) {
      case 'record':case 'damage': return damageView(key);
      case 'saved': return savedView();
      case 'journal': return journalView();
      case 'detail': return detailView(getRecord(id || lastOpened));
      case 'edit-record':case 'delete-record':return editView(id,key==='delete-record');
      case 'calendar': return calendarView();
      case 'next-check': return trial?nextView():'';
      case 'readiness': return readView();
      case 'repair': return repairView(id);
      case 'repair-result': return repairResult(id);
      default: return '';
    }
  }
  function refresh(route,focus='') {
    const host=document.querySelector('.ff-screen');
    if(!host) return;
    // 261127 허간: 다시 그려도 보던 위치 유지(달력 달 바꾸기 등에서 화면이 튀지 않게)
    const sc=document.getElementById('main-area'),y=sc?.scrollTop,wy=scrollY;
    host.outerHTML=view(route);bind(route);
    if(sc)sc.scrollTop=y;if(scrollY!==wy)scrollTo(0,wy);
    if(focus)document.querySelector(focus)?.focus({preventScroll:true});
  }
  function refreshMissingRecord(route) {
    refresh(route,'[data-ff-action="journal"]');
    window.announceFarmStatus('이 기록을 찾을 수 없어요. 농장 일지에서 다시 확인해 주세요.');
  }
  function saveChoice(next) {
    choice=next;
    session('repairChoice',JSON.stringify({...choice,house:active,season:context().season,record:lastOpened}));
  }
  function backTarget(route) {
    if(FarmMall.isRoute(route)){
      const inner=FarmMall.backTarget(route,mallOptions(route));
      return inner&&FarmMall.isRoute(inner)?inner:shopOrigin(route)?'repair-result/'+lastOpened:'home';
    }
    switch(String(route).split('/')[0]) {
      case 'detail':return sourceRoute;
      case 'edit-record':case 'delete-record':return 'detail/'+String(route).split('/')[1];
      case 'damage':case 'record':return damageBack;
      case 'saved':return 'journal';
      case 'repair':return repairBack;
      case 'repair-result':return repairBack;
      case 'calendar':return 'journal';
      case 'next-check':return trial?'journal':'home';
      default:return 'home';
    }
  }
  function previewBranch(key) {
    if(!branchKey || key!==branchKey || session('branch-started')==='yes')return;
    session('branch-started','yes');
    if(!linkedHouse)selectContext('2');
    const fireStates={'fire-yes':'가입','fire-no':'미가입','fire-unknown':'모름'};
    if(fireStates[key]){Object.assign(draft(),{cause:'화재',fire:fireStates[key]});return;}
    if(key==='pest'){Object.assign(draft(),{cause:'병해충',entryType:'pest'});return;}
    const repairStates={'repair-none':'none','repair-unknown':'unknown','repair-planless':'yes','repair-ready':'yes'};
    if(repairStates[key]){setRecord('example-2','journal');resetRepair('detail/example-2');saveChoice({damage:repairStates[key],plan:false});return;}
    if(key==='blank-receipt'){lastSaved='example-2';session('lastSaved',lastSaved);setRecord(lastSaved,'journal');}
  }
  function previewAtlas(page,route) {
    const p=Number(page);
    if(branchKey || Number(params.get('atlas'))!==p || ![12,13,14,15,16,20,21,22,23,24].includes(p))return;
    const screen=(p===16||p===24)?'saved':'damage';
    if(String(route).replace(/^#/,'')!==screen || session('atlas-started')==='yes')return;
    if(!linkedHouse)selectContext(p===12||p===20?'1':'2');
    const original='2동 통로에 물이 찼고 하부 비닐이 찢어졌어요.';
    if(screen==='damage') {
      if([14,15,22,23].includes(p)) draft().photo='aisle';
      if(p===15) draft().memo=seeds[0].memo;
      if(p===23) draft().memo=original;
      keepDraft(active,draft());
    } else {
      let id='example-2';
      if(p===24) {
        const sample={...seeds[0],id:'atlas-24',date:'2026-11-23',time:'09:00',memo:original};
        try {localStorage.setItem(scopeKey()+sample.id,JSON.stringify(sample));id=sample.id;}catch (_) {return;}
      }
      lastSaved=id;session('lastSaved',id);setRecord(id,'journal');
    }
    session('atlas-started','yes');
  }
  function resetRepair(from) {repairBack=from;session('repairBack',from);saveChoice({damage:'',plan:false});basis=false;}
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-field-entry]');
    if (!button || document.body.dataset.screen !== 'home') return;
    const action = button.dataset.fieldEntry;
    if (action !== 'camera' && action !== 'memo') return;
    damageBack = 'home';
    go('record');
    const form = document.getElementById('ff-form');
    if (action === 'memo') {
      form.elements.memo.focus();
      return;
    }
    // The phone's picker and keyboard must open during the original user tap.
    form.querySelector('[data-photo-pick="camera"]').focus();
    form.querySelector('[data-photo-source="camera"]').click();
  });
  function bind(route) {
    if(FarmMall.isRoute(route)){FarmMall.bind(document.getElementById('main-area'),route,mallOptions(route));return}
    const host=document.querySelector('.ff-screen');
    if(!host)return;
    const suppliesLink=host.querySelector('a[href^="#shop/category/film/from-record-"]');
    if(suppliesLink)suppliesLink.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
      event.preventDefault();
      const target=suppliesLink.hash.slice(1);
      FarmMall.resetEntry(target,mallOptions(target));
      go(target);
    });
    if(route==='damage'||route==='record')bindDamage();
    if(['edit-record','delete-record'].includes(route.split('/')[0]))bindEdit(route.split('/')[1]);
    const edit=host.querySelector('#ff-receipt-form');
    if(edit){
      const id=lastOpened,house=active,key=scopeKey()+id,original=getRecord(id);
      edit.addEventListener('submit',async event=>{
        event.preventDefault();
        if(edit.dataset.pending)return;
        edit.dataset.pending='1';
        const changes={receiptAt:edit.elements.receiptAt.value,office:edit.elements.office.value};
        const commit=()=>{
          const r=getRecord(id);
          if(active!==house||!r||r.office!==original.office||r.receiptAt!==original.receiptAt||FarmJournalEdit.typeOf(r)==='work')
            throw Error('기록이 다른 화면에서 바뀌었어요. 다시 열어 확인해 주세요.');
          const updated=directRow(id)?FarmJournalEdit.apply(r,changes,new Date().toISOString()):{...r,...changes};
          try{localStorage.setItem(key,JSON.stringify(updated));}catch{throw Error('저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.');}
        };
        try{if(navigator.locks)await navigator.locks.request(key,commit);else commit();}
        catch(e){edit.querySelector('[role=alert]').textContent=e.message;delete edit.dataset.pending;return;}
        if(!edit.isConnected)return;
        refresh(route,'.ff-receipt-edit summary');
        window.announceFarmStatus('접수 정보를 이 브라우저에 저장했어요.');
      });
    }
    host.addEventListener('click',e=>{
      const a=e.target.closest('[data-ff-action],[data-ff-record],[data-ff-date]');if(!a)return;
      if(a.dataset.ffRecord){
        setRecord(a.dataset.ffRecord,route==='calendar'?'calendar':'journal');
        go('detail/'+a.dataset.ffRecord);
        return;
      }
      if(a.dataset.ffDate){setDate(a.dataset.ffDate);refresh('calendar','[data-ff-date="'+selectedDate+'"]');return;}
      const key=a.dataset.ffAction;
      switch(key){
        case 'open-saved':{
          const saved=getRecord(lastSaved);
          if(!saved){refreshMissingRecord(route);break;}
          setDate(saved.date);setRecord(saved.id,'calendar');go('detail/'+saved.id);break;
        }
        case 'edit-record':case 'delete-record':
          if(directRow(lastOpened))go(key+'/'+lastOpened);
          else refreshMissingRecord(route);
          break;
        case 'example':{
          const m=host.querySelector('#ff-memo');if(m.value.trim())break;m.value=(seeds.find(x=>x.houseId===active)||seeds[0]).memo;draft().memo=m.value;keepDraft(active,draft());clearResolvedError();m.dispatchEvent(new Event('input',{bubbles:true}));m.focus();break;
        }
        case 'jump-reception':{
          const box=host.querySelector('#ff-reception');box?.scrollIntoView({block:'start'});box?.querySelector('input')?.focus({preventScroll:true});break;
        }
        case 'filter-all':case 'filter-mine':session('journalFilter',key==='filter-mine'?'mine':'all');refresh(route,'[data-ff-action="'+key+'"]');break;
        case 'prev-month':case 'next-month':{
          const [year,month]=selectedDate.split('-').map(Number),date=new Date(Date.UTC(year,month-1+(key==='prev-month'?-1:1),1));setDate(date.toISOString().slice(0,10));refresh('calendar','[data-ff-action="'+key+'"]');window.announceFarmStatus?.(date.getUTCFullYear()+'년 '+(date.getUTCMonth()+1)+'월');break;
        }
        case 'month-open':{
          const pop=host.querySelector('#ff-month-pop'),open=pop.hidden;pop.hidden=!open;a.setAttribute('aria-expanded',String(open));a.parentElement.classList.toggle('is-open',open);
          if(open){const sel=pop.querySelector('.is-sel')||pop.querySelector('button');if(sel){pop.scrollTop=Math.max(0,sel.offsetTop-(pop.clientHeight-sel.offsetHeight)/2);sel.focus({preventScroll:true});}} // 261127 허간: 바깥 화면은 움직이지 않고 목록 안에서만 맞춤
          break;
        }
        case 'month-go':{
          const k=a.dataset.month;if(!/^\d{4}-\d{2}$/.test(k||''))break;setDate(k+'-01');refresh('calendar','.ff-month-btn');window.announceFarmStatus?.(Number(k.slice(0,4))+'년 '+Number(k.slice(5))+'월');break;
        }
        case 'detail-back':go(sourceRoute);break;
        case 'ask-next':{
          if(!trial||a.dataset.busy)break;
          if(!ownCount()&&!readPlan()){refresh(route);window.announceFarmStatus?.('오늘 일지를 먼저 저장해 주세요.');break;}
          {const now=season2();if(now.crop!==context().crop||now.plant!==context().plant){location.reload();break;}} // 다른 탭에서 작물·정식일이 바뀌면 새 작기로 다시 그린다
          a.dataset.busy='1';
          try{ensurePlan();}
          catch(_){
            delete a.dataset.busy;
            const e=a.parentElement.querySelector('[data-next-error]');
            const text=(ownCount()?'일지는 저장됐고 일정은 추가되지 않았어요.':'일정은 추가되지 않았어요.')+' 잠시 뒤 다시 눌러 주세요.';
            if(e){e.hidden=false;e.textContent=text;}
            window.announceFarmStatus?.(text);break;
          }
          delete a.dataset.busy;
          if(String(route)==='next-check'){refresh(route,'[data-ff-action="plan-calendar"]');window.announceFarmStatus?.('다음 날 일정 한 건을 추가했어요.');}
          else go('next-check');
          break;
        }
        case 'open-plan':go('next-check');break;
        case 'plan-calendar':{const p=readPlan();if(p)setDate(p.due);go('calendar');break;}
        case 'begin-repair':{
          const record=getRecord(route==='saved'?lastSaved:lastOpened);
          if(!record){refreshMissingRecord(route);break;}
          if(!canRepair(record)){refresh(route);break;}
          if(route==='saved')setRecord(record.id,'journal');
          resetRepair(route==='saved'?'saved':'detail/'+record.id);go('repair/'+record.id);
          break;
        }
        case 'repair':case 'repair-result':
          // v21 1차(검수 10순위): 손상 여부를 고르지 않고 '결과 확인'을 누르면 다른 화면으로 넘기지 않고 이 자리에서 알림
          if(key==='repair-result'&&String(route).split('/')[0]==='repair'&&!choice.damage){const e=host.querySelector('#repair-error');if(e){e.hidden=false;e.textContent='비닐 손상 여부를 아직 선택하지 않았어요.';host.querySelector('[name=damaged]')?.focus();}break;}
          go(key+'/'+lastOpened,{replace:true});break;
        case 'repair-back':go(repairBack);break;
        case 'reset-repair':resetRepair(repairBack);go('repair/'+lastOpened,{replace:true});break;
        case 'record':case 'damage':
          damageBack=route==='journal'?'journal':'home';go(key);break;
        default:go(key);
      }
    });
    host.querySelector('.ff-older')?.addEventListener('toggle',e=>session('journalOlderOpen',e.target.open?'yes':''));
    host.addEventListener('change',e=>{
      const el=e.target;
      if(el.name==='damaged'){saveChoice({damage:el.value,plan:false});refresh(route,'[name=damaged][value="'+el.value+'"]');}
      if(el.name==='plan')saveChoice({...choice,plan:el.checked});
    });
  }
  function openRecent(id){
    if(getRecord(id))setRecord(id,'home');
    else {sourceRoute='home';session('detailBack',sourceRoute);}
    go('detail/'+id);
  }
  // 261127 구르미 '일지로 남기기'(체험본): 선택한 동의 작성 중 메모에 문장을 채운다. 저장은 농가가 직접 한다.
  function prefillMemo(text){
    if(!trial||typeof text!=='string'||!text.trim())return false;
    const d=draft();d.memo=d.memo.trim()?d.memo.trim()+' '+text:text;keepDraft(active,d);return true;
  }
  // 261127 허간: 일지 사진 넘김 버튼(체험본). 다음 사진이 있으면 오른쪽, 이전 사진이 있으면 왼쪽만 보인다
  if(window.FarmTrial?.on){
    const galSync=row=>{const g=row.closest('.ff-gallery');if(!g)return;const max=row.scrollWidth-row.clientWidth-2;
      const pv=g.querySelector('.ff-gal-prev'),nx=g.querySelector('.ff-gal-next');if(pv)pv.hidden=row.scrollLeft<=2;if(nx)nx.hidden=row.scrollLeft>=max;};
    const galAll=()=>document.querySelectorAll('.ff-gallery-row').forEach(galSync);
    document.addEventListener('scroll',e=>{if(e.target.classList?.contains('ff-gallery-row'))galSync(e.target);},true);
    document.addEventListener('load',e=>{if(e.target.closest?.('.ff-gallery-row'))galAll();},true);
    document.addEventListener('click',e=>{const b=e.target.closest?.('.ff-gal-nav');if(!b||b.dataset.zoom)return;const row=b.closest('.ff-gallery').querySelector('.ff-gallery-row');
      const items=[...row.children],step=items.length>1?items[1].offsetLeft-items[0].offsetLeft:row.clientWidth,max=row.scrollWidth-row.clientWidth;
      const cur=row.scrollLeft>=max-2?items.length-1:Math.round(row.scrollLeft/step),to=Math.max(0,Math.min(items.length-1,cur+(+b.dataset.gal)));
      row.scrollTo({left:to>=items.length-1?max:Math.min(to*step,max),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});[120,400,800].forEach(ms=>setTimeout(()=>galSync(row),ms));});
    document.addEventListener('scrollend',e=>{if(e.target.classList?.contains('ff-gallery-row'))galSync(e.target);},true);
    // 사진을 누르면 크게(폰 화면 안 전체 보기). 안에서도 좌우로 넘긴다
    let zoomList=[],zoomAt=0;
    const zoomPaint=dlg=>{const it=zoomList[zoomAt];dlg.querySelector('img').src=it.src;dlg.querySelector('img').alt=it.alt;dlg.querySelector('p').textContent=it.cap;
      dlg.querySelector('.ff-gal-prev').hidden=zoomAt<=0;dlg.querySelector('.ff-gal-next').hidden=zoomAt>=zoomList.length-1;};
    document.addEventListener('click',e=>{const img=e.target.closest?.('.ff-gallery-item img');if(!img)return;
      const g=img.closest('.ff-gallery');zoomList=[...g.querySelectorAll('.ff-gallery-item')].map(f=>({src:f.querySelector('img').src,alt:f.querySelector('img').alt,cap:f.querySelector('figcaption')?.textContent||''}));
      zoomAt=[...g.querySelectorAll('.ff-gallery-item img')].indexOf(img);
      let dlg=document.getElementById('ff-zoom');
      if(!dlg){dlg=document.createElement('dialog');dlg.id='ff-zoom';dlg.className='ff-zoom';dlg.setAttribute('aria-label','사진 크게 보기');
        dlg.innerHTML='<div class="ff-zoom-body"><img alt=""><p></p><button type="button" class="ff-gal-nav ff-gal-prev" data-zoom="-1" aria-label="이전 사진"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" class="ff-gal-nav ff-gal-next" data-zoom="1" aria-label="다음 사진"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button><button type="button" class="ff-zoom-close" aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
        document.body.appendChild(dlg);
        dlg.addEventListener('click',ev=>{const z=ev.target.closest('[data-zoom]');if(z){ev.stopPropagation();zoomAt=Math.max(0,Math.min(zoomList.length-1,zoomAt+(+z.dataset.zoom)));zoomPaint(dlg);return;}
          if(ev.target.closest('.ff-zoom-close')||ev.target===dlg||ev.target.classList.contains('ff-zoom-body'))dlg.close();});
        addEventListener('hashchange',()=>{if(dlg.open)dlg.close();});}
      zoomPaint(dlg);dlg.showModal();},true);
    new MutationObserver(()=>{requestAnimationFrame(galAll);setTimeout(galAll,300);}).observe(document.documentElement,{childList:true,subtree:true});
    addEventListener('resize',galAll);
  }
  window.FarmFlow={prefillMemo,view,bind,backTarget,previewBranch,previewAtlas,context,contexts:()=>[...houses],selectContext,
    crops:CROPS,addHouse,setHouseCrop,removeHouse,houseRecordCount:id=>houseRecordKeys(String(id)).length,records,openRecent,readinessLabel,readinessSummary,stamp};
})();

