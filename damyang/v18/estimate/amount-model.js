/* 11/20 로컬 시연 후보의 claim-calc.js 사본. 외부 서비스 연결 없음. */
(() => {
'use strict';
// 시연용 시설물 산식. 견적과 계약 값은 사용자가 제공한 값만 사용한다.
// 이 함수는 피해 판단이나 보상 여부 판정을 하지 않는다.
function facilityRange({ estimates, insuredAmount, coverOnly, fireCovered, repair, otherEstimates = 0 }) {
  if (repair === 'no') return { state: 'unavailable', reason: '수리하지 않으면 감가상각된 금액(시가)으로 계산돼요. 감가율은 공개되지 않아 이 범위를 낼 수 없어요' };
  if (!['yes', 'unknown'].includes(repair) || !Array.isArray(estimates) || estimates.length < 1 || estimates.length > 2 || estimates.some(n => !Number.isFinite(n) || n <= 0) || (insuredAmount !== null && (!Number.isFinite(insuredAmount) || insuredAmount <= 0)) || typeof coverOnly !== 'boolean' || typeof fireCovered !== 'boolean' || !Number.isFinite(otherEstimates) || otherEstimates < 0) return { state: 'unknown' };
  const amounts = estimates.map(estimate => {
    const total = estimate + otherEstimates;
    const totalDeductible = fireCovered ? 0 : Math.min(coverOnly ? 300000 : 1000000, Math.max(coverOnly ? 100000 : 300000, total * 0.1));
    const deductible = totalDeductible * estimate / total;
    return { estimate, deductible, amount: Math.min(insuredAmount ?? Infinity, Math.max(0, estimate - deductible)) };
  });
  const values = amounts.map(x => x.amount);
  return { state: 'ready', min: Math.floor(Math.min(...values) / 10000) * 10000, max: Math.ceil(Math.max(...values) / 10000) * 10000, capUnknown: insuredAmount === null, amounts };
}

// 작물 산식은 입력된 손해정도와 계산된 경과비율 후보를 그대로 사용한다.
// 조건이 불명확하면 금액을 만들지 않는다.
function cropRange({ crop, basisCrop, area, insuredArea, insuredAmount, coverageRatio, damagedMin, damagedMax, damageBands, progress, priorPaid = 0, damageTotal = area }) {
  const canonical = value => value === '방울토마토' ? '토마토' : value;
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (!['딸기', '토마토'].includes(canonical(crop))) return { state: 'unsupported' };
  if (!basisCrop || canonical(basisCrop) !== canonical(crop)) return { state: 'unknown_basis' };
  if (!positive(area) || !positive(insuredArea) || !positive(insuredAmount) || !positive(damageTotal) || !positive(damagedMin) || !positive(damagedMax) || damagedMin > damagedMax || damagedMax > damageTotal || !Number.isFinite(priorPaid) || priorPaid < 0 || priorPaid > insuredAmount) return { state: 'invalid' };
  if (coverageRatio != null && (!Number.isFinite(coverageRatio) || coverageRatio < 0.5 || coverageRatio > 1)) return { state: 'invalid' };
  if (!Array.isArray(damageBands) || damageBands.length < 1 || damageBands.length > 2 || damageBands.some(n => !Number.isInteger(n) || n < 1 || n > 10)) return { state: 'invalid' };
  const bands = [...new Set(damageBands)].sort((a,b) => a-b);
  if (bands.length !== damageBands.length || (bands.length === 2 && bands[1] !== bands[0] + 1)) return { state: 'invalid' };
  if (!Array.isArray(progress) || !progress.length || progress.some(n => !Number.isFinite(n) || n < 0 || n > 1)) return { state: 'invalid' };
  const ratios = coverageRatio == null ? [1, 0.5] : [coverageRatio];
  const bases = ratios.map(r => insuredAmount * Math.min(1, area / insuredArea / r));
  const limit = insuredAmount - priorPaid;
  const low = Math.min(limit, Math.min(...bases) * Math.min(...progress) * damagedMin / damageTotal * bands[0] / 10);
  const high = Math.min(limit, Math.max(...bases) * Math.max(...progress) * damagedMax / damageTotal * bands.at(-1) / 10);
  return { state: 'ready', min: Math.floor(low / 10000) * 10000, max: Math.ceil(high / 10000) * 10000, underThresholdMin: low <= 100000, underThresholdMax: high <= 100000, bases, progress: [...progress], damageBands: bands };
}

// 날짜와 작형의 불확실성을 후보로 남긴다. 특보 후보는 호출 측에서 같은 재해 종류와 지역을 확인해야 한다.
function progressCandidates({ crop, planting, accident, alertDates = [], harvestStart = '', harvestEnds = [], harvestEndActual = false }) {
  const day = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const n = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === value ? n / 86400000 : null;
  };
  const cropName = crop === '방울토마토' ? '토마토' : crop;
  const p = day(planting), a = day(accident), h = harvestStart ? day(harvestStart) : null;
  if (!['토마토','딸기'].includes(cropName) || p === null || a === null || a < p || (harvestStart && (h === null || h < p)) || !Array.isArray(alertDates) || !Array.isArray(harvestEnds) || harvestEnds.some(x => day(x) === null || (h !== null && day(x) <= h))) return { state: 'invalid' };
  const dates = [accident, ...alertDates.filter(x => { const d = day(x); return d !== null && d >= p && d <= a && a - d <= 3; })];
  const month = Number(planting.slice(5,7));
  let growth = cropName === '딸기' ? [90] : [80];
  if (cropName === '토마토' && month >= 9 && month <= 11) {
    growth = harvestEnds.length ? [...new Set(harvestEnds.map(x => Number(x.slice(5,7)) >= 3 && Number(x.slice(0,4)) > Number(planting.slice(0,4)) ? 120 : 80))] : [80,120];
  }
  const candidates = [];
  for (const date of [...new Set(dates)]) for (const inclusive of [0,1]) for (const standard of growth) {
    const d = day(date), elapsed = d - p + inclusive;
    const assumed = h === null && d >= p + standard;
    const start = h === null ? p + standard : h;
    if (h === null || d < h) candidates.push({date, inclusive: !!inclusive, stage:'growth', standard, ratio:.4 + .6 * Math.min(1, elapsed / standard)});
    if ((h !== null && d >= h) || assumed) {
      const n = d - start + inclusive;
      const stage = assumed ? 'harvest_unknown' : 'harvest';
      if (cropName === '토마토') {
        if (!harvestEnds.length) return {state:'unknown_harvest_end'};
        const usable = harvestEnds.map(day).filter(end => end >= d && end > start);
        if (!usable.length) return {state:'invalid_harvest_end'};
        for (const end of usable) candidates.push({date,inclusive:!!inclusive,stage,standard,ratio:Math.max(0, 1 - n / (end - start + inclusive))});
      } else {
        const ratio = Math.max(0, 1 - n / 182);
        let values = [ratio];
        if (ratio < .1) {
          if (harvestEndActual && harvestEnds.length) values = harvestEnds.map(end => day(end) - start + inclusive >= 182 ? .1 : ratio);
          else if (d - start >= 182) values = [.1];
          else values = [ratio,.1];
        }
        for (const value of values) candidates.push({date,inclusive:!!inclusive,stage,standard,ratio:value});
      }
    }
  }
  return { state:'ready', candidates };
}

window.FarmClaimMath = Object.freeze({cropRange, facilityRange, progressCandidates});
})();
(function(){
'use strict';

const fixture = Object.freeze({
  house:'하우스 3동', crop:'토마토', area:660, insuredArea:660, cropSum:9900000,
  damagedArea:220, bands:Object.freeze([5,6]), plantDate:'2026-09-06',
  accidentDate:'2026-11-16', alertDate:'2026-11-15', includeAlert:true,
  harvestEnd:'2027-05-31', priorPaid:0, facilitySum:15000000, estimatedLow:1200000,
  estimatedHigh:1500000, rider:'yes', repair:'yes', coverOnly:'yes'
});
function initialInputs() {
  return {...fixture, bands:[...fixture.bands]};
}
function unavailable(status, reason, field='') {
  return {status, reason, field, min:null, max:null, displayRange:'', amounts:[],
    progressMin:null, progressMax:null, underThresholdMin:false, underThresholdMax:false};
}
function formatRange(r) {
  const wan=n=>(n/10000).toLocaleString('ko-KR');
  if (r.underThresholdMin && r.underThresholdMax) return '10만 원 이하';
  if (r.underThresholdMin) return `10만 원 이하~${wan(r.max)}만 원`;
  return r.min===r.max?`약 ${wan(r.min)}만 원`:`약 ${wan(r.min)}만~${wan(r.max)}만 원`;
}
function cropResult(p) {
  if(p.damagedArea!==null && (!Number.isFinite(p.damagedArea)||p.damagedArea<=0||p.damagedArea>p.area))
    return unavailable('invalid',`피해면적은 0보다 크고 재배면적 ${p.area}㎡ 이하여야 해요.`,'damagedArea');
  if(p.priorPaid!==null && (!Number.isSafeInteger(p.priorPaid)||p.priorPaid<0||p.priorPaid>p.cropSum))
    return unavailable('invalid','이미 받은 금액은 0원부터 작물 가입금액까지 입력해 주세요.','priorPaid');
  if(p.damagedArea===null) return unavailable('missing','피해면적을 입력하면 작물 범위를 계산할 수 있어요.','damagedArea');
  if(!p.bands?.length) return unavailable('missing','손해정도 구간을 선택하면 작물 범위를 계산할 수 있어요.','bandLow');
  const progress=window.FarmClaimMath.progressCandidates({
    crop:p.crop, planting:p.plantDate, accident:p.accidentDate,
    alertDates:p.includeAlert?[p.alertDate]:[], harvestEnds:[p.harvestEnd]
  });
  if(progress.state!=='ready')return unavailable('missing','정식일과 사고일, 수확 종료 예정일을 확인해 주세요.');
  const ratios=progress.candidates.map(x=>x.ratio);
  const r=window.FarmClaimMath.cropRange({
    crop:p.crop, basisCrop:p.crop, area:p.area, insuredArea:p.insuredArea, insuredAmount:p.cropSum,
    coverageRatio:null, damagedMin:p.damagedArea, damagedMax:p.damagedArea,
    damageBands:p.bands, progress:ratios, priorPaid:p.priorPaid??0
  });
  if(r.state!=='ready') return unavailable('invalid','손해정도는 한 구간 또는 바로 이웃한 두 구간을 선택해 주세요.','bandLow');
  return {...r,status:'ready', reason:'',progressMin:Math.min(...ratios),progressMax:Math.max(...ratios),
    displayRange:formatRange(r)};
}
function facilityResult(p) {
  for(const key of ['estimatedLow','estimatedHigh']) {
    const n=p[key];
    if(n!==null && (!Number.isSafeInteger(n)||n<=0)) return unavailable('invalid','견적은 0보다 큰 금액을 원 단위로 입력해 주세요.',key);
  }
  if(p.estimatedLow===null) return unavailable('missing','받은 수리 견적을 입력하면 시설물 범위를 계산할 수 있어요.','estimatedLow');
  if(p.rider!=='yes') return unavailable('missing',p.rider==='no'?'재조달가액 특약이 없어 시가 확인이 필요해요. 이 예시에는 감가율이 없어요.':'보험증권이나 가입한 농축협에서 재조달가액 특약 가입 여부를 확인해 주세요.','rider');
  if(p.repair!=='yes') return unavailable('missing',p.repair==='no'?'수리하지 않으면 시가 확인이 필요해요. 이 예시에는 감가율이 없어요.':'수리 예정 여부를 먼저 확인해 주세요.','repair');
  if(!['yes','no'].includes(p.coverOnly)) return unavailable('missing','비닐만 손상됐는지 골조도 손상됐는지 확인해 주세요.','coverOnly');
  const r=window.FarmClaimMath.facilityRange({
    estimates:[p.estimatedLow,p.estimatedHigh].filter(n=>n!==null), insuredAmount:p.facilitySum,
    coverOnly:p.coverOnly==='yes', fireCovered:false, repair:'yes',otherEstimates:0
  });
  if(r.state!=='ready')return unavailable('invalid','견적과 하우스 가입금액을 확인해 주세요.');
  return {...r,status:'ready',reason:'',displayRange:formatRange(r)};
}
window.InsuranceScenario=Object.freeze({initialInputs,cropResult,facilityResult});
})();
