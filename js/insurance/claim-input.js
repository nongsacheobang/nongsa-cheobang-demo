import { demoAlertItems } from '../weather/alert-check.js';

// 계산 화면의 초기 값은 선택한 피해 기록과 보험 정보에서만 가져온다.
// 피해 범위, 손해정도, 견적은 사용자가 직접 입력하므로 채우지 않는다.
export function claimInput(profile, records, accidentId, houseId) {
  const accident = (records || []).find(r => r.id === accidentId && r.type === 'disaster');
  if (!accident || !accident.demo || !profile?.demo) return null;
  const ids = Array.isArray(accident.houseIds) ? accident.houseIds : [];
  const selected = houseId || (ids.length === 1 ? ids[0] : '');
  const house = ids.includes(selected) ? (profile.houses || []).find(h => h.id === selected) : null;
  if (!house) return { accidentId, choices: ids, houseId: '', damageMin: '', damageMax: '', damageBands: [], estimates: [] };
  const policy = (profile.insurance?.houses || []).find(h => h.house_id === selected) || {};
  const own = (records || []).filter(r => r.type !== 'disaster' && (r.houseIds || []).includes(selected) && typeof r.workDate === 'string' && r.workDate <= accident.accident_date);
  const dates = task => own.filter(r => r.task === task).map(r => r.workDate).sort();
  const planting = dates('정식').at(-1) || '';
  const harvestStart = planting ? dates('수확 개시').find(date => date >= planting) || '' : '';
  const harvestEnd = harvestStart ? dates('수확 종료').find(date => date >= harvestStart) || '' : '';
  const stamp = Date.parse((accident.accident_date || '') + 'T00:00:00Z');
  const shift = n => new Date(stamp + n * 86400000).toISOString().slice(0,10);
  const alerts = Number.isFinite(stamp) ? demoAlertItems(accident, profile, shift(-1), shift(1)) : null;
  const cause = String(accident.cause_text || '') + ' ' + (Array.isArray(accident.peril) ? accident.peril.join(' ') : (accident.peril || ''));
  const alertDates = (alerts || []).filter(item => { const kind = item.kind.replace(/주의보$|경보$/, ''); return kind && cause.includes(kind); }).map(item => item.date);
  const facilityItems = Array.isArray(accident.facility_damage) ? accident.facility_damage : String(accident.facility_damage || '').split(',').map(x => x.trim()).filter(Boolean);
  const coverOnly = facilityItems.length === 1 && facilityItems[0] === '비닐 찢어짐' ? 'yes' : facilityItems.length && facilityItems.every(x => ['비닐 찢어짐', '골조 휨과 파손', '보온커튼과 난방기 등 설비'].includes(x)) && facilityItems.some(x => x !== '비닐 찢어짐') ? 'no' : '';
  return {
    accidentId, choices: ids, houseId: selected, crop: house.crop || '', area: house.area_m2 ?? '', plants: house.plant_count ?? '',
    insuredArea: policy.insured_area_m2 ?? '', insuredAmount: policy.crop_sum_insured_krw ?? '', basisCrop: policy.crop_basis || '',
    otherHouseSameDay: ids.some(id => id !== selected) || (records || []).some(r => r.id !== accidentId && r.demo && r.type === 'disaster' && r.accident_date === accident.accident_date && (r.houseIds || []).some(id => id !== selected) && (Array.isArray(r.facility_damage) ? r.facility_damage.some(x => x && x !== '시설 피해 없음') : !!r.facility_damage && r.facility_damage !== '시설 피해 없음')),
    fireReported: Array.isArray(accident.peril) && accident.peril.includes('화재'), fireRider: profile.insurance?.fire_rider ?? null,
    coverOnly, facilityDamage: Array.isArray(accident.facility_damage) ? accident.facility_damage.join(', ') : String(accident.facility_damage || ''),
    facilityAmount: policy.facility_sum_insured_krw ?? '', replacement: profile.insurance?.replacement_rider ?? null,
    coverageRatio: profile.insurance?.crop_coverage_ratio ?? null, planting, harvestStart,
    harvestEnd: harvestEnd || policy.harvest_end_plan || '', harvestEndActual: !!harvestEnd, accidentDate: accident.accident_date || '',
    alerts: alerts || [], alertDates, damageMin: '', damageMax: '', damageBands: [], estimates: [], repair: ''
  };
}
