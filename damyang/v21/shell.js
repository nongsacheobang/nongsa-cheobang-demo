'use strict';
const el = key => document.getElementById(key);
const icons = {
 ...Object.fromEntries(FarmNav.items.map(item => [item.id, item.icon])),
 camera:'<path d="M3 8a2 2 0 0 1 2-2h3l1.6-2h4.8L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.7" r="3.5"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h3m3 0h3"/>',
 records:'<path d="M4 20h16M6 15v-4m6 4V6m6 9v-7"/>',
 cloud:'<path d="M6.2 18h11a4.2 4.2 0 0 0 .7-8.3 6.1 6.1 0 0 0-11.4-1.1A4.7 4.7 0 0 0 6.2 18Z"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>', back:'<path d="m15 5-7 7 7 7"/>', down:'<path d="m6 9 6 6 6-6"/>',
 pen:'<path d="m15 4 5 5M3 21l1.2-6L16 3.2a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L9 19.8Z"/>',
 sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v1"/>',
 settings:FarmNav.settingsIcon,
 alert:'<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5m0 2.5v.5"/>'
};
const icon = (name,cls='')=>`<svg class="shell-icon ${cls}" aria-hidden="true" viewBox="0 0 24 24">${icons[name]||''}</svg>`;
const escapeText = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const farm = window.FarmFlow;
const brand = `<a class="brand" href="#home" aria-label="농사처방 홈"><img src="assets/mark.svg" alt="">농사처방</a>`;
const navParams = new URLSearchParams(location.search);
const labels={home:'농장 홈',damage:'피해 기록',saved:'저장한 기록',journal:'농장 일지',detail:'기록 상세',calendar:'달력',shop:'쇼핑',product:'상품 상세',cart:'장바구니',checkout:'모의 주문서','order-complete':'주문 완료',orders:'모의 구매 내역',receipt:'모의 영수증',repair:'수리 조건','repair-result':'비닐 수리비',readiness:'기록 준비도',settings:'설정',welcome:'체험 안내',news:'소식'};
const preview = new URLSearchParams(location.search).get('atlas');
const branch = new URLSearchParams(location.search).get('branch');
if(branch) farm.previewBranch(branch);
if(preview) farm.previewAtlas(preview,location.hash.slice(1));
const prefKey = 'damyang-public-v21-typeface-'+(branch||preview||'demo');

try{localStorage.removeItem(prefKey)}catch{}
document.documentElement.classList.remove('large-text');
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
 return FarmNav.render({section,params:navParams,visit:navParams.get('visit')});
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
function readinessCard(ctx, readiness){
 return `<section class="farm-readiness" aria-labelledby="home-readiness-label">
   ${readinessRing(ctx.score)}
   <div class="readiness-copy"><h2 class="row-label" id="home-readiness-label">기록 준비도</h2>
     <p class="status-text">${escapeText(readiness.status)}</p><p class="repair-note">${escapeText(readiness.note)}</p><p class="repair-note">${ctx.score === 65 ? '고정 시연 점수예요. ' : ''}수리비와는 별개예요.</p></div>
   <a class="readiness-link" href="#readiness" aria-label="기록 준비도 안내">${icon('info')}</a>
 </section>`;
}
const homeDisclosure='<p class="required-notice">보험금 지급을 보장하지 않으며, 손해평가, 손해사정이 아닙니다.</p>';
function insuranceCard(){
 const origin = FarmNav.copyContext(navParams,new URLSearchParams({from:'home'}));
 origin.set('house', farm.context().id);
 return `<section class="home-card home-insurance" aria-labelledby="home-insurance-label">
   <div class="insurance-heading"><h2 id="home-insurance-label">재해보험</h2><span>토마토 3동 · 시연용 예시</span></div>
   <div class="insurance-actions">
     <a class="insurance-entry" href="estimate/index.html?${escapeText(origin)}#example">${icon('insurance')}보험금 예상액 보기</a>
     <a class="insurance-entry" href="estimate/index.html?${escapeText(origin)}#season">${icon('calendar')}${escapeText(farm.context().id)}동 작기 일정</a>
   </div></section>`;
}
function fieldHome(ctx, readiness, latest, action){
 return `<article class="orchard-home field-home" aria-labelledby="field-title">
   <header class="field-location">
     <div class="field-location-top"><h1 id="field-title">현장 홈</h1><span>${icon('cloud')}담양 12° · 가상 날씨</span></div>
     <button class="field-house" id="house-switch" type="button" aria-label="${escapeText(ctx.house)} 동 바꾸기" aria-haspopup="dialog" aria-controls="switcher">
       <strong>${escapeText(ctx.house)}</strong><span>동 바꾸기 ${icon('down')}</span></button>
     <p>전남 담양 · ${escapeText(ctx.seasonLabel||ctx.season)}</p>
   </header>
   ${(()=>{const a=window.FarmNews?.alert();return a?`<a class="h21-alert field-alert" href="#news/${escapeText(a.id)}">${icon('alert')}<span><b>시연 특보</b>${escapeText(a.title)}</span>${icon('arrow')}</a>`:''})()}
   <section class="home-card field-journal" aria-labelledby="field-journal-title">
     <div class="journal-head"><h2 id="field-journal-title">농장 일지</h2>
       <a class="home-journal-calendar" href="#calendar" aria-label="농장 일지 달력 보기">${icon('calendar')}일지 달력</a></div>
     <p class="field-safety">응급조치를 먼저 하고 안전할 때 촬영하세요.</p>
     <div class="field-record-tools">
       <button type="button" data-field-entry="camera">${icon('camera')}<span>사진 촬영</span></button>
       <button type="button" data-field-entry="memo">${icon('pen')}<span>메모 쓰기</span></button>
     </div>
     ${recentEntry(latest,ctx)}
   </section>
   ${action}
   ${insuranceCard()}
   <div class="field-readiness-block">${readinessCard(ctx,readiness)}${homeDisclosure}</div>
 </article>`;
}
function recentEntry(row, ctx, calendar=false){
 const all = `<a class="field-saved" href="#journal">일지 전체 보기 ${icon('arrow')}</a>`;
 const h = calendar ? 'h2' : 'h3';
 const head = `<div class="recent-heading"><${h}>최근 기록</${h}>${calendar ? `<span class="h21-links"><a class="home-journal-calendar" href="#calendar" aria-label="농장 일지 달력 보기">${icon('calendar')}달력</a>${all}</span>` : all}</div>`;
 if(!row) return `<section class="recent-panel">${head}<p class="recent-empty">이 동에 저장한 기록이 없어요.</p></section>`;
 const photo = FarmPhoto.localImage(row);
 const mark = photo ? `<img src="${escapeText(photo)}" alt="">` : icon(row.photo ? 'camera' : 'journal');
 const recordType = FarmJournalEdit.typeNames[FarmJournalEdit.typeOf(row)];
 const title = row.memo?.trim() || '사진으로 남긴 기록';
 return `<section class="recent-panel">${head}
   <button type="button" class="recent-entry" data-home-record="${escapeText(row.id)}">
     <span class="recent-mark" aria-hidden="true">${mark}</span>
     <span class="recent-copy"><span class="record-meta">${escapeText(ctx.house)} · ${dateLabel(row.date)}</span>
       <strong class="record-memo">${escapeText(title)}</strong>
       <span class="recent-kind">${escapeText(recordType)}${row.sample ? ' · 시연 기록' : ''}</span></span>
     <span class="recent-open">저장한 기록 확인 ${icon('arrow')}</span>
   </button></section>`;
}
function nextAction(rows){
 const today = farm.stamp(new Date()).date;
 const row = rows.find(r => r.kind === 'damage' && !r.sample && !r.office && !r.receiptAt &&
   (r.date === today || (Number.isFinite(Date.parse(r.created)) && farm.stamp(new Date(r.created)).date === today)));
 return `<section class="home-card today-task"><h2>지금 할 일</h2>
   <p>${row ? '피해를 알게 되면 바로 가입한 농축협에 알리기' : '하우스를 둘러보고 달라진 점을 남겨 주세요.'}</p>
   ${row ? `<button type="button" class="task-open" data-home-record="${escapeText(row.id)}">직접 알린 내용 확인</button>` : ''}
   ${FarmField.enabled ? `<a class="home-journal-calendar" href="#damage">${icon('pen')}피해 기록하기</a>` : ''}</section>`;
}


const todayLabel=()=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date());
function newsDate(date){const [,m,d]=String(date).split('-').map(Number);return `${m}월 ${d}일`;}


function greeting(){
 let h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
 // 시연 미리보기(&wxTime=)로 낮·밤을 바꾸면 인사도 맞춘다
 const forced=navParams.get('wxTime'); if(forced==='day'&&(h<6||h>=17))h=14; if(forced==='night'&&h>=6&&h<18)h=20;
 return `민수님, 좋은 ${h<11?'아침이에요':h<17?'오후예요':'저녁이에요'}`;
}
function homeHero(ctx,count){
 const known=Number.isFinite(ctx.score), status=farm.readinessLabel(ctx.score,ctx.coverage);
 return `<section class="h22-hero" aria-labelledby="farm-title">
   <div class="h22-toprow"><p class="h22-date">${escapeText(todayLabel())}</p>
     <button type="button" class="h22-scope" id="house-switch" aria-haspopup="dialog" aria-controls="switcher" aria-label="${escapeText(ctx.house)}, ${escapeText(ctx.seasonLabel||ctx.season)}. 동 바꾸기">
       <strong>${escapeText(ctx.house)}</strong><span>${escapeText(ctx.crop||'작기 미확인')}</span>${icon('down')}</button></div>
   <h1 id="farm-title" class="h22-hello">${escapeText(greeting())}</h1>
   <div class="h22-line h22-wx">
     <p class="h22-temp"><span class="sr">시연 기온 섭씨 </span>12<span aria-hidden="true">°</span><span class="sr">도</span></p>
     <div class="h22-copy"><p class="h22-strong">비 온 뒤 흐림</p><p class="h22-sub">담양 가상 날씨 · <span class="nowrap">최고 15°</span> <span class="nowrap">최저 7°</span></p></div>
   </div>
   <a class="h22-line h22-score" href="#readiness" aria-label="기록 준비도 ${known?ctx.score+'점, '+escapeText(status)+', ':'미확인, '}이번 작기 기록 ${count}건. 준비도 안내 보기">
     ${readinessRing(ctx.score)}
     <div class="h22-copy"><p class="h22-cap">기록 준비도</p><p class="h22-strong">${known?escapeText(status):'준비도 미확인'}<span class="h22-dot"> · </span><span class="h22-count">이번 작기 기록 ${count}건</span></p></div>
     ${icon('arrow')}
   </a>
 </section>`;
}
function homeAlert(){
 const alert=window.FarmNews?.alert();
 return alert?`<a class="h22-alert" href="#news/${escapeText(alert.id)}"><b>시연 특보</b><span>${escapeText(alert.title)}</span>${icon('arrow')}</a>`:'';
}

const seoulHour=()=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
// 날씨 글에서 머리 배경 분위기를 고른다. 화면 장식만 바꾸며 날씨 값·판단에는 쓰지 않는다.
// 하늘 상태·강수 형태가 글에 적혀 있을 때만 해당 배경. 강수확률만 있거나 조회 실패면 중립(neutral) 배경.
function weatherMood(text){
 const t=String(text||'');
 if(/조회 실패|확인하지 못|연결 미설정|조회 중/.test(t)) return 'neutral';
 if(/눈|진눈깨비/.test(t)) return 'snow';
 if(/소나기|호우|비/.test(t.replace(/비 온 뒤/g,''))) return 'rain';
 if(/흐림|흐린|구름/.test(t)) return 'cloudy';
 if(/맑/.test(t)) return 'clear';
 return 'neutral';
}
function heroMood(text){
 const forced=navParams.get('wx');
 const mood=/^(clear|cloudy|rain|snow|neutral)$/.test(forced||'')?forced:weatherMood(text);
 const h=seoulHour(), night=navParams.get('wxTime')==='night'||(navParams.get('wxTime')!=='day'&&(h>=18||h<6));
 return {mood,night};
}
function applyHeroMood(hero){
 if(!hero) return;
 const {mood,night}=heroMood(hero.querySelector('.h22-wx')?.textContent);
 hero.dataset.mood=mood; hero.dataset.time=night?'night':'day';
 document.body.dataset.wxMood=mood; document.body.dataset.wxTime=night?'night':'day';
}

// 장식이라 화면 읽기에서 숨긴다. 움직임 줄이기 설정이면 멈춘다(CSS).
const cloudPath='M18 44h66a16 16 0 0 0 2-31.9A22 22 0 0 0 44.6 6 18 18 0 0 0 12 16.6 14 14 0 0 0 18 44Z';
function homeScene(){
 const cloud=c=>`<svg class="h23-cloud ${c}" viewBox="0 0 100 48"><path d="${cloudPath}"/></svg>`;

 return `<span class="h23-photo" aria-hidden="true"></span><span class="h23-scrim" aria-hidden="true"></span>
 <div class="h23-sky" aria-hidden="true">
   <span class="h23-sun"></span><span class="h23-moon"></span><span class="h23-stars"></span>
   ${cloud('c1')}${cloud('c2')}${cloud('c3')}
   <span class="h23-precip p1"></span><span class="h23-precip p2"></span>
 </div>
 `;
}
function weekStrip(rows){
 const today=farm.stamp(new Date()).date, [y,m,d]=today.split('-').map(Number);
 const base=new Date(Date.UTC(y,m-1,d)), dow=(base.getUTCDay()+6)%7, names=['월','화','수','목','금','토','일'];
 const dates=new Set(rows.map(r=>r.date));
 const recorded=[];
 const days=names.map((n,i)=>{
   const dt=new Date(base.getTime()+(i-dow)*86400000), iso=dt.toISOString().slice(0,10), has=dates.has(iso), on=iso===today;
   if(has) recorded.push(n);
   return `<span class="h23-day${on?' is-today':''}${has?' has-record':''}"${on?' aria-current="date"':''}><small>${n}</small><b>${dt.getUTCDate()}</b></span>`;
 }).join('');
 const said=recorded.length?`이번 주 기록한 날 ${recorded.join('·')}요일`:'이번 주 기록한 날 없음';
 return `<a class="h23-week" href="#calendar" aria-label="${said}. 오늘 ${names[dow]}요일. 일지 달력 열기">${days}</a>`;
}

// 이 동의 실제 자료로만 판단: 정식일, 병·벌레 기록, 피해 기록.
function missingRecords(ctx,rows){
 const m=[];
 if(!ctx.plant)m.push('정식일');
 if(!rows.some(r=>r.entryType==='pest'))m.push('병·벌레 기록');
 if(!rows.some(r=>r.kind==='damage'||r.entryType==='damage'))m.push('피해 기록');
 return m;
}
function homeHero(ctx,count,rows){
 const known=Number.isFinite(ctx.score), missing=missingRecords(ctx,rows||[]);
 const status=known&&ctx.score<80&&missing.length?(missing.length===1?`${missing[0]}이 비었어요`:`${missing[0]} 외 ${missing.length-1}개가 비었어요`):farm.readinessLabel(ctx.score,ctx.coverage);
 // 시연 미리보기(?wx=)로 배경을 바꾸면 가상 날씨 문구도 같은 값으로 맞춘다(배경과 글이 어긋나지 않게).
 const demoCond=({clear:'맑음',cloudy:'흐림',rain:'비',snow:'눈'})[navParams.get('wx')]||'비 온 뒤 흐림';
 const {mood,night}=heroMood(demoCond);
 return `<section class="h22-hero h23-hero" data-mood="${mood}" data-time="${night?'night':'day'}" aria-labelledby="farm-title">
   ${homeScene()}
   <div class="h22-toprow"><p class="h22-date">${escapeText(todayLabel())}</p>
     <button type="button" class="h22-scope" id="house-switch" aria-haspopup="dialog" aria-controls="switcher" aria-label="${escapeText(ctx.house)}, ${escapeText(ctx.seasonLabel||ctx.season)}. 동 바꾸기">
       <strong>${escapeText(ctx.house)}</strong><span>${escapeText(ctx.crop||'작기 미확인')}</span>${icon('down')}</button></div>
   <h1 id="farm-title" class="h22-hello">${escapeText(greeting())}</h1>
   <div class="h22-line h22-wx">
     <p class="h22-temp"><span class="sr">시연 기온 섭씨 </span>12<span aria-hidden="true">°</span><span class="sr">도</span></p>
     <div class="h22-copy"><p class="h22-strong">${escapeText(demoCond)}</p><p class="h22-sub">담양 가상 날씨 · <span class="nowrap">최고 15°</span> <span class="nowrap">최저 7°</span></p></div>
   </div>
   ${homeAlert()}
   ${weekStrip(rows)}
 </section>
 <section class="h23-card" aria-label="기록 준비도와 기록하기">
   <a class="h22-score" href="#readiness" aria-label="기록 준비도 ${known?ctx.score+'점, '+escapeText(status)+', ':'미확인, '}이번 작기 기록 ${count}건. 준비도 안내 보기">
     ${readinessRing(ctx.score)}
     <div class="h22-copy"><p class="h22-cap">기록 준비도</p><p class="h22-strong">${known?escapeText(status):'준비도 미확인'}</p><p class="h22-sub">이번 작기 기록 ${count}건</p></div>
     ${icon('arrow')}
   </a>
   <div class="h21-actions"><a class="primary-link" href="#record">${icon('pen')}기록하기</a><a class="home-damage-link" href="#damage">${icon('alert')}피해 기록</a></div>
   ${todoLine(ctx,rows)}
 </section>`;
}

function todoLine(ctx,rows){
 const today=farm.stamp(new Date()).date;
 const task=rows.find(r=>r.kind==='damage'&&!r.sample&&!r.office&&!r.receiptAt&&(r.date===today||(Number.isFinite(Date.parse(r.created))&&farm.stamp(new Date(r.created)).date===today)));
 return task
   ?`<button type="button" class="h23-todo today-task task-open is-warn" data-home-record="${escapeText(task.id)}"><b>지금 할 일</b><span>피해를 알게 되면 바로 가입한 농축협에 알리기</span>${icon('arrow')}</button>`
   :`<p class="h23-todo today-task"><b>지금 할 일</b><span>오늘 한 일을 적어 주세요</span></p>`;
}
function todayCards(ctx,rows,latest){
 const today=farm.stamp(new Date()).date;
 const task=rows.find(r=>r.kind==='damage'&&!r.sample&&!r.office&&!r.receiptAt&&(r.date===today||(Number.isFinite(Date.parse(r.created))&&farm.stamp(new Date(r.created)).date===today)));
 const photo=latest&&FarmPhoto.localImage(latest);
 const rec=latest?`<button type="button" class="h23-tcard recent-entry${photo?' has-thumb':''}" data-home-record="${escapeText(latest.id)}">
     ${photo?`<span class="h23-thumb" aria-hidden="true"><img src="${escapeText(photo)}" alt=""></span>`:''}<strong class="record-memo">${escapeText(latest.memo?.trim()||'사진으로 남긴 기록')}</strong>
     <span class="h23-meta">${escapeText(ctx.house)} · ${dateLabel(latest.date)} · ${escapeText(FarmJournalEdit.typeNames[FarmJournalEdit.typeOf(latest)])}${latest.sample?' · 시연 기록':''}</span>
     <span class="h23-open">저장한 기록 확인 ${icon('arrow')}</span></button>`
   :`<a class="h23-tcard" href="#record"><span class="h23-tag">최근 기록</span><strong>이 동에 저장한 기록이 없어요</strong><span class="h23-meta">첫 기록 남기기</span></a>`;
 return `<section class="h23-today" aria-labelledby="h23-today-title">
   <div class="h21-head"><h2 id="h23-today-title">최근 기록</h2><span class="h21-links"><a class="home-journal-calendar" href="#calendar" aria-label="농장 일지 달력 보기">${icon('calendar')}달력</a><a class="field-saved" href="#journal">일지 전체 보기 ${icon('arrow')}</a></span></div>
   ${rec}
 </section>`;
}
function homeNote(ctx){
 return `<p class="h21-note">날씨는 지역 가상값이에요. ${ctx.score===65?'준비도는 고정 시연 점수이고, ':'준비도는 '}수리비와는 별개예요.</p>`;
}
function homeNews(){
 if(!window.FarmNews) return '';
 const items=FarmNews.list('all').filter(p=>!p.alert), first=items.find(p=>p.pinned)||items[0];
 if(!first) return '';

 const more=FarmNews.list('all').length-1-(FarmNews.alert()?1:0);
 return `<section class="h21-section" aria-labelledby="h21-news-title">
   <div class="h21-head"><h2 id="h21-news-title">소식</h2><a href="#news" aria-label="소식 ${more>0?`${more}건 더 보기`:'전체 보기'}">${more>0?`${more}건 더 보기`:'전체 보기'} ${icon('arrow')}</a></div>
   <a class="h21-news" href="#news/${escapeText(first.id)}"><span class="news-tag">${escapeText(FarmNews.label(first.cat))}</span>
     <strong>${escapeText(first.title)}</strong><span class="news-meta">${newsDate(first.date)} · 시연용 가상 글</span></a>
 </section>`;
}
function home(){
 const ctx = farm.context();
 const rows = farm.records();
 const latest = rows.filter(r => !r.sample && Number.isFinite(Date.parse(r.created))).sort((a,b) => Date.parse(b.created)-Date.parse(a.created))[0] || rows[0];
 const readiness = farm.readinessSummary(rows.length);
 const action = nextAction(rows);
 if(FarmField.enabled) return fieldHome(ctx,readiness,latest,action);
 return `<article class="orchard-home home21 home22 home23" aria-labelledby="farm-title">
   ${homeHero(ctx,rows.length,rows)}
   ${todayCards(ctx,rows,preview === '2' && !latest?.created ? null : latest)}
   ${homeNews()}
   ${insuranceCard()}
   <div class="h21-foot">${homeNote(ctx)}${homeDisclosure}</div>
 </article>`;
}
function newsView(route){
 const id=route.split('/')[1];
 if(id){
   const p=FarmNews.get(id);
   if(!p) return `<section class="utility-page news-page"><h1>소식을 찾을 수 없어요</h1><p>목록에서 다시 골라 주세요.</p><a class="primary-link" href="#news">소식 목록으로</a></section>`;
   const next=p.cat==='insurance'?`<a class="primary-link" href="${escapeText(FarmNav.insuranceHref({params:navParams,visit:navParams.get('visit')}))}">${icon('insurance')}보험 탭에서 보기</a>`
     :p.cat==='weather'?`<a class="primary-link" href="#damage">${icon('alert')}피해 기록하기</a>`:'';
   return `<article class="utility-page news-page news-detail">
     <p class="news-kicker"><span class="news-tag${p.alert?' is-alert':''}">${escapeText(FarmNews.label(p.cat))}</span>${newsDate(p.date)} · ${escapeText(p.source)}</p>
     <h1>${escapeText(p.title)}</h1>
     ${p.body.map(x=>`<p>${escapeText(x)}</p>`).join('')}
     <p class="news-foot">시연용 가상 글이에요. 실제 일정과 조건은 가입한 농축협이나 기관 공고에서 확인하세요.</p>
     ${next}
   </article>`;
 }
 const cat=newsFilter, list=FarmNews.list(cat);
 const chip=(v,l)=>`<button type="button" class="news-chip" data-news-cat="${v}" aria-pressed="${cat===v}">${l}</button>`;
 return `<section class="utility-page news-page">
   <h1>소식</h1><p class="news-lead">농업·보험·지원사업 소식을 모았어요. 모두 시연용 가상 글이에요.</p>
   <div class="news-chips" role="group" aria-label="소식 분류">${chip('all','전체')}${FarmNews.categories.map(c=>chip(c.id,c.label)).join('')}</div>
   <ul class="news-list">${list.map(p=>`<li><a class="news-item${p.alert?' is-alert':''}" href="#news/${escapeText(p.id)}">
     <span class="news-row"><span class="news-tag${p.alert?' is-alert':''}">${escapeText(FarmNews.label(p.cat))}</span>${p.pinned?'<span class="news-pin">중요</span>':''}</span>
     <strong>${escapeText(p.title)}</strong><span class="news-sum">${escapeText(p.summary)}</span><span class="news-meta">${newsDate(p.date)} · 시연용 가상 글</span></a></li>`).join('')||'<li class="news-empty">이 분류에는 아직 소식이 없어요.</li>'}</ul>
 </section>`;
}
let newsFilter='all';
// 홈 머리 배경: 날씨 줄 글(시연값 또는 API 연결본이 바꾼 값)이 바뀌면 분위기를 다시 고른다.
let moodObserver=null;
function bindHomeMood(){
 moodObserver?.disconnect(); moodObserver=null;
 const hero=document.querySelector('.h23-hero');
 if(!hero){delete document.body.dataset.wxMood;delete document.body.dataset.wxTime;return}
 applyHeroMood(hero);
 const wx=hero.querySelector('.h22-wx');
 if(wx){moodObserver=new MutationObserver(()=>applyHeroMood(hero));moodObserver.observe(wx,{childList:true,subtree:true,characterData:true});}
}

function showHouses(view='list',target=''){
 const d=el('switcher'), current=farm.context(), list=farm.contexts();
 const head=(title,back)=>`<div class="dialog-head"><h2 id="choose-house">${title}</h2><button class="plain" id="${back?'house-back':'close-dialog'}" type="button">${back?'뒤로':'닫기'}</button></div>`;
 if(view==='list'){
   d.innerHTML=head('하우스 동 바꾸기')+list.map(c=>`<div class="house-row">
     <button type="button" data-house="${escapeText(c.id)}" class="house-option ${c.id===current.id?'active':''}"><span><strong>${escapeText(c.house)}</strong><small>${escapeText(c.seasonLabel||c.season)}</small></span>${c.id===current.id?'<span>선택됨</span>':''}</button>
     <button type="button" class="house-crop" data-house-edit="${escapeText(c.id)}" aria-label="${escapeText(c.house)} 작물 설정" title="작물 설정"><span aria-hidden="true">+</span></button></div>`).join('')+
     (list.length<9?`<button type="button" class="house-add" id="house-add">＋ 동 추가</button>`:'<p class="house-note">동은 9동까지 추가할 수 있어요.</p>')+
     `<p class="house-note">추가한 동과 작물 설정은 이 기기에만 저장돼요.</p>`;
 }else if(view==='form'){
   const c=list.find(x=>x.id===target), adding=!c;
   const nextId=['3','4','5','6','7','8','9'].find(n=>!list.some(x=>x.id===n));
   const opt=(v,l,sel)=>`<option value="${v}"${v===sel?' selected':''}>${l}</option>`;
   d.innerHTML=head(adding?'동 추가':`${escapeText(c.house)} 작물 설정`,true)+`<form class="house-form" novalidate>
     ${adding?`<p class="house-new">새 동 이름 <strong>하우스 ${nextId}동</strong></p>`:''}
     <label>작물<select name="crop">${opt('',adding?'나중에 정하기':'정하지 않음',c?.crop||'')}${farm.crops.map(x=>opt(x,x,c?.crop||'')).join('')}</select></label>
     <label>정식일 <small>(선택)</small><input type="date" name="plant" value="${escapeText(c?.plant||'')}"></label>
     <p class="house-error" role="alert"></p>
     <div class="house-actions"><button type="button" class="secondary" id="house-cancel">취소</button><button type="submit" class="solid">${adding?'추가하기':'저장하기'}</button></div>
     ${c?.custom?`<button type="button" class="house-delete" id="house-delete">이 동 삭제</button>`:''}
   </form>`;
 }else{
   const c=list.find(x=>x.id===target);if(!c)return showHouses('list');const n=farm.houseRecordCount(target);
   d.innerHTML=head(`${escapeText(c.house)} 삭제`,true)+`<p class="house-warn">${escapeText(c.house)}${n?`과 이 동의 기록 ${n}건을`:'을'} 지울까요? 지우면 되돌릴 수 없어요.</p>
     <div class="house-actions"><button type="button" class="secondary" id="house-cancel">취소</button><button type="button" class="house-confirm" id="house-confirm">${n?'동과 기록 지우기':'동 지우기'}</button></div>`;
 }
 if(!d.open)d.showModal();
 const back=()=>showHouses(view==='delete'?'form':'list',view==='delete'?target:'');
 d.querySelector('#close-dialog')?.addEventListener('click',()=>d.close());
 d.querySelector('#house-back')?.addEventListener('click',back);
 d.querySelector('#house-cancel')?.addEventListener('click',back);
 d.querySelectorAll('[data-house]').forEach(b=>b.onclick=()=>{
   const changed=current.id!==b.dataset.house;
   farm.selectContext(b.dataset.house);d.close();render();el('house-switch')?.focus();
   if(changed)window.announceFarmStatus(`${farm.context().house} 기록으로 바꿨어요.`);
 });
 d.querySelectorAll('[data-house-edit]').forEach(b=>b.onclick=()=>showHouses('form',b.dataset.houseEdit));
 d.querySelector('#house-add')?.addEventListener('click',()=>showHouses('form',''));
 d.querySelector('#house-delete')?.addEventListener('click',()=>showHouses('delete',target));
 const form=d.querySelector('.house-form');
 form?.addEventListener('submit',e=>{
   e.preventDefault();
   const btn=form.querySelector('[type=submit]');if(btn.disabled)return;btn.disabled=true;
   const setting={crop:form.elements.crop.value,plant:form.elements.plant.value};
   try{
     if(target){farm.setHouseCrop(target,setting);render();showHouses('list');window.announceFarmStatus('작물 설정을 저장했어요.');}
     else{const id=farm.addHouse(setting);farm.selectContext(id);d.close();render();el('house-switch')?.focus();window.announceFarmStatus(`하우스 ${id}동을 추가했어요.`);}
   }catch(err){form.querySelector('.house-error').textContent=err.message;btn.disabled=false;}
 });
 d.querySelector('#house-confirm')?.addEventListener('click',e=>{
   e.currentTarget.disabled=true;
   const name=list.find(x=>x.id===target)?.house;
   try{farm.removeHouse(target);showHouses('list');render();window.announceFarmStatus(`${name}을 지웠어요.`);}
   catch(err){d.querySelector('.house-warn').textContent=err.message;e.currentTarget.disabled=false;}
 });
 (d.querySelector('[data-house].active')||d.querySelector(view==='delete'?'#house-cancel':'select, .dialog-head button'))?.focus();
}
function settings(){
 return `<section class="utility-page"><h1>설정</h1><h2>현장 모드</h2><div class="field-setting">${FarmField.switchMarkup()}<p>글씨와 누르는 곳을 크게 키우고, 현장 홈에서 큰 버튼으로 사진과 메모를 남겨요.</p></div><h2>읽어주기</h2><p>버튼을 누르면 직전에 보던 화면의 본문을 읽어줘요.</p><div class="access-panel"><button type="button" id="read-aloud">${icon('sound')}화면 읽어주기</button><p class="access-status" role="status" id="speech-status"></p></div><a class="setting-row" href="#readiness"><span class="label">${icon('journal')}기록 준비도 안내</span>${icon('arrow')}</a><a class="setting-row" href="#welcome"><span class="label">${icon('info')}체험 안내 다시 보기</span>${icon('arrow')}</a></section>`;
}
function welcome(){
 return `<section class="utility-page"><p class="eyebrow">전남 담양 / 시설 딸기</p><h1>비가 그친 아침</h1><figure class="scene"><img src="assets/house.png" alt="가상 농장의 비닐하우스"></figure><h2>김민수의 딸기 농장</h2><p>밤새 내린 비로 통로에 물이 찼어요.<br>응급조치를 먼저 하고, 안전할 때 오늘 현장을 남겨 보세요.</p><p class="disclaimer">가상 농장 체험입니다. 실제 결제나 보험 접수는 하지 않아요.</p><a class="primary-link" href="#home">농장 홈 열기</a></section>`;
}
let textToRead='';
function readText(){
 const status=el('speech-status'), button=el('read-aloud');
 if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){status.textContent='이 브라우저에서는 읽어주기를 사용할 수 없어요.';return}
 if(currentSpoken){window.speechSynthesis.cancel();currentSpoken=null;button.innerHTML=icon('sound')+'화면 읽어주기';status.textContent='읽기를 멈췄어요.';return}
 const read=new SpeechSynthesisUtterance(textToRead||'설정. 현장 모드를 켜면 글씨와 버튼이 커져요.');
 read.lang='ko-KR';currentSpoken=read;
 read.onstart=()=>{if(currentSpoken!==read)return;button.innerHTML=icon('sound')+'읽기 멈추기';status.textContent='화면 본문을 읽고 있어요.'};
 read.onend=()=>{if(currentSpoken!==read)return;currentSpoken=null;button.innerHTML=icon('sound')+'화면 읽어주기';status.textContent='읽기를 마쳤어요.'};
 read.onerror=()=>{if(currentSpoken!==read)return;currentSpoken=null;button.innerHTML=icon('sound')+'화면 읽어주기';status.textContent='음성을 재생할 수 없어요. 기기의 한국어 음성 설정을 확인해 주세요.'};
 status.textContent='기기 음성을 준비하고 있어요.';window.speechSynthesis.cancel();window.speechSynthesis.speak(read);
}
function render(){
 if(location.hash==='#main-area'){el('main-area').focus();return}
 if(location.hash==='#insurance'){
   location.replace(FarmNav.insuranceHref({params:navParams,visit:navParams.get('visit')}));
   return;
 }
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
   const scrollId = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
   history.replaceState({...history.state,farmScrollId:scrollId},'');
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
 const section=inSettings?'settings':['home','readiness'].includes(base)?'home':base==='news'?'news':inMall?'shop':'journal';
 const title=({record:'기록하기','edit-record':'기록 수정','delete-record':'기록 삭제'})[base]||labels[base]||'농장 일지';
 document.title=`${title} · 농사처방 담양`;
 el('sidebar').innerHTML=brand+`<nav aria-label="주 메뉴">${nav(section)}</nav><a class="rail-settings" href="#settings"${inSettings?' aria-current="page"':''}>${icon('settings')}설정</a><div class="rail-footer"><strong>김민수의 딸기 농장</strong><small>전남 담양 / 시설 딸기</small></div>`;
 el('mobile-nav').innerHTML=nav(section);FarmNav.refresh?.();
 const openedCalendarFromHome=base==='calendar' && history.state?.farmPrev==='home';
 const back=base==='settings'?settingsEntry.route:base==='welcome'?'settings':base==='readiness'?returnFromReadiness:openedCalendarFromHome?'home':base==='news'?(route.includes('/')&&history.state?.farmPrev!=='home'?'news':'home'):farm.backTarget(route);
 const destination=escapeText(FarmMall.backLabel(back));
 const left=base==='home'?`${brand}<span class="desktop-title">농장 홈</span>`:`<a class="back-link" href="#${escapeText(back)}" aria-label="${destination} 돌아가기">${icon('back')}${destination}</a>`;
 // v21: 설정 탭을 빼는 대신 홈 위쪽 오른쪽에 톱니 버튼
 el('bar').innerHTML=left+(base==='home'?`<div class="bar-tools">${FarmField.switchMarkup()}<a class="bar-settings" href="#settings" aria-label="설정">${icon('settings')}</a></div>`:FarmField.switchMarkup());
 const backLink=el('bar').querySelector('.back-link');
 const distance=history.state?.farmPrev===back?-1:inMall?priorMallEntry(back):0;
 if(backLink&&distance)backLink.addEventListener('click',event=>{event.preventDefault();history.go(distance)});
 el('main-area').innerHTML=base==='home'?home():base==='settings'?settings():base==='welcome'?welcome():base==='news'?newsView(route):farm.view(route);
 el('house-switch')?.addEventListener('click',()=>showHouses());
 bindHomeMood();
 if(base==='settings'){
  el('read-aloud').onclick=readText;
 } else if(base==='news'){
  el('main-area').querySelectorAll('[data-news-cat]').forEach(b=>b.onclick=()=>{newsFilter=b.dataset.newsCat;render();el('main-area').querySelector(`[data-news-cat="${newsFilter}"]`)?.focus();window.announceFarmStatus(`${b.textContent} 소식 ${FarmNews.list(newsFilter).length}건`)});
 } else if(!['home','welcome'].includes(base)){farm.bind(route)}
 if(previous!==route){
   const saved=scrollPositions.get(viewedEntry);
   scrollPane.scrollTop=previous==='settings'&&route===settingsEntry.route
     ? settingsEntry.scroll : saved?.route===route ? saved.top : 0;
   if(previous)el('main-area').focus({preventScroll:true});
 }
}
window.addEventListener('hashchange',render);
el('main-area').addEventListener('click',event=>{
 const row=event.target.closest('[data-home-record]');
 if(row) farm.openRecent(row.dataset.homeRecord);
});
window.addEventListener('farm-field-change',()=>{
 if(route!=='home') return;
 el('main-area').innerHTML=home();
 el('house-switch').addEventListener('click',()=>showHouses());
 bindHomeMood();
 pageScroller().scrollTop=0;
});
document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();el('main-area').focus()});
el('switcher').addEventListener('click',e=>{if(e.target===el('switcher')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close()}});
render();
