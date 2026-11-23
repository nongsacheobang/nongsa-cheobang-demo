'use strict';
const el = key => document.getElementById(key);
const icons = {
 records:'<path d="M4 20h16M6 15v-4m6 4V6m6 9v-7"/>',
 home:'<path d="m2.5 10 9.5-8 9.5 8v10h-7v-6h-5v6h-7z"/>',
 journal:'<rect x="4" y="3" width="15" height="18" rx="2"/><path d="M8 3v18m3-13h5m-5 4h4"/>',
 shop:'<path d="M4.5 7.5h15l1 13h-17zM8.5 8V6a3.5 3.5 0 0 1 7 0v2"/>',
 settings:'<path d="m9.5 3 .6-1h3.8l.6 1 .6 1.6 1.6.9 1.7-.3 1.2.1 1.8 3.1-.6 1.2-1.1 1.2v2l1.1 1.2.6 1.2-1.8 3.1-1.2.1-1.7-.3-1.6.9-.6 1.6-.6 1h-3.8l-.6-1-.6-1.6-1.6-.9-1.7.3-1.2-.1-1.8-3.1.6-1.2 1.1-1.2v-2L3.2 9.9l-.6-1.2 1.8-3.1 1.2-.1 1.7.3 1.6-.9Z"/><circle cx="12" cy="12" r="3"/>',
 cloud:'<path d="M6.2 18h11a4.2 4.2 0 0 0 .7-8.3 6.1 6.1 0 0 0-11.4-1.1A4.7 4.7 0 0 0 6.2 18Z"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>', back:'<path d="m15 5-7 7 7 7"/>', down:'<path d="m6 9 6 6 6-6"/>',
 pen:'<path d="m15 4 5 5M3 21l1.2-6L16 3.2a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L9 19.8Z"/>',
 sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v1"/>'
};
const icon = (name,cls='')=>`<svg class="shell-icon ${cls}" aria-hidden="true" viewBox="0 0 24 24">${icons[name]||''}</svg>`;
const escapeText = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const farm = window.FarmFlow;
const brand = `<a class="brand" href="#home" aria-label="농사처방 홈"><img src="assets/mark.png" alt="">농사처방</a>`;
const navItems = [['home','홈'],['journal','농장 일지'],['shop','쇼핑'],['settings','설정']];
const labels={home:'농장 홈',damage:'피해 기록',saved:'저장한 기록',journal:'농장 일지',detail:'기록 상세',calendar:'달력',shop:'쇼핑',product:'상품 상세',cart:'장바구니',checkout:'모의 주문서','order-complete':'주문 완료',orders:'모의 구매 내역',receipt:'모의 영수증',repair:'수리 조건','repair-result':'비닐 수리비',readiness:'기록 준비도',settings:'설정',welcome:'체험 안내'};
const preview = new URLSearchParams(location.search).get('atlas');
const branch = new URLSearchParams(location.search).get('branch');
if(branch) farm.previewBranch(branch);
if(preview) farm.previewAtlas(preview,location.hash.slice(1));
const prefKey = 'damyang-261123-v11-typeface-'+(branch||preview||'demo');
let large=false;
try{large=localStorage.getItem(prefKey)==='large'}catch{}
document.documentElement.classList.toggle('large-text',large);
let physicalTrail=history.state?.farmTrail||[];
let route='', settingsEntry={route:'home',scroll:0}, returnFromReadiness='home', currentSpoken=null;
const scrollPositions = new Map();
let viewedEntry = '';
function pageScroller() {
  return document.documentElement.classList.contains('phone-layout') ? el('main-area') : document.scrollingElement;
}
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let statusTimer;
window.announceFarmStatus=function(message=''){
  clearTimeout(statusTimer);
  const region=el('live-region');
  region.textContent=message;
  if(message)statusTimer=setTimeout(()=>{region.textContent='';},3800);
};
function priorMallEntry(target){
  const repairOrigin=String(route).split('/').find(part=>part.startsWith('from-record-'));
  if(!repairOrigin||!FarmMall.isRoute(route))return 0;
  const source=physicalTrail.map(value=>String(value).split('/')[0]).lastIndexOf('repair-result');
  const dest=physicalTrail.slice(0,-1).lastIndexOf(target);
  return source>=0&&dest>=source?dest-physicalTrail.length+1:0;
}
function go(next,options={}){
  if(options.replace){
    const trail=[...physicalTrail.slice(0,-1),next];history.replaceState({...history.state,farmTrail:trail},'','#'+next);render();return;
  }
  if(next.startsWith('shop/category/film/from-record-')){
    const distance=priorMallEntry(next);if(distance){history.go(distance);return}
  }
  if(location.hash==='#'+next){render();return}
  history.pushState({},'','#'+next);
  render();
}
window.navigate=go;
function nav(section){
 return navItems.map(([id,label])=>`<a href="#${id}" ${id===section?'aria-current="page"':''}><span class="n-icon">${icon(id)}</span>${label}</a>`).join('');
}
function dateLabel(date){
 const parts=String(date||'').split('-');
 return parts.length===3?`${Number(parts[1])}월 ${Number(parts[2])}일`:'날짜 미입력';
}
function readinessRing(score){
 const known=Number.isFinite(score);
 const value=known?Math.max(0,Math.min(100,score)):null;
 const semantics=known
   ? `role="meter" aria-label="기록 준비도" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-valuetext="${value}점"`
   : 'aria-hidden="true"';
 return `<div class="readiness-ring${known?'':' is-unknown'}" ${semantics}>
   <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100">
     <circle class="ring-track" cx="50" cy="50" r="44"></circle>
     ${value>0?`<circle class="ring-value" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${value} ${100-value}" transform="rotate(-90 50 50)"></circle>`:''}
   </svg>
   <span class="ring-number" aria-hidden="true">${known?`${value}<small>점</small>`:'—'}</span>
 </div>`;
}
function home(){
 const ctx = farm.context();
 const rows = farm.records(), latest=rows[0];
 const readiness = farm.readinessSummary(rows.length);
 const hasRecord = latest && !(preview === '2' && !latest.created);
 const record = hasRecord ? `
    <a class="record-open entry-row" href="#journal" aria-label="저장한 기록 확인" aria-describedby="latest-record-meta latest-record-memo">
      <span class="entry-content"><span class="record-meta" id="latest-record-meta">${escapeText(ctx.house)} / ${dateLabel(latest.date)} <span>· ${escapeText(latest.time)} 저장</span></span>
      <span class="record-memo" id="latest-record-memo">${escapeText(latest.memo || '관찰 메모 미입력')}</span></span>
      <span class="entry-action">${icon('journal')}저장한 기록 확인 ${icon('arrow','entry-chevron')}</span>
    </a>` : `
    <a class="record-open entry-row" href="#damage">
      <span class="entry-content"><span class="record-memo">${preview==='2'?'통로의 물자국 남기기':'아직 저장한 기록이 없어요.'}</span></span>
      <span class="entry-action">${icon('pen')}현장 관찰 남기기 ${icon('arrow','entry-chevron')}</span>
    </a>`;
 return `<article class="orchard-home" aria-labelledby="farm-title">
   <div class="scope-row"><button type="button" class="scope-picker" id="house-switch" aria-haspopup="dialog" aria-controls="switcher">
     <span class="scope-key"><strong>${escapeText(ctx.house)}</strong><span class="scope-separator">/</span>${escapeText(ctx.season)}</span>
     <span class="scope-trigger">동 바꾸기 ${icon('down')}</span></button></div>
   <div class="farm-dashboard"><div class="farm-overview"><div class="farm-cover">
     <header class="home-weather">
       <div class="weather-readings">
         <div class="weather-location"><h1 id="farm-title">전남 담양</h1><span>가상 날씨</span></div>
         <p class="weather-temperature"><span class="sr">현재 기온 섭씨 </span>12<span aria-hidden="true">°</span><span class="sr">도</span></p>
         <p class="weather-range"><span>최고 <strong>15°</strong></span><span>최저 <strong>7°</strong></span></p>
       </div>
       <div class="weather-outlook">
         <svg viewBox="0 0 104 66" class="weather-clouds" aria-hidden="true" focusable="false">
           <defs>
             <linearGradient id="cloud-back" x2=".8" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#dae5f1"/><stop offset="1" stop-color="#92a9c4"/></linearGradient>
             <linearGradient id="cloud-front" x2=".35" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#fff"/><stop offset=".53" stop-color="#f6faff"/><stop offset="1" stop-color="#d7e3ef"/></linearGradient>
           </defs>
           <path fill="url(#cloud-back)" d="M46 38a12 12 0 0 1 1-24 17 17 0 0 1 33-1 12 12 0 1 1 3 25Z"/>
           <path fill="url(#cloud-front)" d="M22 58a14 14 0 0 1-2-28 20 20 0 0 1 37-6 14 14 0 0 1 19 12 11 11 0 0 1-1 22Z"/>
         </svg>
         <p>비 온 뒤 흐림</p>
       </div>
     </header>
     <section class="farm-readiness" aria-labelledby="home-readiness-label">
       ${readinessRing(ctx.score)}
       <div class="readiness-copy"><h2 class="row-label" id="home-readiness-label">기록 준비도</h2>
         <p class="status-text">${escapeText(readiness.status)}</p><p class="repair-note">${escapeText(readiness.note)}</p><p class="repair-note">수리비와는 별개예요.</p></div>
       <a class="readiness-link" href="#readiness" aria-label="기록 준비도 안내">${icon('info')}</a>
     </section></div>
     <p class="required-notice">보험금 지급을 보장하지 않으며, 손해평가, 손해사정이 아닙니다.</p></div>
   <section class="farm-today"><h2>농장 일지</h2>${record}
     <div class="home-cta"><a class="primary-link" href="#damage">${icon('pen')}기록하기</a></div></section></div>
 </article>`;
}

function showHouses(){
 const d=el('switcher'), current=farm.context();
 d.innerHTML=`<div class="dialog-head"><h2 id="choose-house">하우스 동 바꾸기</h2><button class="plain" id="close-dialog" type="button">닫기</button></div>${farm.contexts().map(c=>`<button type="button" data-house="${escapeText(c.id)}" class="house-option ${c.id===current.id?'active':''}"><span><strong>${escapeText(c.house)}</strong><small>${escapeText(c.season)}</small></span>${c.id===current.id?'<span>선택됨</span>':''}</button>`).join('')}`;
 d.showModal();
 d.querySelector('[data-house].active')?.focus();
 d.querySelector('#close-dialog').onclick=()=>d.close();
 d.querySelectorAll('[data-house]').forEach(b=>b.onclick=()=>{
   const changed=current.id!==b.dataset.house;
   farm.selectContext(b.dataset.house);d.close();render();el('house-switch')?.focus();
   if(changed)window.announceFarmStatus(`${farm.context().house} 기록으로 바꿨어요.`);
 });
}
function settings(){
 return `<section class="utility-page"><h1>설정</h1><h2>글자 크기</h2><div class="setting-group" aria-label="글자 크기"><button type="button" data-size="basic" aria-pressed="${!large}">기본</button><button type="button" data-size="large" aria-pressed="${large}">큰 글씨</button></div><h2>읽어주기</h2><p>버튼을 누르면 직전에 보던 화면의 본문을 읽어줘요.</p><div class="access-panel"><button type="button" id="read-aloud">${icon('sound')}화면 읽어주기</button><p class="access-status" role="status" id="speech-status"></p></div><a class="setting-row" href="#readiness"><span class="label">${icon('journal')}기록 준비도 안내</span>${icon('arrow')}</a><a class="setting-row" href="#welcome"><span class="label">${icon('info')}체험 안내 다시 보기</span>${icon('arrow')}</a></section>`;
}
function welcome(){
 return `<section class="utility-page"><p class="eyebrow">전남 담양 / 시설 딸기</p><h1>비가 그친 아침</h1><figure class="scene"><img src="assets/house.png" alt="가상 농장의 비닐하우스"></figure><h2>김민수의 딸기 농장</h2><p>밤새 내린 비로 통로에 물이 찼어요.<br>응급조치를 먼저 하고, 안전할 때 오늘 현장을 남겨 보세요.</p><p class="disclaimer">가상 농장 체험입니다. 실제 결제나 보험 접수는 하지 않아요.</p><a class="primary-link" href="#home">농장 홈 열기</a></section>`;
}
let textToRead='';
function readText(){
 const status=el('speech-status'), button=el('read-aloud');
 if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){status.textContent='이 브라우저에서는 읽어주기를 사용할 수 없어요.';return}
 if(currentSpoken){window.speechSynthesis.cancel();currentSpoken=null;button.innerHTML=icon('sound')+'화면 읽어주기';status.textContent='읽기를 멈췄어요.';return}
 const read=new SpeechSynthesisUtterance(textToRead||'설정. 기본 글씨와 큰 글씨를 선택할 수 있어요.');
 read.lang='ko-KR';currentSpoken=read;
 read.onstart=()=>{if(currentSpoken!==read)return;button.innerHTML=icon('sound')+'읽기 멈추기';status.textContent='화면 본문을 읽고 있어요.'};
 read.onend=()=>{if(currentSpoken!==read)return;currentSpoken=null;button.innerHTML=icon('sound')+'화면 읽어주기';status.textContent='읽기를 마쳤어요.'};
 read.onerror=()=>{if(currentSpoken!==read)return;currentSpoken=null;button.innerHTML=icon('sound')+'화면 읽어주기';status.textContent='음성을 재생할 수 없어요. 기기의 한국어 음성 설정을 확인해 주세요.'};
 status.textContent='기기 음성을 준비하고 있어요.';window.speechSynthesis.cancel();window.speechSynthesis.speak(read);
}
function render(){
 if(location.hash==='#main-area'){el('main-area').focus();return}
 const previous=route;
 const scrollPane=pageScroller();
 const previousTop=scrollPane.scrollTop;
 if(viewedEntry) scrollPositions.set(viewedEntry,{route:previous,top:previousTop});
 route=location.hash.slice(1)||'home';
 if(route==='supplies'||route==='pick-record'){
   route=route==='supplies'?'shop':'journal';
   history.replaceState(null,'','#'+route);
 }
 const base=route.split('/')[0],inMall=FarmMall.isRoute(route);
 if(!history.state?.farmEntry){
   physicalTrail=[...physicalTrail,route].slice(-60);
   history.replaceState({...history.state,farmEntry:true,farmPrev:previous,farmTrail:physicalTrail},'');
 }else{physicalTrail=history.state.farmTrail||[route]}

 if(!history.state.farmScrollId){
   history.replaceState({...history.state,farmScrollId:crypto.randomUUID()},'');
 }
 viewedEntry=history.state.farmScrollId;
 if(previous!==route)window.announceFarmStatus();
 if(previous!==route && ['settings','readiness','welcome'].includes(base)){
   const prior=history.state?.farmNav;
   if(prior?.settingsEntry) settingsEntry=prior.settingsEntry;
   if(prior?.returnFromReadiness) returnFromReadiness=prior.returnFromReadiness;
   if(!prior && base==='readiness') returnFromReadiness=previous==='settings'?'settings':'home';
   const fromSettingsChild=previous==='welcome'||(previous==='readiness'&&returnFromReadiness==='settings');
   if(base==='settings' && previous && !fromSettingsChild){
     if(!prior)settingsEntry={route:previous,scroll:previousTop};
     if(previous===settingsEntry.route)textToRead=el('main-area').innerText;
   }
   history.replaceState({...history.state,farmNav:{settingsEntry,returnFromReadiness}},'');
 }
 if(previous!==route && currentSpoken){currentSpoken=null;window.speechSynthesis?.cancel()}
 document.body.dataset.screen=base;
 const inSettings=base==='settings'||base==='welcome'||(base==='readiness'&&returnFromReadiness==='settings');
 const section=inSettings?'settings':['home','readiness'].includes(base)?'home':inMall?'shop':'journal';
 const title=labels[base]||'농장 일지';
 document.title=`${title} · 농사처방 담양`;
 el('sidebar').innerHTML=brand+`<nav aria-label="주 메뉴">${nav(section)}</nav><div class="rail-footer"><strong>김민수의 딸기 농장</strong><small>전남 담양 / 시설 딸기</small></div>`;
 el('mobile-nav').innerHTML=nav(section);
 const back=base==='settings'?settingsEntry.route:base==='welcome'?'settings':base==='readiness'?returnFromReadiness:farm.backTarget(route);
 const destination=escapeText(FarmMall.backLabel(back));
 const left=base==='home'?`${brand}<span class="desktop-title">농장 홈</span>`:`<a class="back-link" href="#${escapeText(back)}" aria-label="${destination} 돌아가기">${icon('back')}${destination}</a>`;
 el('bar').innerHTML=left;
 const backLink=el('bar').querySelector('.back-link');
 const distance=history.state?.farmPrev===back?-1:inMall?priorMallEntry(back):0;
 if(backLink&&distance)backLink.addEventListener('click',event=>{event.preventDefault();history.go(distance)});
 el('main-area').innerHTML=base==='home'?home():base==='settings'?settings():base==='welcome'?welcome():farm.view(route);
 el('house-switch')?.addEventListener('click',showHouses);
 if(base==='settings'){
  document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{large=b.dataset.size==='large';document.documentElement.classList.toggle('large-text',large);try{localStorage.setItem(prefKey,large?'large':'basic')}catch{}render();document.querySelector(`[data-size="${large?'large':'basic'}"]`)?.focus()});
  el('read-aloud').onclick=readText;
 } else if(!['home','welcome'].includes(base)){farm.bind(route)}
 if(previous!==route){
   const saved=scrollPositions.get(viewedEntry);
   scrollPane.scrollTop=previous==='settings'&&route===settingsEntry.route
     ? settingsEntry.scroll : saved?.route===route ? saved.top : 0;
   if(previous)el('main-area').focus({preventScroll:true});
 }
}
window.addEventListener('hashchange',render);
document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();el('main-area').focus()});
el('switcher').addEventListener('click',e=>{if(e.target===el('switcher')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close()}});
render();
