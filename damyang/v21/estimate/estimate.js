(function(){
'use strict';

const model=window.InsuranceScenario;
let inputs=model.initialInputs(), tab='crop';
let opener=null;
const fields={
  crop:['accidentDate','damagedArea','bands','includeAlert','priorPaid'],
  facility:['accidentDate','estimatedLow','estimatedHigh','rider','repair','coverOnly']
};
const saved = InsuranceVisit.read('estimate');
if (saved) {
  tab = saved.tab === 'facility' ? 'facility' : 'crop';
  for (const key of ['damagedArea','priorPaid','estimatedLow','estimatedHigh']) {
    if (saved[key] === null || Number.isFinite(saved[key])) inputs[key] = saved[key];
  }
  for (const key of ['rider','repair','coverOnly']) {
    if (['yes','no','unknown'].includes(saved[key])) inputs[key] = saved[key];
  }
  if (typeof saved.includeAlert === 'boolean') inputs.includeAlert = saved.includeAlert;
  if (saved.accidentDate === '' || (typeof saved.accidentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.accidentDate))) inputs.accidentDate = saved.accidentDate;
  if (Array.isArray(saved.bands) && saved.bands.length <= 2 &&
      saved.bands.every(n => Number.isInteger(n) && n >= 1 && n <= 10)) inputs.bands = saved.bands;
}
function remember() {
  const values = {tab};
  for (const keys of Object.values(fields)) for (const key of keys) values[key] = inputs[key];
  InsuranceVisit.save('estimate', values);
}
function state() {
  const crop=model.cropResult(inputs), facility=model.facilityResult(inputs);
  return {tab,inputs:{...inputs,bands:[...inputs.bands]}, crop,facility,result:tab==='crop'?crop:facility};
}
function redraw() {if(typeof window.drawEstimate==='function')window.drawEstimate();}
function selectTab(next) {
  if(!Object.prototype.hasOwnProperty.call(fields,next)||next===tab)return;
  tab=next; remember(); redraw();
}
const dialog=()=>document.getElementById('editor');
function restore() {
  const originals=model.initialInputs(), next={...inputs};
  for(const key of fields[tab])next[key]=originals[key];
  if(dialog()?.open){drawForm(next,'이 탭의 예시 값을 채웠어요. 다시 계산하기를 누르면 반영돼요.');}
  else {inputs=next;remember();redraw();}
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const label=(key,name,control,hint='')=>
  `<div class="est-field"><label for="estimate-${key}">${name}</label>${control}${hint?`<small id="hint-${key}">${hint}</small>`:''}</div>`;
function numeric(key,name,value,unit,hint='',step='1') {
  const describe=hint?`aria-describedby="hint-${key}"`:'';
  return label(key,name,`<div class="est-number"><input type="number" step="${step}" ${describe} inputmode="${step==='1'?'numeric':'decimal'}" name="${key}" id="estimate-${key}" value="${escape(value)}"><span aria-hidden="true">${unit}</span></div>`,hint);
}
function select(key,name,value,options,hint=''){
  const choices=options.map(([val,caption])=>`<option value="${escape(val)}"${String(val)===String(value??'')?' selected':''}>${escape(caption)}</option>`).join('');
  return label(key,name,`<select name="${key}" id="estimate-${key}"${hint?` aria-describedby="hint-${key}"`:''}>${choices}</select>`,hint);
}
const bands=Array.from({length:10},(_,i)=>[i+1,`${i*10+1}~${(i+1)*10}%`]);
const nextBand=low=>[['','한 구간만'],...bands.filter(([i])=>Number(low)>0 && i===Number(low)+1)];
function accidentField(p){
  return label('accidentDate','사고일',`<input type="date" id="estimate-accidentDate" name="accidentDate" value="${escape(p.accidentDate)}">`);
}
function cropForm(p) {
  const percent=p.damagedArea===null?'':Number((p.damagedArea/p.area*100).toFixed(4));
  return accidentField(p)+
    `<label class="est-check"><input type="checkbox" name="includeAlert"${p.includeAlert?' checked':''}><span>사고 시각을 몰라 같은 재해의 특보일도 확인</span></label>`+
    label('damagedShare','피해 면적 비율',`<div class="est-number"><input type="number" step="any" inputmode="decimal" min="0" max="100" id="estimate-damagedShare" name="damagedShare" value="${percent}" data-initial="${percent}" data-area="${p.damagedArea??''}" aria-describedby="hint-damagedShare"><span aria-hidden="true">%</span></div>`,`가상 재배면적 ${p.area}㎡를 기준으로 입력해 주세요.`)+
    select('bandLow','손해정도',p.bands[0],[['','선택하기'],...bands])+
    select('bandHigh','추가할 손해정도',p.bands[1],nextBand(p.bands[0]),'정도가 불확실할 때는 바로 다음 구간도 포함할 수 있어요.')+
    numeric('priorPaid','이번 작기에 이미 받은 작물 보험금',p.priorPaid,'원','빈칸은 0원으로 계산해요.');
}
function facilityForm(p){
  return accidentField(p)+numeric('estimatedLow','받은 수리 견적',p.estimatedLow,'원')+
    numeric('estimatedHigh','다른 곳 견적 (선택)',p.estimatedHigh,'원','견적이 하나면 비워 두세요.')+
    select('rider','재조달가액 특약',p.rider,[['yes','가입'],['no','미가입'],['unknown','모름']])+
    select('repair','수리 예정',p.repair,[['yes','수리 예정'],['no','수리하지 않음'],['unknown','아직 모름']])+
    select('coverOnly','하우스 피해 종류',p.coverOnly,[['yes','비닐만 손상'],['no','골조도 손상'],['unknown','아직 모름']]);
}
function drawForm(p,progress='') {
  const d=dialog();
  d.classList.add('est-editor');
  d.setAttribute('aria-labelledby','estimate-editor-title');
  d.innerHTML=`<form id="estimate-editor-form" novalidate>
    <header class="est-editor-heading"><div><p class="est-editor-context">가상 토마토 3동 · ${tab==='crop'?'작물':'시설물'}</p><h2 id="estimate-editor-title">계산 조건 바꾸기</h2></div><button class="est-close" type="button" data-est-close aria-label="닫기">닫기</button></header>
    <div class="est-fields">${tab==='crop'?cropForm(p):facilityForm(p)}
      <button type="button" class="est-restore" data-est-restore>예시 값 복원</button><p class="est-error" role="alert" hidden></p>
      <p class="est-feedback" role="status"${progress?'':' hidden'}>${escape(progress)}</p>
    </div>
    <footer class="est-actions"><button type="button" class="est-secondary" data-est-close>취소</button><button type="submit" class="est-primary">다시 계산하기</button></footer>
    </form>`;
  const form=d.querySelector('form');
  form.addEventListener('submit',e=>{e.preventDefault();apply()});
  const low=form.elements.bandLow;
  if(low)low.addEventListener('change',()=>{
    const high=form.elements.bandHigh, old=high.value;
    high.replaceChildren(...nextBand(low.value).map(([value,text])=>new Option(text,value)));
    if([...high.options].some(o=>o.value===old))high.value=old;
  });
  d.querySelectorAll('[data-est-close]').forEach(b=>b.addEventListener('click',()=>d.close()));
  d.querySelector('[data-est-restore]').addEventListener('click',()=>{restore();d.querySelector('[data-est-restore]').focus();});
}
function readForm(form) {
  const num=key=>{
    const el=form.elements[key];
    return el.value.trim()===''?null:el.valueAsNumber;
  };
  if(tab==='crop') {
    const low=form.elements.bandLow.value,high=form.elements.bandHigh.value;
    const field=form.elements.damagedShare, share=num('damagedShare');
    const damagedArea=share===null?null:share===Number(field.dataset.initial)?Number(field.dataset.area):inputs.area*share/100;
    return {...inputs,accidentDate:form.elements.accidentDate.value,damagedArea,bands:[low,high].filter(Boolean).map(Number),includeAlert:form.elements.includeAlert.checked,priorPaid:num('priorPaid')};
  }
  return {...inputs,accidentDate:form.elements.accidentDate.value,estimatedLow:num('estimatedLow'), estimatedHigh:num('estimatedHigh'),
    rider:form.elements.rider.value,repair:form.elements.repair.value,coverOnly:form.elements.coverOnly.value};
}
function signalError(form,reason,field){
  const error=form.querySelector('.est-error');
  error.hidden=false;error.textContent=reason;
  if(field){field.setAttribute('aria-invalid','true');field.focus();}
}
function apply(){
  const d=dialog(),form=d?.querySelector('form');
  if(!form || !d.open)return false;
  for(const el of form.elements){el.removeAttribute('aria-invalid');}
  const bad=[...form.querySelectorAll('input[type=number]')].find(i=>i.validity.badInput);
  if(bad){signalError(form,'숫자로 입력해 주세요.',bad);return false;}
  const next=readForm(form);
  const result=tab==='crop'?model.cropResult(next):model.facilityResult(next);
  if(result.status==='invalid'){signalError(form,result.field==='damagedArea'?'피해 면적 비율은 0보다 크고 100% 이하여야 해요.':result.reason,form.elements[result.field==='damagedArea'?'damagedShare':result.field]);return false;}
  inputs=next;remember();d.close();redraw();return true;
}
function edit(){
  const d=dialog();if(!d||d.open)return;
  opener=document.activeElement;
  const focusId=opener?.id, focusAction=opener?.dataset?.action;
  drawForm(inputs);
  d.addEventListener('close',()=>{
    const target=opener?.isConnected?opener:focusId?document.getElementById(focusId):focusAction?document.querySelector(`[data-action="${CSS.escape(focusAction)}"]`):null;
    target?.focus({preventScroll:true});opener=null;
  },{once:true});
  d.showModal();
  d.querySelector('input, select')?.focus({preventScroll:true});
}
window.InsuranceEstimate=Object.freeze({state,selectTab,edit,apply,restore});
})();
