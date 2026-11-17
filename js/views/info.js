// 시연을 위한 가상 소식. 실제 사업이나 일정이 아니다.
export const DEMO_NEWS = [
  ['n1','지원사업 정보','시설 개선 안내 예시','2026-11-17'],['n2','재해보험 변경','보험 가입 안내 예시','2026-11-17'],
  ['n3','지원사업 정보','농업 교육 안내 예시','2026-11-17'],['n4','재해보험 변경','피해 기록 안내 예시','2026-11-17'],
  ['n5','지원사업 정보','농장 안전 안내 예시','2026-11-17'],['n6','재해보험 변경','가입 내용 확인 예시','2026-11-17'],
  ['n7','지원사업 정보','시설 점검 안내 예시','2026-11-17'],['n8','재해보험 변경','접수 절차 안내 예시','2026-11-17'],
  ['n9','지원사업 정보','재배 기술 안내 예시','2026-11-17'],['n10','지원사업 정보','증빙 준비 안내 예시','2026-11-17']
];
const key='nongsa_demo_news_read_v1';
export function readNews() { try { const x=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(x)?x:[]; } catch { return []; } }
export function resetDemoNews() { localStorage.setItem(key, JSON.stringify(DEMO_NEWS.slice(3).map(item => item[0]))); }
function markNewsRead(id) { const read=readNews(); if(!read.includes(id))read.push(id); try { localStorage.setItem(key,JSON.stringify(read)); return true; } catch { return false; } }
export function isNewNews(item, read, today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(new Date())) {
  if (!Array.isArray(item) || read.includes(item[0]) || !/^\d{4}-\d{2}-\d{2}$/.test(item[3] || '')) return false;
  const parse = value => { const date = new Date(value + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? date.getTime() : NaN; };
  const age = (parse(today) - parse(item[3])) / 86400000;
  return Number.isInteger(age) && age >= 0 && age < 30;
}
export function newNewsCount(today) { const read=readNews(); return DEMO_NEWS.filter(item=>isNewNews(item,read,today)).length; }
export default { route:'info', tab:'info', title:'정보',
  render(ctx) { const read=readNews(),e=ctx.esc; if(ctx.param){const item=DEMO_NEWS.find(x=>x[0]===ctx.param);if(!item)return `<section class="scr"><div class="hd"><h1>정보</h1></div><div class="bd"><p>소식을 찾지 못했어요.</p><button class="ghost" data-act="go" data-v="info">목록으로</button></div></section>`;markNewsRead(item[0]);const [,category,title,date]=item;return `<section class="scr"><div class="hd"><button class="bk" data-act="go" data-v="info" aria-label="목록으로">&lt;</button><h1>소식</h1></div><div class="bd"><div class="card"><p>가상 소식</p><p>${e(category)} ${e(date)}</p><h2>${e(title)}</h2><p>이 소식은 화면을 확인하기 위한 예시예요. 실제 사업이나 가입 일정이 아닙니다.</p><p class="mut">지원사업과 보험 조건은 해당 기관에서 직접 확인해 주세요.</p></div><button class="ghost" data-act="go" data-v="info">목록으로</button></div></section>`} const filter=ctx.S?.infoFilter||'전체',categories=['전체','지원사업 정보','재해보험 변경'];const visible=DEMO_NEWS.filter(item=>filter==='전체'||item[1]===filter);return `<section class="scr"><div class="hd"><h1>정보</h1></div><div class="bd"><p>아래 소식은 기능 확인을 위한 가상 예시예요.</p><div class="chips">${categories.map(c=>`<button class="chip" data-act="infoFilter" data-v="${e(c)}" aria-pressed="${filter===c}">${e(c)}</button>`).join('')}</div>${visible.map((item)=>{const [id,category,title]=item;return `<button class="ghost info-item" data-act="infoRead" data-v="${e(id)}"><span>${e(category)}</span><strong>${e(title)}</strong>${isNewNews(item,read)?' <span>새 소식</span>':''}</button>`}).join('')}${ctx.session?'':'<button class="ghost" data-act="go" data-v="login">로그인 화면으로</button>'}</div></section>`; },
  actions:{ infoFilter(el,ctx){if(!['전체','지원사업 정보','재해보험 변경'].includes(el.dataset.v))return;ctx.S.infoFilter=el.dataset.v;ctx.rerender()}, infoRead(el,ctx) { const id=el.dataset.v;if(!DEMO_NEWS.some(n=>n[0]===id))return;if(!markNewsRead(id))ctx.toast('읽음 표시를 저장하지 못했어요');ctx.go('info/'+id); } }
};
