// 가상 시연 결과는 해당 사고와 조회 범위에만 묶는다.
export function demoAlertItems(record, profile, from, to) {
 const c=record?.alert_check;
 if(!record?.demo||!profile?.demo||!c||c.source!=='demo'||c.sigungu!=='가상군'||c.from!==from||c.to!==to||!Array.isArray(c.items))return null;
 if(!c.items.every(x=>x&&typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date>=from&&x.date<=to&&typeof x.kind==='string'&&x.kind.length>0))return null;
 return c.items.map(x=>({date:x.date,kind:x.kind}));
}
