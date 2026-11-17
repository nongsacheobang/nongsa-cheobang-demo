// 임시 계약 v1 초안 변환기. 실제 화면 연결 전 독립 검증이 필요하다.
// 계산, 저장은 하지 않고, 확인할 수 없는 값은 null로 남긴다.
const textOrNull = value => typeof value === 'string' && value.trim() ? value : null;
const numberOrNull = value => {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const materialPath = (key, mats) => {
  const match = /^m(\d+)\.(\w+)$/.exec(key);
  if (!match) return ({houseIds:'plots',workDate:'work_date'})[key] || key;
  const index = Number(match[1]);
  const field = match[2];
  const kind = mats[index]?.kind;
  const translated = field === 'type' ? (kind === '농약' ? 'pesticide_type' : kind === '비료' ? 'fertilizer_type' : 'seed_type') : ({name:'product_name',pest:'target_pest'})[field] || field;
  return `materials[${index}].${translated}`;
};
export function toContractDraft({draft,profile,recordId,draftId,asked={},missing=[],answers=[],sourceText}) {
  if (!draft || !recordId || !draftId) throw new TypeError('draft, recordId and draftId required');
  const houses = profile?.houses || [];
  const plots = (draft.houseIds || []).map(id=>houses.find(h=>h.id===id)?.name).filter(Boolean);
  const mats = draft.materials || [];
  const common = {type:draft.type==='disaster'?'disaster':'work',plots,crop:textOrNull(draft.crop),memo:textOrNull(draft.memo),weather:null};
  let record;
  if (common.type === 'disaster') {
    const raw = String(sourceText ?? (draft.sourceTexts || []).join('\n'));
    const peril = textOrNull(draft.peril);
    // 범주에 포함된 이름을 원문에서 추론해 다시 쓰지 않는다.
    // 쉼표로 구분된 복수 원인도 각각 원문 또는 명시적 버튼 답에 있어야 한다.
    const terms = peril ? peril.split(',').map(x=>x.trim()).filter(Boolean) : [];
    const inSource = term => {
      let at = raw.indexOf(term);
      while (at >= 0) {
        const after = raw.slice(at + term.length);
        if (!/^\s*(?:은|는|이|가)?\s*(?:아니|없|안\s*왔|오지\s*않)/.test(after)) return true;
        at = raw.indexOf(term, at + term.length);
      }
      return false;
    };
    const supported = terms.length > 0 && terms.every(term => inSource(term) || answers.some(a=>a.field==='peril' && a.value===term));
    record = {...common,accident_date:textOrNull(draft.accident_date),continuing:!!draft.continuing,peril:supported?peril:null,facility_damage:textOrNull(draft.facility_damage),crop_symptom:textOrNull(draft.crop_symptom)};
  } else {
    record = {...common,work_date:textOrNull(draft.workDate),stage:textOrNull(draft.stage),task:textOrNull(draft.task),variety:textOrNull(draft.variety),plant_count:numberOrNull(draft.plant_count),materials:mats.map(m=>({kind:textOrNull(m.kind),action:textOrNull(m.action),pesticide_type:m.kind==='농약'?textOrNull(m.type):null,fertilizer_type:m.kind==='비료'?textOrNull(m.type):null,seed_type:m.kind==='종묘(모종)'?textOrNull(m.type):null,product_name:textOrNull(m.name),qty:numberOrNull(m.qty),unit:textOrNull(m.unit),pack_count:null,pack_unit:null,dilution:numberOrNull(m.dilution),water_l:null,target_pest:textOrNull(m.pest)})),area_value:numberOrNull(draft.area?.value),area_unit:textOrNull(draft.area?.unit),detail:null};
  }
  const needs = (draft.guessed || []).map(k=>materialPath(k,mats));
  if (common.type==='disaster' && draft.peril && !record.peril && !needs.includes('peril')) needs.push('peril');
  const mappedMissing = missing.map(k=>materialPath(k,mats));
  // 임시: 필수 판정 누락으로 빈 초안이 complete가 되지 않도록 보수적으로 산출한다.
  const requireField = (path, missingValue) => { if (missingValue && !mappedMissing.includes(path)) mappedMissing.push(path); };
  requireField('plots', plots.length === 0);
  if (common.type === 'disaster') {
    requireField('accident_date', !record.accident_date);
    requireField('peril', !record.peril);
    requireField('facility_damage', !record.facility_damage);
    requireField('crop_symptom', !record.crop_symptom);
  } else {
    requireField('work_date', !record.work_date);
    requireField('crop', !record.crop);
    requireField('stage', !record.stage);
    record.materials.forEach((m,i)=>{
      const prefix = `materials[${i}]`;
      requireField(`${prefix}.kind`, !m.kind);
      requireField(`${prefix}.action`, !['구입','사용'].includes(m.action));
      const typeKey = m.kind === '농약' ? 'pesticide_type' : m.kind === '비료' ? 'fertilizer_type' : m.kind === '종묘(모종)' ? 'seed_type' : null;
      if (typeKey) requireField(`${prefix}.${typeKey}`, !m[typeKey]);
      requireField(`${prefix}.product_name`, !m.product_name);
      requireField(`${prefix}.qty`, m.qty === null);
      requireField(`${prefix}.unit`, !m.unit);
    });
  }
  if (common.type==='disaster' && !record.peril && !mappedMissing.includes('peril')) mappedMissing.push('peril');
  if ((draft.houseIds || []).length !== plots.length && !mappedMissing.includes('plots')) mappedMissing.push('plots');
  const askCount = Object.fromEntries(Object.entries(asked).map(([k,v])=>[materialPath(k,mats),v]));
  return {draft_id:draftId,record_id:recordId,record,source_text:String(sourceText ?? (draft.sourceTexts || []).join('\n')).slice(0,500),answers,needs_confirm:needs,missing:mappedMissing,ask_count:askCount,computed:[],status:mappedMissing.length?'incomplete':'complete'};
}