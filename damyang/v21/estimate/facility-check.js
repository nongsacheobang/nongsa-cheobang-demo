


(function(){
'use strict';
const api=window.InsuranceEstimate;
const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduce()?0:ms));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const man=n=>n%10000===0?(n/10000).toLocaleString('ko-KR')+'만 원':n.toLocaleString('ko-KR')+'원';
const day=s=>s?Number(s.slice(5,7))+'월 '+Number(s.slice(8,10))+'일':'미입력';
const CHECK='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SHIELD='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l10 4v8c0 6.3-4.2 11.4-10 13-5.8-1.6-10-6.7-10-13V7z" fill="currentColor"/><path d="M11 16l3.4 3.4L21 12.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let done=!!InsuranceVisit.read('insurance-check')?.done;
let run=0;          // 진행 중인 단계 애니메이션 식별(취소 시 무효화)
let pin='';
let busy=false;
let opener=null;
const dlg=()=>document.getElementById('facility-check');

function setDone(v){done=v;InsuranceVisit.save('insurance-check',{done:v});}

function shell(title,body,actions=''){
  const d=dlg();
  d.innerHTML=`<div class="fc-frame">
    <header class="fc-bar"><span class="fc-bar-title">보험금 확인하기</span><button type="button" class="fc-cancel" data-fc-cancel>취소</button></header>
    <div class="fc-body"><h2 class="fc-title" tabindex="-1">${title}</h2>${body}</div>
    ${actions?`<footer class="fc-actions">${actions}</footer>`:''}
  </div>`;
  d.querySelector('[data-fc-cancel]').addEventListener('click',cancel);
  d.querySelector('.fc-title').focus({preventScroll:true});
  d.querySelector('.fc-body').scrollTop=0;
}

/* ① 시연용 간편인증 */
function stepAuth(){
  pin='';busy=false;
  shell('보험증권과 피해 기록을 불러오려면<br>간편인증할게요',
    `<button type="button" class="fc-cert" data-fc-cert>
       <span class="fc-cert-icon">${SHIELD}</span>
       <span class="fc-cert-name">가상 농가</span>
       <span class="fc-cert-meta">시연용 간편인증서 · 실제 인증서와 연결되지 않아요</span>
       <span class="fc-cert-go" aria-hidden="true">›</span>
     </button>
     <p class="fc-demo-note">시연용 화면이에요. 실제 본인인증이나 개인정보 조회를 하지 않아요.</p>
     <ol class="fc-steps" aria-label="확인 순서">
       <li class="is-now">간편인증</li><li>기록 불러오기</li><li>내용 확인</li><li>범위 보기</li>
     </ol>`,
    `<button type="button" class="fc-primary" data-fc-next>다음</button>`);
  dlg().querySelector('[data-fc-cert]').addEventListener('click',openPin);
  dlg().querySelector('[data-fc-next]').addEventListener('click',openPin);
}

async function autoType(){
  const me=run;
  await wait(700);
  for(let i=0;i<6;i++){
    if(me!==run||!dlg().querySelector('.fc-sheet'))return;
    const keys=[...dlg().querySelectorAll('.fc-pad [data-key]')].filter(b=>b.dataset.key!=='del');
    const b=keys[Math.floor(Math.random()*keys.length)];
    b.classList.add('is-tap');setTimeout(()=>b.classList.remove('is-tap'),140);
    press(b.dataset.key);
    await wait(320);
  }
}
function shuffled(){
  const d=[...'0123456789'];
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function openPin(){
  const d=dlg();
  if(d.querySelector('.fc-sheet'))return;
  pin='';
  const keys=shuffled();
  const pad=[...keys.slice(0,9),null,keys[9],'del'];
  const sheet=document.createElement('div');
  sheet.className='fc-sheet-wrap';
  sheet.innerHTML=`<div class="fc-sheet" role="group" aria-labelledby="fc-pin-title">
      <div class="fc-sheet-head">
        <button type="button" class="fc-sheet-close" data-fc-pin-close aria-label="비밀번호 입력 닫기">✕</button>
        <p id="fc-pin-title" tabindex="-1" class="fc-pin-title">시연용 인증 번호</p>
        <p class="fc-pin-hint">예시 번호가 자동으로 표시돼요. 실제 비밀번호는 입력하지 마세요.</p>
        <div class="fc-dots" aria-hidden="true">${'<i></i>'.repeat(6)}</div>
        <p class="fc-pin-status" role="status" aria-live="polite">0자리 입력</p>
      </div>
      <div class="fc-pad">${pad.map(k=>k===null?'<span></span>':k==='del'
        ?'<button type="button" tabindex="-1" aria-disabled="true" data-key="del" aria-label="한 자리 지우기">⌫</button>'
        :`<button type="button" tabindex="-1" aria-disabled="true" data-key="${k}">${k}</button>`).join('')}</div>
    </div>`;
  d.querySelector('.fc-frame').append(sheet);
  d.querySelectorAll('.fc-bar,.fc-body,.fc-actions').forEach(el=>el.inert=true);   // 시트 뒤 버튼으로 초점이 가지 않게
  d.querySelector('[data-fc-cert]').setAttribute('aria-expanded','true');

  sheet.querySelector('[data-fc-pin-close]').addEventListener('click',closePin);

  requestAnimationFrame(()=>sheet.classList.add('is-open'));
  sheet.querySelector('#fc-pin-title').focus({preventScroll:true});
  autoType();
}
function closePin(){
  const d=dlg(),sheet=d.querySelector('.fc-sheet-wrap');
  if(!sheet||busy)return;
  pin='';sheet.remove();
  d.querySelectorAll('.fc-bar,.fc-body,.fc-actions').forEach(el=>el.inert=false);
  const cert=d.querySelector('[data-fc-cert]');
  cert?.setAttribute('aria-expanded','false');cert?.focus();
}
function paintDots(){
  const d=dlg();
  d.querySelectorAll('.fc-dots i').forEach((dot,i)=>dot.classList.toggle('on',i<pin.length));
  const s=d.querySelector('.fc-pin-status');if(s)s.textContent=pin.length+'자리 입력';
}
async function press(key){
  if(busy)return;
  if(key==='del')pin=pin.slice(0,-1);
  else if(pin.length<6)pin+=key;
  paintDots();
  if(pin.length<6)return;
  busy=true;pin='';                 // 입력값은 즉시 버린다
  const me=++run, d=dlg();
  d.querySelector('.fc-sheet')?.classList.add('is-checking');
  const s=d.querySelector('.fc-pin-status');if(s)s.textContent='인증을 확인하고 있어요';
  await wait(1400);
  if(me!==run)return;
  busy=false;
  stepLoad();
}

/* ② 기록 불러오기 */
const pct=p=>p.damagedArea===null?'미입력':Math.round(p.damagedArea/p.area*1000)/10+'%';
const bandText=b=>b?.length?b.map(n=>`${(n-1)*10+1}~${n*10}%`).join(' · '):'미선택';
function sources(p){
  return [
    {key:'policy',name:'가상 보험증권',value:`작물 가입금액 ${man(p.cropSum)} · 시설물 가입금액 ${man(p.facilitySum)}`},
    {key:'journal',name:'가상 영농일지',value:`토마토 정식 ${day(p.plantDate)} · 수확 종료 예정 ${day(p.harvestEnd)}`},
    {key:'damage',name:'가상 피해 기록',value:`하우스 3동 · ${day(p.accidentDate)} 강풍 · 피해 면적 ${pct(p)}`},
    {key:'quote',name:'받은 수리 견적',value:p.estimatedLow===null?'기록에 없어요. 다음 단계에서 직접 입력해 주세요':[p.estimatedLow,p.estimatedHigh].filter(n=>n!==null).map(man).join(' · '),missing:p.estimatedLow===null}
  ];
}
async function stepLoad(){
  const me=++run;
  const {inputs:p}=api.state();
  const rows=sources(p);
  shell('가상 보험증권과 피해 기록에서<br>정보를 가져오고 있어요',
    `<div class="fc-progress"><p class="fc-percent" aria-hidden="true"><strong>0</strong>% 진행 중</p>
       <div class="fc-bar-track" role="progressbar" aria-label="불러오기 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div>
     <ul class="fc-load">${rows.map(r=>`<li data-row="${r.key}"><span class="fc-mark" aria-hidden="true"></span><span><b>${r.name}</b><small>${esc(r.value)}</small></span></li>`).join('')}</ul>
     <p class="fc-demo-note">시연용 가상 자료를 불러와요. 실제 보험사·농협 시스템과 연결되지 않아요.</p>
     <p class="fc-live" role="status" aria-live="polite"></p>`);
  const d=dlg(),num=d.querySelector('.fc-percent strong'),bar=d.querySelector('.fc-bar-track'),live=d.querySelector('.fc-live');
  const setPct=n=>{num.textContent=n;bar.setAttribute('aria-valuenow',n);bar.style.setProperty('--pct',n+'%');};
  const stops=rows.map((_,i)=>Math.round((i+1)*100/rows.length));
  let pct=0;
  for(let i=0;i<rows.length;i++){
    while(pct<stops[i]){
      pct=Math.min(stops[i],pct+(reduce()?100:1));setPct(pct);
      await wait(38);if(me!==run)return;
    }
    const li=d.querySelector(`[data-row="${rows[i].key}"]`);
    li.classList.add(rows[i].missing?'is-missing':'is-done');
    li.querySelector('.fc-mark').innerHTML=rows[i].missing?'!':CHECK;
    live.textContent=rows[i].name+(rows[i].missing?' 없음':' 확인');
    await wait(550);if(me!==run)return;
  }
  await wait(900);if(me!==run)return;
  stepConfirm();
}

/* ③ 내용 확인 */
// 행 상태: ok(확인됨) · none(알고 있는 답이지만 이 조건으로는 금액을 낼 수 없음) · need(모름·미입력)
function confirmRows(p,r){
  const blocks=key=>r.status!=='ready'&&r.field===key;
  const known=(key,v,good)=>v==='unknown'||v===null||v===''?'need':blocks(key)?'none':good?'ok':'none';
  return [
    ['사고일',day(p.accidentDate),'피해 기록',!p.accidentDate?'need':blocks('accidentDate')?'none':'ok'],
    ['받은 수리 견적',p.estimatedLow===null?'미입력':[p.estimatedLow,p.estimatedHigh].filter(n=>n!==null).map(man).join(' · '),p.estimatedLow===null?'직접 입력':'피해 기록',p.estimatedLow===null||blocks('estimatedLow')||blocks('estimatedHigh')?'need':'ok'],
    ['하우스 피해 종류',({yes:'비닐만 손상',no:'골조도 손상',unknown:'모름'})[p.coverOnly],'피해 기록',known('coverOnly',p.coverOnly,true)],
    ['수리 예정',({yes:'수리 예정',no:'수리하지 않음',unknown:'아직 모름'})[p.repair],'직접 확인',known('repair',p.repair,p.repair==='yes')],
    ['재조달가액 특약',({yes:'가입',no:'미가입',unknown:'모름'})[p.rider],'보험증권',known('rider',p.rider,p.rider==='yes')],
    ['시설물 가입금액',man(p.facilitySum),'보험증권','ok']
  ].slice(1);   // 사고일은 공통 줄로 따로 보여준다
}
// 작물 보험금 쪽 확인 항목(계산 결과 r의 field로 막힌 항목을 표시)
function cropRows(p,r){
  const blocks=key=>r.status!=='ready'&&r.field===key;
  return [
    ['피해 면적 비율',pct(p),'피해 기록',p.damagedArea===null?'need':blocks('damagedArea')?'none':'ok'],
    ['손해정도',bandText(p.bands),'피해 기록',!p.bands?.length?'need':blocks('bandLow')?'none':'ok'],
    ['이번 작기 받은 보험금',man(p.priorPaid??0),'보험증권',blocks('priorPaid')?'none':'ok'],
    ['작물 가입금액',man(p.cropSum),'보험증권','ok']
  ];
}
const badge={ok:'확인됨',none:'금액 없음',need:'확인 필요'};
const rowHtml=(rows,offset=0)=>rows.map(([k,v,src,st],i)=>`<li class="is-${st}" style="--i:${i+offset}">
        <span class="fc-k">${k}<small>${src}</small></span>
        <span class="fc-v">${esc(v)}<span class="fc-ok" role="img" aria-label="${badge[st]}">${st==='ok'?CHECK:badge[st]}</span></span></li>`).join('');
function stepConfirm(){
  ++run;
  const {inputs:p,crop:cr,facility:fr}=api.state();
  const dateSt=!p.accidentDate?'need':(cr.status!=='ready'&&cr.field==='accidentDate')||(fr.status!=='ready'&&fr.field==='accidentDate')?'none':'ok';
  const c=cropRows(p,cr),f=confirmRows(p,fr);
  const notes=[cr.status!=='ready'?'작물: '+cr.reason:'',fr.status!=='ready'?'시설물: '+fr.reason:''].filter(Boolean);
  shell('불러온 내용이 맞는지<br>확인해 주세요',
    `<ul class="fc-confirm">${rowHtml([['사고일',day(p.accidentDate),'피해 기록',dateSt]])}</ul>
     <div class="fc-group"><h3>작물 보험금</h3><button type="button" class="fc-group-edit" data-fc-edit="crop">바꾸기</button></div>
     <ul class="fc-confirm">${rowHtml(c,1)}</ul>
     <div class="fc-group"><h3>시설물 보험금</h3><button type="button" class="fc-group-edit" data-fc-edit="facility">바꾸기</button></div>
     <ul class="fc-confirm">${rowHtml(f,1+c.length)}</ul>
     <p class="fc-demo-note">${notes.length?esc(notes.join(' '))+' 이대로 계산하면 그 보험금은 금액 없이 이유만 보여줘요.':'약관 산식으로 계산해 보는 범위예요. 손해평가 결과가 아니에요.'}</p>`,
    `<button type="button" class="fc-primary" data-fc-go>다음</button>`);
  const d=dlg();
  d.querySelectorAll('[data-fc-edit]').forEach(b=>b.addEventListener('click',()=>{
    const which=b.dataset.fcEdit,editor=document.getElementById('editor');
    api.selectTab(which);
    api.edit();
    editor.addEventListener('close',()=>{if(dlg().open){stepConfirm();dlg().querySelector(`[data-fc-edit="${which}"]`)?.focus();}},{once:true});
  }));
  d.querySelector('[data-fc-go]').addEventListener('click',stepCalc);
}

/* ④ 계산 중 → 결과 */
async function stepCalc(){
  const me=++run;
  shell('보험금 범위를 계산하고 있어요',
    `<div class="fc-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
     <p class="fc-demo-note" role="status">작물은 경과일수와 피해 면적으로, 시설물은 견적에서 자기부담금을 빼고 가입금액 한도를 적용해요.</p>`);
  await wait(2600);if(me!==run)return;
  setDone(true);
  const d=dlg();d.close();
  window.drawEstimate?.();
  const card=document.querySelector('#result .result-card');
  document.getElementById('example')?.scrollIntoView({block:'start',behavior:reduce()?'auto':'smooth'});
  card?.classList.add('fc-just-checked');
  setTimeout(()=>card?.classList.remove('fc-just-checked'),reduce()?0:2200);
  const t=document.getElementById('estimate-title');t?.setAttribute('tabindex','-1');t?.focus({preventScroll:true});
}

function cancel(){++run;busy=false;pin='';dlg().close();}
function start(){
  const d=dlg();if(!d||d.open)return;
  opener=document.activeElement;
  stepAuth();
  d.showModal();
  d.querySelector('.fc-title').focus({preventScroll:true});
}
function restart(){setDone(false);window.drawEstimate?.();start();}

document.addEventListener('DOMContentLoaded',()=>{
  const d=dlg();
  // Chrome은 사용자 입력 없이 연속된 cancel의 preventDefault를 무시할 수 있어, Esc keydown 단계에서 먼저 막는다.
  d.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&d.querySelector('.fc-sheet-wrap')){e.preventDefault();e.stopPropagation();closePin();}
  },true);
  d.addEventListener('cancel',e=>{               // Esc: 비밀번호 시트가 열려 있으면 시트만 닫는다
    if(d.querySelector('.fc-sheet-wrap')){e.preventDefault();closePin();return;}
    ++run;busy=false;pin='';
  });
  d.addEventListener('close',()=>{
    d.innerHTML='';
    if(!done){
      const back=opener?.isConnected&&opener.offsetParent?opener:document.getElementById('facility-start');
      back?.focus({preventScroll:true});
    }
    opener=null;
  });
  document.getElementById('facility-start')?.addEventListener('click',start);
  document.getElementById('facility-restart')?.addEventListener('click',restart);
});
window.FacilityCheck=Object.freeze({done:()=>done,start,restart});
})();
