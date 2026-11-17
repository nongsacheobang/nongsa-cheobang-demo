// 가상 데이터 기본. 실제 호출 및 지역 코드 매핑은 아직 연결하지 않는다.
// 기상청 특보코드 응답의 areaCode, warnVar, warnStress, command, startTime을 사용한다.
// 참조: https://www.data.go.kr/data/15000415/openapi.do

const KINDS = Object.freeze({1:'강풍',2:'호우',3:'한파',4:'건조',5:'폭풍해일',6:'풍랑',7:'태풍',8:'대설',9:'황사',12:'폭염'});
function dateOnly(v) {
  const s = String(v ?? '');
  if (!/^\d{8}(?:\d{4})?$/.test(s)) return null;
  const y=Number(s.slice(0,4)), m=Number(s.slice(4,6)), d=Number(s.slice(6,8));
  const t=new Date(Date.UTC(y,m-1,d));
  if (t.getUTCFullYear()!==y || t.getUTCMonth()!==m-1 || t.getUTCDate()!==d) return null;
  if (s.length===12 && (Number(s.slice(8,10))>23 || Number(s.slice(10,12))>59)) return null;
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}
function validDate(s) { return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dateOnly(s.replaceAll('-',''))===s; }
// 전체 페이지와 정확한 구역 코드가 확인되지 않으면 null. 빈 배열은 확인된 조회 범위에 결과가 없을 때만.
export function convertAlerts(payload, { areaCode, from, to } = {}) {
  if (!areaCode || !validDate(from) || !validDate(to) || from>to) return null;
  const response=payload?.response, body=response?.body;
  if (String(response?.header?.resultCode)!=='00' || !body || body.totalCount == null || String(body.totalCount).trim()==='' || !Number.isInteger(Number(body.totalCount)) || Number(body.totalCount)<0) return null;
  const total=Number(body.totalCount), raw=body.items?.item;
  const items=raw == null && total===0 ? [] : Array.isArray(raw) ? raw : raw && typeof raw==='object' ? [raw] : null;
  if (!items || items.length!==total || Number(body.pageNo)!==1) return null;
  const result=[];
  for (const item of items) {
    if (!item || typeof item.areaCode!=='string' || !item.areaCode) return null;
    if (item.areaCode!==areaCode) continue;
    if (String(item.cancel ?? '0')!=='0') return null;
    // 해제, 변경, 정정은 기간 재구성이 필요하므로 아직 단정하지 않는다.
    if (String(item.command)!=='1') return null;
    const date=dateOnly(item.startTime), name=KINDS[String(item.warnVar)], level=String(item.warnStress);
    if (!date || !name || !['0','1'].includes(level)) return null;
    // 이전에 시작한 특보는 해제 시각을 재구성할 수 없으므로 빈 결과로 보지 않는다.
    if (date<from) return null;
    if (date<=to) result.push({date,kind:name+(level==='0'?'주의보':'경보')});
  }
  return [...new Map(result.map(a=>[`${a.date}|${a.kind}`,a])).values()].sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind));
}
export async function getAlerts({ sigungu, from, to } = {}) {
  if (!validDate(from) || !validDate(to) || from>to) return null;
  try {
    const res=await fetch(new URL('./alerts.fixture.json',import.meta.url));
    if (!res.ok) return null;
    const fixture=await res.json(), area=fixture?.area;
    if (!area || sigungu!==area.sigungu || !validDate(area.from) || !validDate(area.to) || from<area.from || to>area.to) return null;
    return convertAlerts({response:fixture.response},{areaCode:area.areaCode,from,to});
  } catch { return null; }
}
