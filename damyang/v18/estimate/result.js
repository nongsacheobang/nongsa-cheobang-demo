'use strict';
const $=id=>document.getElementById(id);
const api=window.InsuranceEstimate;
const value=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});
const won=n=>value(n)+'원';
const date=s=>s.split('-').map(Number).map((v,i)=>v+['년 ','월 ','일'][i]).join('');
const spanBand=band=>`${(band-1)*10+1}~${band*10}%`;
const statusMap={yes:'가입',no:'미가입',unknown:'모름'};
const facts=(label,content)=>`<div><dt>${label}</dt><dd>${content}</dd></div>`;
function facilityEstimates(p){
 return [p.estimatedLow,p.estimatedHigh].filter(n=>n!==null).map(n=>n%10000===0?value(n/10000)+'만 원':won(n)).join(' · ') || '미입력';
}
function cropFactors(p){
 return facts('피해면적',p.damagedArea===null?'미입력':`${value(p.damagedArea)}㎡ <small>/ 재배 ${value(p.area)}㎡</small>`)+
        facts('손해정도',p.bands.length?p.bands.map(spanBand).join(' · '):'미선택')+
        facts('기준일',p.includeAlert?'11월 15일 특보일 · 16일 사고일':'11월 16일 사고일');
}
function facilityFactors(p){
 return facts('받은 수리 견적',facilityEstimates(p))+
        facts('피해와 수리',`${({yes:'비닐만 손상',no:'골조도 손상',unknown:'손상 부위 미확인'})[p.coverOnly]} · ${({yes:'수리 예정',no:'수리하지 않음',unknown:'수리 예정 미확인'})[p.repair]}`)+
        facts('재조달가액 특약',statusMap[p.rider]);
}
function cropEvidence(p,r){
 const bands=p.bands;
 const rows=facts('가상 보험증권',`작물 가입금액 ${won(p.cropSum)} · 가입면적 ${value(p.insuredArea)}㎡`)+
   facts('가상 영농일지',`정식 ${date(p.plantDate)} · 사고 ${date(p.accidentDate)}`)+
   facts('직접 입력한 조건','피해면적 · 손해정도 · 특보일 포함 여부')+
   facts('계산 가정',`가입 비율 미확인 · 미보상비율 0% · 이번 작기 기지급액 ${won(p.priorPaid??0)}`);
 let explanation='';
 if(r.status==='ready'){
  const baseLo=Math.min(...r.bases),baseHi=Math.max(...r.bases);
  const share=p.damagedArea/p.area;
  const limit=p.cropSum-(p.priorPaid??0);
  const low=Math.min(limit,baseLo*r.progressMin*share*bands[0]/10);
  const high=Math.min(limit,baseHi*r.progressMax*share*bands.at(-1)/10);
  explanation=`<h3>범위를 만드는 값</h3><p>${bands.length===2?'선택한 두 손해정도 구간과':'선택한 손해정도 구간과'} 정식 후 경과일수로 낮은 쪽과 높은 쪽을 각각 계산했어요. ${p.includeAlert?'이 예시에는 11월 15일 특보일과 16일 사고일을 모두 넣었어요.':'이 예시에는 11월 16일 사고일만 넣었어요.'}</p>
   <p class="formula">기준금액 × 경과비율 × 피해면적 비율 × 손해정도 계수</p>
   <dl class="trace">${facts('기준금액',baseLo===baseHi?won(baseLo):won(baseLo)+'~'+won(baseHi))}${facts('경과비율',`${value(r.progressMin*100)}~${value(r.progressMax*100)}%`)}${facts('피해면적 비율',`${value(p.damagedArea)} / ${value(p.area)}㎡`)}${facts('손해정도 계수',bands.map(b=>b+'/10').join(' · '))}${facts('한도 적용 후',`${won(Math.round(low))}~${won(Math.round(high))}`)}</dl>
   <p>${r.underThresholdMin?'낮은 쪽이 원본 시연의 동별 10만 원 이하 구간에 들어요. ':''}화면 범위는 원본처럼 하한을 만 원 단위로 내리고 상한은 올려 표시해요.</p>`;
 }else{explanation='<p>'+r.reason+'</p>'}
 return explanation+'<h3>입력값의 출처</h3><dl class="trace">'+rows+'</dl>';
}
function facilityEvidence(p,r){
 const calc=r.status==='ready'?'<h3>견적별 계산</h3><p>입력한 견적마다 자기부담금을 빼고 시설물 가입금액 한도를 적용했어요.</p><dl class="trace">'+r.amounts.map((a,i)=>facts('견적 '+(i+1),`${won(a.estimate)} − ${won(Math.round(a.deductible))} = ${won(Math.round(a.estimate-a.deductible))}`)).join('')+facts('시설물 가입 한도',won(p.facilitySum))+'</dl><p>화면에는 가입 한도를 적용한 범위를 만 원 단위로 표시해요.</p>':'<p>'+r.reason+'</p>';
 return calc+'<h3>입력값의 출처</h3><dl class="trace">'+
   facts('가상 보험증권','시설물 가입금액 '+won(p.facilitySum))+
   facts('가상 피해 기록','하우스 3동 · 2026년 11월 16일 강풍')+
   facts('시연 입력값','견적, 손상 부위, 재조달가액 특약과 수리 예정 여부')+
   '</dl>';
}
const latestByTab={};
const messages={};
function changeText(tab,previous,next){
 if(next.result.status!=='ready'||previous.result.status!=='ready')return '';
 const crop=tab==='crop';
 const fieldLabels=crop?{damagedArea:'피해면적',bands:'손해정도',includeAlert:'특보일',priorPaid:'기지급액'}:{estimatedLow:'첫 견적',estimatedHigh:'두 번째 견적',rider:'재조달가액 특약',repair:'수리 예정',coverOnly:'손상 부위'};
 const changes=Object.keys(fieldLabels).filter(k=>JSON.stringify(previous.inputs[k])!==JSON.stringify(next.inputs[k]));
 if(!changes.length)return '';
 const label=changes.map(k=>fieldLabels[k]).join('·');
 const moneyStep=(n,t)=>n===0?'':`${t} ${value(Math.abs(n)/10000)}만 원 ${n>0?'상승':'하락'}`;
 const diffs=[moneyStep(next.result.min-previous.result.min,'하한'),moneyStep(next.result.max-previous.result.max,'상한')].filter(Boolean);
 if(next.result.underThresholdMin||previous.result.underThresholdMin)return `${label} 변경을 반영했어요.`;
 return `${label} 변경 · ${diffs.join(', ')||'예상 범위 유지'}`;
}
// The visible columns share one complete range announcement for screen readers.
function paintRange(result, subject) {
 const ready = result.status === 'ready';
 const announcement = $('amount');
 const card = $('range-card');
 announcement.textContent = ready ? result.displayRange : '계산을 보류했어요';
 announcement.classList.toggle('pending', !ready);
 card.hidden = !ready;
 card.replaceChildren();
 const title = $('estimate-title');
 const subjectLine = document.createElement('span');
 subjectLine.textContent = subject;
 const resultLine = document.createElement('span');
 resultLine.textContent = '보험금 계산';
 title.replaceChildren(subjectLine, ' ', resultLine);
 if (!ready) return;

 const single = result.underThresholdMax || result.min === result.max;
 resultLine.textContent = single ? '보험금 예상액' : '보험금 예상 범위';
 const bounds = single
   ? [['예상 금액', result.min, result.underThresholdMax]]
   : [['낮은 예상액', result.min, result.underThresholdMin], ['높은 예상액', result.max, false]];

 for (const [label, amount, belowThreshold] of bounds) {
  const cell = document.createElement('div');
  const caption = document.createElement('span');
  caption.className = 'bound-label';
  caption.textContent = label;
  const figure = document.createElement('div');
  figure.className = 'bound-figure';
  if (!belowThreshold) {
   const prefix = document.createElement('span');
   prefix.className = 'approx';
   prefix.textContent = '약';
   figure.append(prefix, ' ');
  }
  const number = document.createElement('strong');
  number.textContent = belowThreshold ? '10' : value(amount / 10000);
  const unit = document.createElement('span');
  unit.className = 'bound-unit';
  unit.textContent = belowThreshold ? '만 원 이하' : '만 원';
  figure.append(number, unit);
  cell.append(caption, figure);
  card.append(cell);
 }
}
function drawEstimate(){
 const {inputs:p,tab,result:r}=api.state(),crop=tab==='crop',ready=r.status==='ready';
 const now={inputs:p,result:r}, last=latestByTab[tab];
 if(last && JSON.stringify(last.inputs)!==JSON.stringify(p)) messages[tab]=changeText(tab,last,now);
 latestByTab[tab]=now;
 $('change-note').textContent=ready?(messages[tab]||''):'';
 for(const b of document.querySelectorAll('[data-tab]')){
  const selected=b.dataset.tab===tab;
  b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;
 }
 $('result').setAttribute('aria-labelledby','tab-'+tab);
 paintRange(r, crop ? '토마토' : '하우스 시설물');
 $('summary-line').textContent=ready?'가입 내용과 실제 피해를 확인하면 지급액은 달라질 수 있어요.':r.reason;
 $('object').src=crop?'../assets/crop-hero.webp':'../assets/facility-hero.webp';
 $('facts-title').textContent=ready?'계산에 쓴 조건':'현재 입력한 조건';
 $('evidence-title').textContent=ready?'왜 이 범위인가요?':'입력값과 출처 보기';
 $('facts').innerHTML=crop?cropFactors(p):facilityFactors(p);
 $('evidence').open=false;
 $('evidence-body').innerHTML=(crop?cropEvidence(p,r):facilityEvidence(p,r))+'<p class="source-note">2026년 11월 20일 로컬 보험 시연의 산식과 가상 자료를 사용했어요. 이 범위는 보험사에 제출하는 서류가 아니에요.</p>';
 $('edit').textContent=ready?'계산 조건 바꾸기':'계산 조건 확인하기';
}
window.drawEstimate=drawEstimate;
const tabs=[...document.querySelectorAll('[data-tab]')];
for(const b of tabs){
 b.addEventListener('click',()=>api.selectTab(b.dataset.tab));
 b.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();
  const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs[1]:tabs.find(x=>x!==b);
  next.focus();api.selectTab(next.dataset.tab);
 });
}
$('edit').addEventListener('click',()=>api.edit());
drawEstimate();

const calendarPage = new URLSearchParams(location.search).get('calendar') === '68' ? 68 : 67;
$('calendar-return').href = InsuranceVisit.link('../atlas/insurance.html?p=' + calendarPage);
