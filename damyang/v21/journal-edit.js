/* Editing is scoped to an existing, personally authored diary entry. */
window.FarmJournalEdit = (() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields = {memo:'관찰 메모',date:'기록 날짜',entryType:'기록 종류',quantity:'수량',unit:'단위',cause:'원인',fire:'화재 특약',discoveredAt:'처음 발견한 때',accidentAt:'실제 사고 시각',receiptAt:'직접 알린 일시',office:'접수처'};
  const typeNames={work:'일반 작업',damage:'피해 기록',pest:'병·벌레 기록'};
  const typeOf=r=>typeNames[r.entryType]?r.entryType:r.cause==='병해충'?'pest':r.kind==='damage'?'damage':'work';
  const showValue=(key,v)=>key==='entryType'?(typeNames[v]||'미입력'):v==='병해충'?'병·벌레 기록':v||'미입력';
  const stamp=iso=> iso ? new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : '';
  const visible = (key,value)=>'<dt>'+fields[key]+'</dt><dd class="ff-memo">'+esc(showValue(key,value))+'</dd>';
  function snapshot(r){
    return Object.fromEntries(Object.keys(fields).map(key=>[key,key==='entryType'?typeOf(r):String(r[key]??'')]));
  }
  function apply(r,changes,at) {
    const previous=snapshot(r), next={...r,...changes};
    const current=snapshot(next);
    const changed=Object.keys(previous).filter(key=>previous[key]!==current[key]);
    if(!changed.length)return r;
    const history=Array.isArray(r.editHistory)?r.editHistory:[];
    const items=changed.map(key=>({key,from:previous[key],to:current[key]}));
    return {...next,updatedAt:at,original:r.original||previous,editHistory:[...history,{at,items}]};
  }
  function history(r){
    if(!r.editHistory?.length)return '';
    const before=r.original||{};
    const original=Object.keys(fields).filter(k=>before[k]).map(k=>visible(k,before[k])).join('');
    return '<details class="ff-fold"><summary>최초 원문과 수정 이력 ('+r.editHistory.length+'회)</summary>'+
      '<div class="ff-block"><h2>처음 저장한 기록</h2><p class="ff-note">'+esc(stamp(r.created))+'</p><dl>'+original+'</dl>'+
      r.editHistory.map(item=>'<h3>'+esc(stamp(item.at))+' 수정</h3><dl>'+item.items.filter(x=>fields[x.key]).map(x=>'<dt>'+fields[x.key]+'</dt><dd class="ff-memo">수정 전 · '+esc(showValue(x.key,x.from))+'<br>수정 후 · '+esc(showValue(x.key,x.to))+'</dd>').join('')+'</dl>').join('')+'</div></details>';
  }
  const opts=(data,current)=>Object.entries(data).map(([v,label])=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(label)+'</option>').join('');
  const input=(key,type,value,attrs='')=>'<label for="je-'+key+'">'+fields[key]+'</label><input id="je-'+key+'" name="'+key+'" type="'+type+'" value="'+esc(value)+'" '+attrs+'>';
  function editor(r,working){
    const d=working||snapshot(r);
    const optsCause={'':'미선택',...Object.fromEntries(['강풍/태풍','눈(대설)','우박','비(호우)','추위(한파/서리)','더위(폭염)','새/짐승','화재','그 밖'].map(label=>[label,label]))};
    if(d.cause && d.cause!=='병해충')optsCause[d.cause]=d.cause;
    return '<form id="je-form" class="ff-block"><label for="je-memo">관찰 메모</label><textarea id="je-memo" name="memo" maxlength="2000" rows="3">'+esc(d.memo)+'</textarea>'+
      input('date','date',d.date,'required')+'<label for="je-type">기록 종류</label><select id="je-type" name="entryType">'+opts(typeNames,d.entryType)+'</select>'+
      input('quantity','number',d.quantity,'min="0" step="any"')+input('unit','text',d.unit,'maxlength="20"')+
      '<div data-je-damage><label for="je-cause">원인</label><select id="je-cause" name="cause">'+opts(optsCause,d.cause)+'</select>'+
      '<div data-je-fire><label for="je-fire">화재 특약</label><select id="je-fire" name="fire">'+opts({'':'선택해 주세요','가입':'가입','미가입':'미가입','모름':'모름'},d.fire)+'</select></div>'+
      input('discoveredAt','datetime-local',d.discoveredAt)+input('accidentAt','datetime-local',d.accidentAt)+'</div>'+
      '<p class="ff-note">기존 사진과 동·작기는 그대로 연결돼요.</p><p id="je-error" role="alert" class="ff-error" hidden></p>'+
      '<div class="ff-actions"><button class="ff-btn ff-primary" type="submit">수정 저장</button><button type="button" class="ff-btn ff-secondary" data-je-cancel>취소</button></div></form>';
  }
  function confirm(r){
    return '<form id="je-delete" class="ff-block"><h2>선택한 기록 한 건을 삭제할까요?</h2><p>'+esc(r.date)+' · '+esc(r.time)+'</p><p class="ff-memo">'+esc(r.memo||'사진 기록')+'</p>'+
      '<p class="ff-note">이 기록에 첨부한 사진과 수정 이력도 함께 지워져요.</p><p id="je-error" role="alert" class="ff-error" hidden></p>'+
      '<div class="ff-actions"><button type="button" class="ff-btn ff-secondary" data-je-cancel>취소</button><button type="submit" class="ff-btn ff-primary">이 기록 삭제</button></div></form>';
  }
  function bind(form,r,{save,discard,finish,remember}){
    const deleting=form.id==='je-delete', elements=form.elements;
    const fail=msg=>{const out=form.querySelector('[role="alert"]');out.textContent=msg;out.hidden=false};
    function inputFields(){return Object.fromEntries(new FormData(form));}
    function draw(){
      const damage=elements.entryType.value==='damage',fire=damage&&elements.cause.value==='화재';
      form.querySelector('[data-je-damage]').hidden=!damage;
      form.querySelector('[data-je-fire]').hidden=!fire;
      elements.fire.required=fire;
    }
    if(!deleting){draw();form.addEventListener('input',()=>{draw();remember(inputFields())});}
    form.querySelector('[data-je-cancel]').onclick=()=>{if(!deleting)discard();finish(false);};
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(form.dataset.pending)return;
      let update;
      if(!deleting){
        update=inputFields();
        if(!update.memo.trim()&&!r.photo){fail('메모 또는 기존 사진 한 장이 필요해요.');elements.memo.focus();return;}
        const damage=update.entryType==='damage',pest=update.entryType==='pest';
        Object.assign(update,{kind:damage?'damage':'journal',cause:pest?'병해충':damage?update.cause:'',fire:damage&&update.cause==='화재'?update.fire:'',
          accidentAt:damage?update.accidentAt:'',discoveredAt:damage?update.discoveredAt:''});
        if(!damage&&!pest)Object.assign(update,{receiptAt:'',office:''});
      }
      form.dataset.pending='1';
      const actions=Array.from(form.querySelectorAll('button'));
      actions.forEach(button=>button.disabled=true);
      try {await save(update);discard();if(form.isConnected)finish(deleting);}
      catch(e){fail(e.message||'처리하지 못했어요. 다시 시도해 주세요.');delete form.dataset.pending;actions.forEach(button=>button.disabled=false);}
    });
  }
  return {typeOf,typeNames,stamp,apply,history,editor,confirm,bind};
})();
