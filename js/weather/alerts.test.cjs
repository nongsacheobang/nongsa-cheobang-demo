// Run: node --experimental-vm-modules js/weather/alerts.test.cjs
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'), modules=new Map();
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'alerts.fixture.json'),'utf8'));
global.fetch=async url=>{if(!String(url).endsWith('/weather/alerts.fixture.json'))throw Error('unexpected fixture');return {ok:true,json:async()=>fixture}};
function load(rel){if(!modules.has(rel))modules.set(rel,new vm.SourceTextModule(fs.readFileSync(path.join(root,rel),'utf8'),{identifier:rel,initializeImportMeta(meta){meta.url=require('url').pathToFileURL(path.join(root,rel)).href}}));return modules.get(rel)}
async function link(s,r){return load(path.posix.normalize(path.posix.join(path.posix.dirname(r.identifier),s)))}
(async()=>{const m=load('weather/alerts.js');await m.link(link);await m.evaluate();const r=load('insurance/rules.js');await r.link(link);await r.evaluate();const {getAlerts,convertAlerts}=m.namespace;const mock={response:fixture.response};const clone=x=>JSON.parse(JSON.stringify(x));const q={areaCode:'TEST0001',from:'2026-11-16',to:'2026-11-18'};let n=0;const test=async(name,fn)=>{await fn();n++;console.log('PASS '+name)};
await test('가상 특보',async()=>assert.deepEqual(JSON.parse(JSON.stringify(await getAlerts({sigungu:'가상군',from:q.from,to:q.to}))),[{date:'2026-11-17',kind:'강풍주의보'}]));
await test('가상 파일을 못 읽으면 모름',async()=>{const old=global.fetch;try{global.fetch=async()=>{throw Error('offline')};assert.equal(await getAlerts({sigungu:'가상군',from:q.from,to:q.to}),null)}finally{global.fetch=old}});
await test('조회 범위 내 결과 없음',async()=>assert.equal((await getAlerts({sigungu:'가상군',from:'2026-11-01',to:'2026-11-02'})).length,0));
await test('알 수 없는 지역',async()=>assert.equal(await getAlerts({sigungu:'다른군',from:q.from,to:q.to}),null));
await test('조회 범위 밖',async()=>assert.equal(await getAlerts({sigungu:'가상군',from:'2026-10-31',to:q.to}),null));
await test('잘못된 날짜',async()=>assert.equal(await getAlerts({sigungu:'가상군',from:'2026-02-30',to:q.to}),null));
await test('응답 오류',()=>{let p=clone(mock);p.response.header.resultCode='99';assert.equal(convertAlerts(p,q),null)});
await test('전체 건수 누락',()=>{let p=clone(mock);p.response.body.totalCount=null;assert.equal(convertAlerts(p,q),null)});
await test('일부 페이지',()=>{let p=clone(mock);p.response.body.totalCount=3;assert.equal(convertAlerts(p,q),null)});
await test('빈 성공 응답',()=>{let p=clone(mock);p.response.body.totalCount=0;p.response.body.items={};assert.equal(convertAlerts(p,q).length,0)});
await test('단일 항목',()=>{let p=clone(mock);p.response.body.totalCount=1;p.response.body.items.item=p.response.body.items.item[0];assert.equal(convertAlerts(p,q).length,1)});
await test('불확실한 정정',()=>{let p=clone(mock);p.response.body.items.item[0].command='6';assert.equal(convertAlerts(p,q),null)});
await test('취소된 자료',()=>{let p=clone(mock);p.response.body.items.item[0].cancel='1';assert.equal(convertAlerts(p,q),null)});
await test('날짜 오류',()=>{let p=clone(mock);p.response.body.items.item[0].startTime='202602300900';assert.equal(convertAlerts(p,q),null)});
await test('알 수 없는 종류',()=>{let p=clone(mock);p.response.body.items.item[0].warnVar='99';assert.equal(convertAlerts(p,q),null)});
await test('존재하지 않는 발효 시각',()=>{let p=clone(mock);p.response.body.items.item[0].startTime='202611172460';assert.equal(convertAlerts(p,q),null)});
await test('다른 페이지 응답',()=>{let p=clone(mock);p.response.body.pageNo=2;assert.equal(convertAlerts(p,q),null)});
await test('같은 날짜와 종류의 중복',()=>{let p=clone(mock);p.response.body.items.item[1]=clone(p.response.body.items.item[0]);let out=convertAlerts(p,q);assert.equal(out.length,1);assert.equal(out[0].kind,'강풍주의보')});
await test('조회 시작일이 끝보다 늦음',async()=>assert.equal(await getAlerts({sigungu:'가상군',from:q.to,to:q.from}),null));
await test('다른 구역은 결과에 포함하지 않음',()=>assert.equal(convertAlerts(mock,{...q,areaCode:'TEST0002'})[0].kind,'호우경보'));
const factor=r.namespace.FACTORS.find(x=>x.id==='R-14');const ctx=alerts=>({records:[{type:'disaster',id:'d',accident_date:'2026-11-17'}],today:'2026-11-20',alerts});
await test('R-14 일치',async()=>assert.equal(factor.evaluate(ctx(await getAlerts({sigungu:'가상군',from:q.from,to:q.to}))).state,'met'));
await test('이전 발효의 지속 여부 미상',async()=>assert.equal(await getAlerts({sigungu:'가상군',from:'2026-11-19',to:'2026-11-20'}),null));
await test('R-14 특보 없음',async()=>{let alerts=await getAlerts({sigungu:'가상군',from:'2026-11-01',to:'2026-11-03'});let input={...ctx(alerts),records:[{type:'disaster',id:'d',accident_date:'2026-11-02'}]};assert.equal(factor.evaluate(input).state,'unmet')});
await test('R-14 조회 실패',async()=>assert.equal(factor.evaluate(ctx(await getAlerts({sigungu:'알수없음',from:q.from,to:q.to}))).state,'unknown'));
console.log(`총 ${n}개 통과`);})().catch(e=>{console.error(e);process.exitCode=1});
