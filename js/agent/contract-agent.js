// 계약 v1 실험용 어댑터. 화면 연결, 영속 사용량, 독립 검증 전이다.
import {toContractDraft} from './contract-draft.js';
import {makeEnvelope} from './contract-envelope.js';
const mapField = k => k==='houseIds'?'plots':k==='workDate'?'work_date':k;
export function createContractAgent({agent,profile,recordId,nextId,usage}) {
  if (!agent || !profile || !recordId || typeof nextId !== 'function' || !usage) throw new TypeError('adapters required');
  let conversationId=null, source=[], answers=[], latestAsk=null, closedByError=false;
  const envelope=(type,say,payload=null,draft=null,sourceDraft=agent.state.draft)=>makeEnvelope({conversation_id:conversationId,turn_id:nextId(),type,say,payload,draft,warnings:sourceDraft?.warnings || [],extract_method:sourceDraft?.method==='AI'?'ai':sourceDraft?'rule':null,usage});
  function draftForContract(snapshot = agent.state) {
    const st=snapshot;
    if(!st.draft)return null;
    return toContractDraft({draft:st.draft,profile,recordId,draftId:nextId(),asked:st.asked,missing:st.askKey?[st.askKey]:[],answers:[...answers],sourceText:source.join('\n')});
  }
  async function processTurn(req) {
    if (closedByError) throw new Error('conversation closed after processing error');
    if (!req || typeof req.conversation_id!=='string' || !req.conversation_id || !req.input || !['text','button'].includes(req.input.kind)) throw new TypeError('invalid request');
    if(conversationId && conversationId!==req.conversation_id) throw new TypeError('new agent required for new conversation');
    conversationId=req.conversation_id;
    const input=req.input;
    let raw;
    if(input.kind==='text'){
      if(typeof input.text!=='string'||!input.text.trim()||input.text.trim().startsWith('__')) throw new TypeError('invalid text');
      raw=input.text.trim().slice(0,500);source.push(raw);
    } else {
      if(!latestAsk || input.ask_id!==latestAsk.ask_id) throw new TypeError('stale or missing ask');
      if(input.value===null && !latestAsk.allow_skip) throw new TypeError('skip not allowed');
      if(input.value!==null && typeof input.value!=='string') throw new TypeError('invalid button value');
      if(input.value!==null && !latestAsk.options.some(o=>o.value===input.value)) throw new TypeError('unoffered value');
      raw=input.value===null?'__skip':input.value;
      if(raw!=='__skip' && raw.startsWith('__')) throw new TypeError('reserved button value');
      answers.push({field:latestAsk.field,label:input.value===null?'모르겠어요':latestAsk.options.find(o=>o.value===input.value).label,value:input.value});
    }
    // Only answer or text paths are allowed; no save operation is exposed.
    latestAsk=null;
    const previous = {draft:agent.state.draft ? JSON.parse(JSON.stringify(agent.state.draft)) : null, asked:{...agent.state.asked}, askKey:agent.state.askKey};
    let result;
    try { result=await agent.send(raw); }
    catch (error) {
      // 부분 변경된 내부 상태를 재사용하지 않는다. 이전 초안과 입력만 직접 입력 화면으로 넘긴다.
      closedByError=true;
      return envelope('fallback','처리하지 못했어요. 직접 입력으로 이어 주세요.',{reason:'error',screen:'S-07'},draftForContract(previous),previous.draft);
    }
    const st=agent.state;
    const last=[...st.messages].reverse().find(m=>m.role==='agent') || {text:''};
    if(result?.action==='handoff') return envelope('fallback',last.text,{reason:'not_understood',screen:'S-07'},draftForContract(previous),previous.draft);
    if(result?.action==='go') {
      const action=result.to==='excel'?{name:'open_export',period_start:result.period_start||null,period_end:result.period_end||null}:{name:'open_screen',screen:result.to};
      return envelope('action',last.text,action);
    }
    if(st.phase==='locked')return envelope('limit',last.text,{code:'ERR-LIM-02'});
    if(last.kind==='refuse')return envelope('refuse',last.text,{reason:'out_of_scope'});
    if(st.phase==='ask'){
      const options=(last.quick || []).filter(o=>o.v!=='__skip').map(o=>({label:o.l,value:o.v}));
      latestAsk={ask_id:nextId(),field:mapField(st.askKey),input:'choice',options,allow_text:true,allow_skip:true,attempt:st.asked[st.askKey]||1,max_attempt:2};
      return envelope('ask',last.text,latestAsk,draftForContract());
    }
    if(st.phase==='confirm' && st.draft)return envelope('draft',last.text,null,draftForContract());
    if(!st.draft && st.fails===1){
      latestAsk={ask_id:nextId(),field:'utterance',input:'text',options:[],allow_text:true,allow_skip:false,attempt:1,max_attempt:2};
      return envelope('ask',last.text,latestAsk,null);
    }
    return envelope('fallback',last.text || '다시 입력해 주세요.',{reason:'not_understood',screen:'S-07'},draftForContract());
  }
  let busy=false;
  async function send(req) {
    if (busy) throw new Error('turn already in progress');
    busy=true;
    try { return await processTurn(req); } finally { busy=false; }
  }
  return {send};
}