/* Editable local mockup. No network requests or notifications are sent. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const branchKey=params.get('branch');
  const preview = branchKey ? 'branch-' + branchKey : params.get('atlas');
  const prefix = 'damyang-mock-261123-v11-' + (preview ? 'preview-' + preview + '-' : '');
  const mallPreview=params.get('mallPreview')||'';
  const houses = ['2', '1'].map(id => ({
    id, house: '하우스 ' + id + '동', season: '작기 미확인',
    score: id === '2' ? 29 : null, coverage: null
  }));
  const pictures = [
    {key: 'aisle', name: '통로 전체 물 고임', path: 'flow-assets/aisle.webp'},
    {key: 'film', name: '비닐 하단 물자국', path: 'flow-assets/film.webp'}
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
  let active = session('house') === '1' ? '1' : '2';
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
  const tag = () => '<p class="ff-kicker">'+context().house+' <span>·</span> '+context().season+'</p>';
  const heading = (name,caption='') => '<header class="ff-heading">'+tag()+'<h1>'+name+'</h1>'+(caption?'<p class="ff-lead">'+caption+'</p>':'')+'</header>';
  const btn = (label,key,primary=false) => '<button type="button" class="ff-btn '+(primary?'ff-primary':'ff-secondary')+'" data-ff-action="'+key+'">'+label+'</button>';
  const line = (key,value) => '<div class="ff-line"><dt>'+key+'</dt><dd>'+value+'</dd></div>';
  const wrap = content => '<article class="ff-screen">'+content+'</article>';
  const error = '<p class="ff-error" id="ff-error" role="alert" hidden></p>';
  const cta = (main,extra='') => '<div class="ff-actions">'+main+extra+'</div>';
  const getPhoto = r => FarmPhoto.localImage(r) ? {path:r.data,name:r.photoTitle||'첨부한 사진'} : pictures.find(p=>p.key===r.photo);
  function photoFigure(r) {
    const p=getPhoto(r);
    return p?'<figure class="ff-figure"><img src="'+esc(p.path)+'" alt="'+esc(p.name)+'"><figcaption>'+esc(p.name)+(r.photo==='local'?'':' · 가상 현장 도해')+'</figcaption></figure>':'';
  }
  const kinds = ['비(호우)','더위(폭염)','화재','병해충'];
  function draft() {
    if (!drafts.has(active)) {
      const row={memo:'',cause:'',fire:'',receiptAt:'',office:'',photo:'',data:'',photoTitle:''};
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
  function damageView() {
    const d=draft();
    return wrap('<div class="ff-alert"><span aria-hidden="true">!</span><strong>'+alertLine+'</strong></div>'+
      '<div class="ff-scope"><label for="ff-house">하우스 동</label><select id="ff-house">'+houses.map(h=>'<option value="'+h.id+'"'+(active===h.id?' selected':'')+'>'+h.house+'</option>').join('')+'</select><span>'+esc(context().season)+'</span></div>'+
      '<h1>피해 기록</h1><p class="ff-lead">안전한 곳에서 먼저 응급조치를 하세요. 사진은 나중에 남겨도 돼요.</p>'+
      '<form id="ff-form"><div class="ff-grid"><div class="ff-col"><section class="ff-block"><div class="ff-labelrow"><label for="ff-memo">관찰 메모</label>'+btn('예시 메모 넣기','example')+'</div>'+
      '<textarea id="ff-memo" name="memo" maxlength="2000" rows="3" aria-describedby="ff-dictate" placeholder="예: 통로에 물이 고였어요">'+esc(d.memo)+'</textarea><p id="ff-dictate" class="ff-note">입력칸을 누른 뒤 휴대폰 키보드의 받아쓰기 버튼으로 말해 보세요.</p></section>'+
      '<section class="ff-block" id="ff-photo"><h2>현장 사진 <small>선택</small></h2>'+FarmPhoto.markup()+'<details class="journal-photo-samples"'+(pictures.some(p=>p.key===d.photo)?' open':'')+'><summary>예시 사진 고르기</summary><div class="ff-pics">'+pictures.map(p=>'<label class="ff-pic"><img src="'+p.path+'" alt=""><span><input type="radio" name="photoSample" value="'+p.key+'" '+(d.photo===p.key?'checked':'')+'>'+p.name+'</span></label>').join('')+'</div></details></section>'+
      '<fieldset class="ff-block"><legend>원인 <small>선택</small></legend><div class="ff-choices">'+kinds.map(k=>check('cause',k,k,d.cause===k)).join('')+'</div><div class="ff-sub" id="ff-branch"></div></fieldset>'+
      '</div><div class="ff-col"><section class="ff-block" id="ff-reception"><h2>농축협 접수 기록 <small>선택</small></h2><p class="ff-note">직접 접수한 뒤 일시와 접수처를 적어 주세요.</p>'+
      '<label for="ff-receipt">접수 일시</label><input type="datetime-local" id="ff-receipt" name="receiptAt" value="'+esc(d.receiptAt)+'"><label for="ff-office">접수처</label><input id="ff-office" name="office" maxlength="150" value="'+esc(d.office)+'" placeholder="직접 접수한 농축협 이름"></section>'+
      '</div></div>'+
      error+'<div class="ff-actions"><button class="ff-btn ff-primary" id="ff-save" type="submit">기록 저장</button></div></form>');
  }
  function drawBranch() {
    const d=draft(), host=document.querySelector('#ff-branch');
    if (!host) return;
    const pest=d.cause==='병해충', fire=d.cause==='화재';
    host.innerHTML=fire?'<fieldset class="ff-fire"><legend>화재 특약</legend><div class="ff-choices">'+['가입','미가입','모름'].map(x=>check('fire',x,x,d.fire===x)).join('')+'</div><p class="ff-note" aria-live="polite">'+fireHint(d.fire)+'</p></fieldset>':pest?'<p class="ff-note">병해충 관찰은 농장 일지에 따로 남겨요.</p>':'';
    document.querySelector('#ff-reception').hidden=pest;
    document.querySelector('#ff-save').textContent=pest?'농장 일지에 저장':'기록 저장';
  }
  function showError(message) {
    const el=document.querySelector('#ff-error');
    if (el) {el.hidden=!message;el.textContent=message;}
  }
  function saveDraft(event) {
    event.preventDefault();
    const form=event.currentTarget,d=draft();
    if(form.dataset.saved==='true') return;
    if(FarmPhoto.busy(d)) {showError('사진을 준비한 뒤 저장해 주세요.');return;}
    if(!d.memo.trim() && !d.photo) { showError('관찰한 내용을 적거나 사진 한 장을 골라 주세요.');form.querySelector('textarea').focus();return; }
    if(d.cause==='화재' && !d.fire) {showError('화재 특약 상태를 선택해 주세요. 확인 전이면 모름을 선택하세요.');form.querySelector('input[name="fire"]').focus();return;}
    const now=new Date(), id=crypto.randomUUID?.() || now.getTime()+'-'+Math.random().toString(36).slice(2);
    const pest=d.cause==='병해충';
    const row={...d,...stamp(now),id,houseId:active,season:context().season,created:now.toISOString(),
      kind:pest?'journal':'damage',memo:d.memo.trim(),office:pest?'':d.office.trim(),receiptAt:pest?'':d.receiptAt,fire:d.cause==='화재'?d.fire:''};
    try {localStorage.setItem(scopeKey()+id,JSON.stringify(row));}
    catch (_) {showError('이 브라우저에 저장하지 못했어요. 입력은 그대로 있어요. 저장 공간을 확인하거나 사진을 빼고 다시 시도해 주세요.');return;}
    form.dataset.saved='true';form.querySelector('#ff-save').disabled=true;
    drafts.delete(active);session('draft-'+active,'');lastSaved=id;lastOpened=id;
    session('lastSaved',id);session('lastOpened',id);saveChoice({damage:'',plan:false});basis=false;
    sourceRoute='journal';session('detailBack',sourceRoute);go('saved');
  }
  function bindDamage() {
    const form=document.querySelector('#ff-form'),d=draft(), formHouse=active;
    document.querySelector('#ff-house').onchange=e=>{
      selectContext(e.target.value);refresh('damage','#ff-house');
      window.announceFarmStatus(context().house+' 기록으로 바꿨어요.');
    };
    drawBranch();
    FarmPhoto.bind(form.querySelector('#ff-photo'),d,()=>keepDraft(formHouse,d),busy=>{form.querySelector('#ff-save').disabled=busy;});
    form.addEventListener('submit',saveDraft);
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
    return '<dl class="ff-rows">'+line('저장 일시',dateLabel(r.date)+' · '+esc(r.time))+line('원인',r.cause?esc(r.cause):'미선택')+(r.cause==='화재'?line('화재 특약',esc(r.fire||'미선택')):'')+'</dl>';
  }
  function emptyState(title,desc) {return wrap(heading(title,desc)+cta(btn('농장 일지 보기','journal',true)));}
  function savedView() {
    const r=getRecord(lastSaved);
    if(!r) return emptyState('저장한 기록 확인','피해 기록을 저장하면 이곳에서 볼 수 있어요.');
    return wrap('<header class="ff-saved-heading"><div class="ff-successmark" aria-hidden="true">✓</div>'+tag()+'<h1>농장 일지에 저장했어요</h1><p class="ff-notice">'+notice+'</p></header>'+
      '<section class="ff-block ff-summary"><h2>관찰 메모</h2><p class="ff-memo">'+esc(r.memo||'메모 없음')+'</p>'+facts(r)+'</section>'+
      (r.kind==='damage'?'<section class="ff-block"><h2>직접 적은 접수 정보</h2>'+receiptInfo(r)+'</section>':'')+
      cta(btn('일지에서 다시 보기','journal',true),btn('홈으로','home'))+
      (canRepair(r)?btn('비닐 수리비 확인','begin-repair'):'')+photoFigure(r));
  }
  function journalRow(r) {
    const p=getPhoto(r);
    return '<button type="button" class="ff-entry" data-ff-record="'+esc(r.id)+'">'+(p?'<img src="'+esc(p.path)+'" alt="">':'<span class="ff-entry-mark" aria-hidden="true">☰</span>')+
    '<span class="ff-entry-text"><strong>'+context().house+'</strong><span>'+esc(r.memo||'사진 기록')+'</span><small>'+esc(r.time)+(r.sample?' · 시연 기록':' 저장')+(r.kind==='journal'?' · 병해충 관찰':'')+'</small></span><b aria-hidden="true">›</b></button>';
  }
  function journalView() {
    const rows=records(), grouped=new Map();
    rows.forEach(r=>{if(!grouped.has(r.date))grouped.set(r.date,[]);grouped.get(r.date).push(r);});
    return wrap(heading('농장 일지')+'<div class="ff-jtabs"><strong>목록</strong>'+btn('달력','calendar')+'</div>'+
      cta(btn('새 기록 남기기','damage',true))+
      [...grouped].map(([d,items])=>'<section class="ff-block"><h2>'+dateLabel(d)+'</h2>'+items.map(journalRow).join('')+'</section>').join(''));
  }
  function ensureDate() {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate))setDate(records()[0]?.date || stamp(new Date()).date);
  }
  function setDate(value) {selectedDate=value;session('calendarDate',value);}
  function calendarView() {
    ensureDate();
    const [year,month]=selectedDate.split('-').map(Number),rows=records(),counts=new Map();
    for(const row of rows)counts.set(row.date,(counts.get(row.date)||0)+1);
    const first=new Date(Date.UTC(year,month-1,1)).getUTCDay(),num=new Date(Date.UTC(year,month,0)).getUTCDate();
    const pad=n=>String(n).padStart(2,'0');
    let days='<span aria-hidden="true"></span>'.repeat(first);
    for(let i=1;i<=num;i++){
      const key=year+'-'+pad(month)+'-'+pad(i);
      const count=counts.get(key)||0;
      const name=dateLabel(key)+', 기록 '+count+'건';
      days+='<button type="button" data-ff-date="'+key+'" aria-label="'+name+'" aria-pressed="'+(selectedDate===key)+'"><span>'+i+'</span>'+(count?'<span class="ff-cal-count">'+count+'건</span>':'')+'</button>';
    }
    const items=rows.filter(r=>r.date===selectedDate);
    return wrap(heading('농장 일지')+'<div class="ff-jtabs">'+btn('목록','journal')+'<strong>달력</strong></div>'+
      '<section class="ff-block"><div class="ff-month">'+btn('이전 달','prev-month')+'<h2>'+year+'년 '+month+'월</h2>'+btn('다음 달','next-month')+'</div><div class="ff-calendar">'+[...'일월화수목금토'].map(x=>'<b>'+x+'</b>').join('')+days+'</div></section>'+
      '<section class="ff-block"><h2>'+dateLabel(selectedDate)+'</h2>'+(items.length?items.map(journalRow).join(''):'<p class="ff-note">이날 저장한 기록이 없어요.</p>')+'</section>');
  }
  function detailView(r) {
    if(!r) return emptyState('이 동의 기록을 골라 주세요','농장 일지에서 다시 열 수 있어요.');
    return wrap(heading(context().house+' 기록',dateLabel(r.date)+' · '+esc(r.time)+(r.sample?' · 시연 기록':' 저장'))+
      '<section class="ff-block"><h2>관찰 메모</h2><p class="ff-memo">'+esc(r.memo||'메모 없음')+'</p>'+photoFigure(r)+'</section>'+
      (r.kind==='journal'?'<p class="ff-notice">병해충 관찰을 농장 일지에 남겼어요.</p>':'')+
      (r.kind==='damage'?'<section class="ff-block"><h2>직접 적은 접수 정보</h2>'+receiptInfo(r)+'<p class="ff-note">'+notice+'</p>'+receiptEditor(r)+'</section>':'')+
      (r.cause?'<div class="ff-block"><dl class="ff-rows">'+line('원인',esc(r.cause))+(r.fire?line('화재 특약',esc(r.fire)):'')+'</dl>'+(r.fire?'<p class="ff-note">'+fireHint(r.fire)+'</p>':'')+'</div>':'')+
      cta(canRepair(r)?btn('비닐 수리비 확인','begin-repair',true):'',btn(sourceRoute==='calendar'?'선택한 날짜로 돌아가기':'일지 목록으로','detail-back')));
  }
  function readView() {
    const result=readinessSummary(records().length);
    const explanation='기록 건수에는 시연 일지가 포함돼요.'+(active==='2'?' 2동의 29점은 미리 정한 시연 점수예요.':'');
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
      '<section class="ff-block"><h2>내가 남긴 관찰</h2><p class="ff-memo">'+esc(r.memo||'메모 없음')+'</p></section>'+
      cta(ok?btn('새 조건으로 다시 보기','reset-repair',true):btn(missing[2],'repair',true),btn('기록으로 돌아가기','repair-back'))+
      (ok?'<a class="ff-shop-text-link" href="#shop/category/film'+repairSuffix()+'">복구용품 보기 <b aria-hidden="true">›</b></a>':''));
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
      case 'damage': return damageView();
      case 'saved': return savedView();
      case 'journal': return journalView();
      case 'detail': return detailView(getRecord(id || lastOpened));
      case 'calendar': return calendarView();
      case 'readiness': return readView();
      case 'repair': return repairView(id);
      case 'repair-result': return repairResult(id);
      default: return '';
    }
  }
  function refresh(route,focus='') {
    const host=document.querySelector('.ff-screen');
    if(!host) return;
    host.outerHTML=view(route);bind(route);
    if(focus)document.querySelector(focus)?.focus();
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
      case 'damage':return damageBack;
      case 'saved':return 'journal';
      case 'repair':return repairBack;
      case 'repair-result':return repairBack;
      case 'calendar':return 'journal';
      default:return 'home';
    }
  }
  function previewBranch(key) {
    if(!branchKey || key!==branchKey || session('branch-started')==='yes')return;
    session('branch-started','yes');
    selectContext('2');
    const fireStates={'fire-yes':'가입','fire-no':'미가입','fire-unknown':'모름'};
    if(fireStates[key]){Object.assign(draft(),{cause:'화재',fire:fireStates[key]});return;}
    if(key==='pest'){draft().cause='병해충';return;}
    const repairStates={'repair-none':'none','repair-unknown':'unknown','repair-planless':'yes','repair-ready':'yes'};
    if(repairStates[key]){setRecord('example-2','journal');resetRepair('detail/example-2');saveChoice({damage:repairStates[key],plan:false});return;}
    if(key==='blank-receipt'){lastSaved='example-2';session('lastSaved',lastSaved);setRecord(lastSaved,'journal');}
  }
  function previewAtlas(page,route) {
    const p=Number(page);
    if(branchKey || Number(params.get('atlas'))!==p || ![12,13,14,15,16,20,21,22,23,24].includes(p))return;
    const screen=(p===16||p===24)?'saved':'damage';
    if(String(route).replace(/^#/,'')!==screen || session('atlas-started')==='yes')return;
    selectContext(p===12||p===20?'1':'2');
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
    go('damage');
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
    if(route==='damage')bindDamage();
    const edit=host.querySelector('#ff-receipt-form');
    if(edit) edit.addEventListener('submit',event=>{
      event.preventDefault();
      const r=getRecord(lastOpened); if(!r)return;
      const update={...r,receiptAt:edit.elements.receiptAt.value,office:edit.elements.office.value.trim()};
      try {localStorage.setItem(scopeKey()+r.id,JSON.stringify(update));}
      catch (_) {edit.querySelector('[role=alert]').textContent='저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.';return;}
      refresh(route,'.ff-receipt-edit summary');
      window.announceFarmStatus('접수 정보를 이 브라우저에 저장했어요.');
    });
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
        case 'example':{
          const m=host.querySelector('#ff-memo');m.value=seeds.find(x=>x.houseId===active).memo;draft().memo=m.value;keepDraft(active,draft());m.focus();break;
        }
        case 'prev-month':case 'next-month':{
          const [year,month]=selectedDate.split('-').map(Number),date=new Date(Date.UTC(year,month-1+(key==='prev-month'?-1:1),1));setDate(date.toISOString().slice(0,10));refresh('calendar','[data-ff-action="'+key+'"]');break;
        }
        case 'detail-back':go(sourceRoute);break;
        case 'begin-repair':
          if(route==='saved')setRecord(lastSaved,'journal');
          if(canRepair(getRecord(lastOpened))){resetRepair(route==='saved'?'saved':'detail/'+lastOpened);go('repair/'+lastOpened);}
          break;
        case 'repair':case 'repair-result':go(key+'/'+lastOpened,{replace:true});break;
        case 'repair-back':go(repairBack);break;
        case 'reset-repair':resetRepair(repairBack);go('repair/'+lastOpened,{replace:true});break;
        case 'damage':
          damageBack=route==='journal'?'journal':'home';go('damage');break;
        default:go(key);
      }
    });
    host.addEventListener('change',e=>{
      const el=e.target;
      if(el.name==='damaged'){saveChoice({damage:el.value,plan:false});refresh(route,'[name=damaged][value="'+el.value+'"]');}
      if(el.name==='plan')saveChoice({...choice,plan:el.checked});
    });
  }
  window.FarmFlow={view,bind,backTarget,previewBranch,previewAtlas,context,contexts:()=>[...houses],selectContext,records,readinessLabel,readinessSummary,stamp};
})();

