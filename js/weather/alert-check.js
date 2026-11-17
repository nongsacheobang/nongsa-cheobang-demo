// 가상 시연 결과는 해당 사고와 조회 범위에만 묶는다.
function validDay(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const time=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
export function demoAlertItems(record, profile, from, to) {
 const c=record?.alert_check;
 if(!validDay(from)||!validDay(to)||from>to||!record?.demo||!profile?.demo||!c||c.source!=='demo'||c.sigungu!=='가상군'||c.from!==from||c.to!==to||!Array.isArray(c.items))return null;
 if(!c.items.every(x=>x&&validDay(x.date)&&x.date>=from&&x.date<=to&&typeof x.kind==='string'&&x.kind.length>0))return null;
 return c.items.map(x=>({date:x.date,kind:x.kind}));
}
