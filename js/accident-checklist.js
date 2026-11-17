import { demoAlertItems } from './weather/alert-check.js';

// 자동 체크는 기록에 실제 값이 있을 때만 한다. 수동 확인은 농민이 누른 값이다.
export function accidentChecklist(record, profile) {
  const raw=record?.accident_date||'', t=/^\d{4}-\d{2}-\d{2}$/.test(raw)?Date.parse(raw+'T00:00:00Z'):NaN;
  const valid=Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===raw;
  const day=n=>new Date(t+n*86400000).toISOString().slice(0,10);
  const demoAlerts=valid?demoAlertItems(record,profile,day(-1),day(1)):null;
  const checked=record?.checklist||{};
  const items={photo:!!checked.photo||Number(record?.photo_count)>0,reported:!!checked.reported||!!record?.reported_at,damage:!!checked.damage||!!record?.houseIds?.length&&!!record?.crop_symptom,alerts:!!checked.alerts||demoAlerts!==null,receipt:!!checked.receipt||Number(record?.receipt_photo_count)>0,mitigation:!!checked.mitigation||!!record?.mitigation_note};
  return {items,demoAlerts,remaining:Object.values(items).filter(x=>!x).length};
}
