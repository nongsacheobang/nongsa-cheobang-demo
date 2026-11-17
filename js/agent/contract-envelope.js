// 계약 v1 응답 봉투 생성기. 상태 머신 및 화면에 연결하기 전 검증용.
const TYPES = ['ask','draft','action','refuse','fallback','limit'];
const payloadTypes = ['ask','action','refuse','fallback','limit'];
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function makeEnvelope({conversation_id,turn_id,type,say,payload=null,draft=null,warnings=[],extract_method=null,model_id=null,llm_called=false,rule_reason=null,usage,notices=[]}) {
  if (typeof conversation_id !== 'string' || !conversation_id || typeof turn_id !== 'string' || !turn_id || !TYPES.includes(type) || typeof say !== 'string') throw new TypeError('invalid envelope identity, type or say');
  if (!isObject(usage) || !Number.isInteger(usage.used) || !Number.isInteger(usage.limit) || !Number.isInteger(usage.remaining) || typeof usage.locked !== 'boolean' || !Number.isInteger(usage.refuse_streak) || typeof usage.resets_at !== 'string') throw new TypeError('invalid usage');
  if (!Array.isArray(warnings) || warnings.some(x=>typeof x!=='string') || !Array.isArray(notices)) throw new TypeError('invalid warnings or notices');
  if (!['ai','rule',null].includes(extract_method) || !['llm_timeout','llm_error','forced',null].includes(rule_reason) || typeof llm_called !== 'boolean') throw new TypeError('invalid extraction metadata');
  if (payloadTypes.includes(type) && !isObject(payload)) throw new TypeError('payload required');
  if (type === 'draft' && (!isObject(draft) || payload !== null)) throw new TypeError('draft required');
  if (!['ask','draft','fallback'].includes(type) && draft !== null) throw new TypeError('draft not allowed');
  if (draft !== null && (!isObject(draft) || !Array.isArray(draft.computed) || draft.computed.length)) throw new TypeError('invalid draft or computed');
  if (type==='ask' && (!['choice','multi_choice','number_unit','text'].includes(payload.input) || !payload.ask_id || !payload.field || !Array.isArray(payload.options))) throw new TypeError('invalid ask');
  if (type==='action' && !['open_export','open_screen'].includes(payload.name)) throw new TypeError('invalid action');
  const state = type==='ask'?'collecting':type==='draft'?'confirming':'closed';
  const out={conversation_id,turn_id,type,say,state,ask:null,action:null,refuse:null,fallback:null,limit:null,draft,warnings:[...warnings],extract_method,model_id,llm_called,rule_reason,usage:{...usage},notices:[...notices]};
  if (payloadTypes.includes(type)) out[type]={...payload};
  return out;
}