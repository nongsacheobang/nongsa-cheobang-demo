// Run: node --experimental-vm-modules js/insurance/cases.test.js
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const base=path.resolve(__dirname,'..');const mods=new Map();
function moduleAt(p){if(!mods.has(p))mods.set(p,new vm.SourceTextModule(fs.readFileSync(path.join(base,p),'utf8'),{identifier:p}));return mods.get(p)}
(async()=>{const m=moduleAt('insurance/rules.js');await m.link((s,r)=>moduleAt(path.posix.normalize(path.posix.join(path.posix.dirname(r.identifier),s))));await m.evaluate();const factors=m.namespace.FACTORS;let results=[];
const H=[{id:'a',name:'1동',crop:'토마토',area_m2:100},{id:'b',name:'2동',crop:'딸기',area_m2:100}];
const ctx=(records=[],extra={})=>({today:'2026-11-20',profile:{houses:H,insurance:{facility_insured:true,crop_insured:true,insured_area_m2:200}},records,alerts:[],...extra});
const w=(date,task,extra={})=>({workDate:date,houseIds:['a'],stage:'작물관리',task,materials:[],...extra});const d=(extra={})=>({type:'disaster',id:'d',workDate:'2026-11-17',accident_date:'2026-11-17',peril:'강풍',facility_damage:'시설 피해 없음',...extra});const plant=w('2026-10-01','정식');
function check(id,name,input,expected){let got;try{got=factors.find(f=>f.id===id).evaluate(input).state;assert.equal(got,expected);results.push({id,name,pass:true})}catch(e){results.push({id,name,pass:false,expected,actual:got,error:e.message})}}
const ins=(field,v)=>ctx([],{profile:{houses:H,insurance:{[field]:v}}});
for(const [id,key] of [['R-01','facility_insured'],['R-02','crop_insured']])for(const [v,s] of [[true,'met'],[false,'unmet'],[null,'unknown']])check(id,String(v),ins(key,v),s);
for(const [area,s] of [[220,'met'],[221,'unmet'],[null,'unknown']])check('R-03',String(area),ctx([],{profile:{houses:H,insurance:{insured_area_m2:area}}}),s);
check('R-04','both',ctx([plant,w('2026-10-02','정식',{houseIds:['b']})]),'met');check('R-04','one',ctx([plant]),'unmet');check('R-04','hidden house ignored',ctx([plant],{profile:{houses:[H[0],{...H[1],hidden:true}],insurance:{facility_insured:true,crop_insured:true}}}),'met');check('R-04','no houses',ctx([],{profile:{houses:[]}}),'unknown');
check('R-05','start',ctx([w('2026-11-19','수확 개시')]),'met');check('R-05','harvest',ctx([w('2026-11-19','수확')]),'unmet');check('R-05','none',ctx([]),'na');
check('R-06','photo',ctx([w('2026-10-01','정식',{photo_count:1})]),'met');check('R-06','no proof',ctx([plant]),'unmet');check('R-06','before planting',ctx([]),'na');
check('R-07','14 days two',ctx([plant,w('2026-11-06','관수'),w('2026-11-20','환기')]),'met');check('R-07','15 days',ctx([plant,w('2026-11-05','관수'),w('2026-11-20','환기')]),'unmet');check('R-07','before planting',ctx([]),'na');
check('R-08','7 days',ctx([w('2026-11-10','관찰',{pest_seen:'응애'}),w('2026-11-17','병해충 방제')]),'met');check('R-08','8 days',ctx([w('2026-11-10','관찰',{pest_seen:'응애'}),w('2026-11-18','병해충 방제')]),'unmet');check('R-08','no pest',ctx([]),'na');
check('R-09','recent',ctx([w('2026-11-01','하우스 점검')]),'met');check('R-09','old',ctx([w('2026-01-01','하우스 점검')]),'unmet');check('R-09','none',ctx([]),'unmet');
check('R-09','90 days',ctx([w('2026-08-22','하우스 점검')]),'met');check('R-09','91 days',ctx([w('2026-08-21','하우스 점검')]),'unmet');
check('R-10','30 days',ctx([plant,w('2026-10-21','관수',{houseIds:['a','b'],photo_count:1})]),'met');check('R-10','31 days',ctx([plant,w('2026-10-20','관수',{houseIds:['a','b'],photo_count:1})]),'unmet');
check('R-10','both houses',ctx([plant,w('2026-11-10','관수',{photo_count:1}),w('2026-11-11','관수',{houseIds:['b'],photo_count:1})]),'met');check('R-10','missing one house',ctx([plant,w('2026-11-10','관수',{photo_count:1})]),'unmet');check('R-10','hidden house ignored',ctx([plant,w('2026-11-10','관수',{photo_count:1})],{profile:{houses:[H[0],{...H[1],hidden:true}],insurance:{facility_insured:true,crop_insured:true}}}),'met');check('R-10','before planting',ctx([]),'na');
check('R-10','planting with no crop houses',ctx([plant],{profile:{houses:[]}}),'unknown');
check('R-11','three days',ctx([d({reported_at:'2026-11-20'})]),'met');check('R-11','four days',ctx([d({reported_at:'2026-11-21'})]),'unmet');check('R-11','no accident',ctx([]),'na');check('R-11','report before accident',ctx([d({reported_at:'2026-11-16'})]),'unknown');
check('R-11','invalid calendar date',ctx([d({accident_date:'2026-02-30',reported_at:'2026-03-02'})]),'unknown');
check('R-12','photo',ctx([d({photo_count:1})]),'met');check('R-12','no photo',ctx([d()]),'unmet');check('R-12','no accident',ctx([]),'na');
check('R-13','wind',ctx([d()]),'met');check('R-13','disease',ctx([d({peril:'흰가루병'})]),'unmet');check('R-13','no accident',ctx([]),'na');
for(const [date,state] of [['2026-11-16','met'],['2026-11-18','met'],['2026-11-19','unmet']])check('R-14',date,ctx([d()], {alerts:[{date,kind:'강풍주의보'}]}),state);check('R-14','unavailable',ctx([d()],{alerts:null}),'unknown');check('R-14','no accident',ctx([]),'na');
check('R-15','no facility with alert',ctx([d()],{alerts:[{date:'2026-11-17',kind:'강풍주의보'}]}),'met');check('R-15','no facility no alert',ctx([d()]),'unmet');check('R-15','array no facility',ctx([d({facility_damage:['시설 피해 없음']})]),'unmet');check('R-15','array facility damaged',ctx([d({facility_damage:['비닐 찢어짐','골조 휨과 파손']})]),'na');check('R-15','no accident',ctx([]),'na');check('R-15','unknown alert',ctx([d()],{alerts:null}),'unknown');
for (const [name, ok] of [
  ['작물 담보 안내는 보상을 확정하지 않음', factors.find(f=>f.id==='R-02').basis.includes('가입한 경우에 살펴봐요')],
  ['재해 종류 안내는 농축협 확인을 권함', factors.find(f=>f.id==='R-13').evaluate(ctx([d()])).reason.includes('가입한 농축협에 확인하세요')],
  ['물 피해 특약은 개별 보상을 확정하지 않음', fs.readFileSync(path.join(base,'views/insurance.js'),'utf8').includes('해당 특약의 물 피해 조건은 가입한 농축협에 확인해 주세요')]
]) results.push({id:'문구',name,pass:ok});
const failed=results.filter(x=>!x.pass);console.log(JSON.stringify({total:results.length,pass:results.length-failed.length,failed},null,2));if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
