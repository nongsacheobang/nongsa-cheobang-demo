import { cropInsurance } from './insurance/crops.js';

// 보고서의 기간과 빈값을 보존한다. 작기 경계는 임시 기준이다.
export function buildReportData(profile, records, readiness, { period='season', today } = {}) {
  const date=today||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  const all=Array.isArray(records)?records:[];
  const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s};
  const shift=(s,days)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
  const fallback=shift(date,-180), profileHouses=profile?.houses||[];
  const periods=profileHouses.map(h=>{
    const own=all.filter(r=>r.type!=='disaster'&&(r.houseIds||[]).includes(h.id));
    const planting=own.filter(r=>r.task==='정식'&&validDate(r.workDate)&&r.workDate<=date).map(r=>r.workDate).sort().at(-1);
    const end=planting?(own.filter(r=>r.task==='수확 종료'&&validDate(r.workDate)&&r.workDate>=planting&&r.workDate<=date).map(r=>r.workDate).sort().at(-1)||date):date;
    return {id:h.id,name:h.name||'',start:planting?shift(planting,-30):fallback,end,basis:planting?'planting':'recent'};
  });
  const inPeriod=(r,p)=>{const day=r.accident_date||r.workDate||'';return validDate(day)&&day>=p.start&&day<=p.end};
  const chosen=period==='all'?all:all.filter(r=>{const ids=r.houseIds||[];return ids.length?periods.some(p=>ids.includes(p.id)&&inPeriod(r,p)):inPeriod(r,{start:fallback,end:date})});
  const work=chosen.filter(r=>r.type!=='disaster'),damage=chosen.filter(r=>r.type==='disaster');
  const houses=profileHouses.map(h=>{const interval=periods.find(p=>p.id===h.id);const own=work.filter(r=>(r.houseIds||[]).includes(h.id)&&(period==='all'||inPeriod(r,interval)));const dates=t=>own.filter(r=>r.task===t&&validDate(r.workDate)&&r.workDate<=date).map(r=>r.workDate).sort();const planted=dates('정식').at(-1)||'';const harvest=planted?(dates('수확 개시').find(d=>d>=planted)||''):'';const ended=harvest?(dates('수확 종료').find(d=>d>=harvest)||''):'';return {id:h.id,name:h.name||'',crop:h.crop||'',area:h.area_m2??'',plants:h.plant_count??'',planted,harvest,ended}});
  const start=periods.map(p=>p.start).sort()[0]||fallback,seasonBasis=periods.some(p=>p.basis==='planting')?'planting':'recent';
  const cropReferences=[...new Set(profileHouses.map(h=>h.crop).filter(Boolean))].map(crop=>{const c=cropInsurance(crop);if(!c.facility_crop)return null;return {crop, grow:`표준생장일수 ${c.standard_grow_days}일${c.winter_grow_days ? `, 월동 작형 ${c.winter_grow_days}일` : ''}`, harvest:c.standard_harvest_days ? `표준수확일수 ${c.standard_harvest_days}일` : '표준수확일수는 실제 수확 개시일부터 종료일까지', prep:'준비기생산비계수 40%'} }).filter(Boolean);
  const counts={};for(const r of work){const stage=r.stage||'미입력';counts[stage]=(counts[stage]||0)+1}
  return {period,date,start,seasonBasis,periods,work,damage,houses,counts,cropReferences,factors:readiness?.factors||[],missing:(readiness?.factors||[]).filter(f=>['unmet','unknown'].includes(f.state)&&f.todo)};
}
