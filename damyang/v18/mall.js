(() => {
  'use strict';
  const model=window.FarmShop,products=model.products,price=model.price;
  const categories={all:'전체',drain:'배수',film:'비닐 보수',safety:'작업 안전'};
  const previews=['home','category','empty-search','product','cart','empty-cart','checkout','complete','receipt','orders','legacy-receipt','legacy-orders'];
  const routeBases=['shop','product','cart','checkout','order-complete','receipt','orders'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeDecode=s=>{try{return decodeURIComponent(s)}catch{return s}};
  const iconPaths={
    cart:'<path d="M2.5 3.5h2.7l2 11h11l2.5-8H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17.5" cy="19" r="1.4"/>',
    search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5"/>',
    bag:'<path d="M4.7 7.4h14.6l.9 13H3.8l.9-13ZM8.5 8V6a3.5 3.5 0 117 0v2"/>',
    plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',check:'<path d="m5 12 5 5 9-11"/>',
    order:'<path d="M5 3h14v18l-3-1.8L13 21l-3-1.8L5 21V3Z"/><path d="M8.5 8h7m-7 4h6"/>'
  };
  const icon=k=>'<svg class="mall-icon" aria-hidden="true" viewBox="0 0 24 24">'+iconPaths[k]+'</svg>';
  const isRoute=route=>routeBases.includes(String(route).replace(/^#/,'').split('/')[0]);
  const destinations={shop:'쇼핑 홈으로',product:'상품 상세로',cart:'장바구니로',checkout:'주문서로','order-complete':'주문 완료로',receipt:'영수증으로',orders:'구매 내역으로','repair-result':'기록 결과로',home:'농장 홈으로',detail:'기록 상세로',journal:'농장 일지로',calendar:'달력으로',damage:'피해 기록으로',saved:'저장한 기록으로',settings:'설정으로'};
  const backLabel=route=>destinations[String(route).replace(/^#/,'').split('/')[0]]||'이전 화면으로';
  const previewRuns=new Map();
  function scopeOf(opts){
    const name=opts.preview||new URLSearchParams(location.search).get('mallPreview');
    if(!previews.includes(name))return 'farm';
    const entry=history.state?.mallPreviewRun;
    let run=entry?.name===name?entry.id:previewRuns.get(name);
    if(!run)run=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    previewRuns.set(name,run);
    if(entry?.id!==run)history.replaceState({...history.state,mallPreviewRun:{name,id:run}},'');
    return 'preview-'+name+':'+run;
  }
  function originOf(route,opts){
    const part=String(route).split('/').find(s=>s.startsWith('from-record-'));
    return part?'/'+part:(opts.origin||'');
  }
  const strip=route=>String(route).replace(/^#/,'').split('/').filter(s=>!s.startsWith('from-record-'));
  const address='김민수의 딸기 농장 · 전남 담양(가상)';
  const moneyNote=p=>p.virtual?'<small class="mall-fiction">시연용 가상 가격</small>':'';
  const count=cart=>cart.reduce((n,r)=>n+r.qty,0);
  const productLink=(id,origin)=>'product/'+id+origin;
  const link=(label,to,cls='')=>'<a class="'+cls+'" href="#'+esc(to)+'" data-mall-go="'+esc(to)+'">'+label+'</a>';
  const button=(label,action,cls='',attrs='')=>'<button type="button" class="'+cls+'" data-mall-action="'+action+'" '+attrs+'>'+label+'</button>';
  const img=(item,base,cls='')=>'<img class="'+cls+'" src="'+esc((base||'')+products[item].image)+'" alt="" width="600" height="460">';
  const navMemory=new Map(),filters=new Map(),quantities=new Map();
  let pending=null;
  function resetEntry(route,opts={}){
    const key=scopeOf(opts)+'|'+route;
    filters.delete(key);navMemory.delete(key);pending=null;
  }
  function rememberPath(scope,path){
    path.forEach((r,i)=>navMemory.set(scope+'|'+r,path.slice(0,i+1)));
  }
  function routePath(route,opts){
    const scope=scopeOf(opts),key=scope+'|'+route;
    const transit='damyang-mall-v11-nav/'+scope;
    if(!pending){try{pending=JSON.parse(sessionStorage.getItem(transit)||'null');}catch{}}
    if(pending?.route===route&&pending.scope===scope){
      rememberPath(scope,pending.path);history.replaceState({...history.state,mallPath:pending.path},'');pending=null;
      try{sessionStorage.removeItem(transit)}catch{}
    }
    const entry=history.state?.mallPath;
    if(Array.isArray(entry)&&entry.at(-1)===route){rememberPath(scope,entry);return entry;}
    const remembered=navMemory.get(key);
    if(remembered){history.replaceState({...history.state,mallPath:remembered},'');return remembered;}
    return [route];
  }
  function backTarget(route,opts={}){
    const path=routePath(route,opts),[base]=strip(route),origin=originOf(route,opts);
    if(base==='shop'&&origin&&strip(route).join('/')==='shop/category/film')return '';
    if(path.length>1)return path.at(-2);
    if(base==='shop')return '';
    if(base==='receipt'||base==='order-complete')return 'orders'+origin;
    if(base==='checkout')return 'cart'+origin;
    return (origin?'shop/category/film':'shop')+origin;
  }
  function navigate(route,next,opts){
    const path=routePath(route,opts),already=path.indexOf(next);
    const chain=already>=0?path.slice(0,already+1):[...path,next];
    pending={route:next,path:chain,scope:scopeOf(opts)};
    try{sessionStorage.setItem('damyang-mall-v11-nav/'+pending.scope,JSON.stringify(pending))}catch{}
    if(opts.go)opts.go(next);else location.hash=next;
  }
  function getFilters(route,opts){
    const key=scopeOf(opts)+'|'+route;
    if(!filters.has(key)){
      const parts=strip(route),i=parts.indexOf('search'),j=parts.indexOf('category');
      const category=j>=0&&Object.hasOwn(categories,parts[j+1])?parts[j+1]:'all';
      filters.set(key,{category,query:i>=0?safeDecode(parts[i+1]||''):''});
    }
    return filters.get(key);
  }
  function catalog(filters,opts,origin){
    const q=filters.query.trim().toLocaleLowerCase('ko-KR');
    const matches=Object.entries(products).filter(([,p])=>(filters.category==='all'||p.category===filters.category)&&p.name.toLocaleLowerCase('ko-KR').includes(q));
    if(!matches.length)return '<div class="mall-empty">'+icon('search')+'<h2>찾는 상품이 없어요</h2>'+button('전체 보기','reset','mall-soft')+'</div>';
    return '<div class="mall-grid">'+matches.map(([id,p])=>'<article class="mall-card">'+link(img(id,opts.assetBase)+'<h2>'+p.name+'</h2>',productLink(id,origin),'mall-card-open')+
      '<div class="mall-card-foot"><div><strong>'+price(p.price)+'</strong>'+moneyNote(p)+'</div>'+button(icon('plus')+'담기','add','mall-add','data-sku="'+id+'" aria-label="'+p.name+' 담기"')+'</div></article>').join('')+'</div>';
  }
  function home(route,opts,state,origin){
    const f=getFilters(route,opts),cartQty=count(state.cart);
    return '<header class="mall-home-head"><h1>복구용품</h1><div>'+link(icon('order')+'<span>구매 내역</span>','orders'+origin,'mall-tool')+link(icon('cart')+'<span class="mall-counter">'+cartQty+'</span><span class="mall-sr">장바구니, 담은 수량 '+cartQty+'개</span>','cart'+origin,'mall-tool mall-cart-tool')+'</div></header>'+
      '<label class="mall-search">'+icon('search')+'<input type="search" aria-label="상품 검색" autocomplete="off" placeholder="어떤 복구용품을 찾으세요?" value="'+esc(f.query)+'"></label>'+
      '<div class="mall-chips" role="group" aria-label="상품 분류">'+Object.entries(categories).map(([key,label])=>button(label,'category','mall-chip','aria-pressed="'+(f.category===key)+'" data-category="'+key+'"')).join('')+'</div><div class="mall-results">'+catalog(f,opts,origin)+'</div>';
  }
  function stepper(q,id,cart=false){
    const attr='data-sku="'+id+'"',name=products[id].name,act=cart?'cart':'detail';
    return '<div class="mall-stepper">'+button(icon('minus'),act+'-minus','',attr+' aria-label="'+name+' 수량 줄이기" '+(q<=1?'disabled':''))+'<output aria-label="'+name+' 수량">'+q+'개</output>'+button(icon('plus'),act+'-plus','',attr+' aria-label="'+name+' 수량 늘리기" '+(q>=99?'disabled':''))+'</div>';
  }
  function product(route,id,opts,origin){
    const item=products[id];if(!Object.hasOwn(products,id))return empty('상품을 찾을 수 없어요',origin);
    const q=quantities.get(scopeOf(opts)+'|'+route)||1;
    return '<div class="mall-detail"><div class="mall-detail-image">'+img(id,opts.assetBase)+'</div><div class="mall-detail-copy"><p class="mall-category">'+categories[item.category]+'</p><h1>'+item.name+'</h1><div class="mall-detail-price"><strong>'+price(item.price)+'</strong>'+moneyNote(item)+'</div><p class="mall-description">'+item.description+'</p>'+
      '<div class="mall-quantity"><strong>수량</strong>'+stepper(q,id)+'</div><div class="mall-actions">'+button('장바구니 담기','add-detail','mall-soft','data-sku="'+id+'"')+button('바로 구매','direct','mall-primary','data-sku="'+id+'"')+'</div>'+link('장바구니 보기','cart'+origin,'mall-text-link')+'</div></div>';
  }
  const sumBlock=(label,value)=>'<div class="mall-total"><span>'+label+'</span><strong>'+price(value)+'</strong></div>';
  function empty(title,origin,action='쇼핑 계속하기'){
    return '<div class="mall-empty">'+icon('bag')+'<h2>'+title+'</h2>'+link(action,(origin?'shop/category/film':'shop')+origin,'mall-soft')+'</div>';
  }
  function cartView(state,opts,origin){
    const rows=state.cart;
    if(!rows.length)return '<h1>장바구니</h1>'+empty('장바구니가 비어 있어요',origin);
    return '<h1>장바구니</h1><div class="mall-columns"><div class="mall-cart-list">'+rows.map(r=>{const item=products[r.product];return '<article class="mall-cart-row">'+link(img(r.product,opts.assetBase)+'<span class="mall-sr">'+esc(item.name)+' 상세 보기</span>',productLink(r.product,origin),'mall-thumb')+'<div><h2>'+link(item.name,productLink(r.product,origin))+'</h2><p>개당 '+price(item.price)+'</p>'+moneyNote(item)+stepper(r.qty,r.product,true)+'</div>'+button('삭제','remove','mall-remove','data-sku="'+r.product+'" aria-label="'+item.name+' 삭제"')+'</article>';}).join('')+'</div>'+
      '<aside class="mall-summary">'+sumBlock('합계',model.total(model.snapshot(rows)))+button('주문하기','checkout-cart','mall-primary mall-full')+'</aside></div>';
  }
  function orderLines(items,opts){
    return '<div class="mall-order-lines">'+items.map(r=>'<div class="mall-line">'+img(r.product,opts.assetBase,'mall-small-thumb')+'<div><strong>'+esc(r.name)+'</strong><p>개당 '+price(r.unitPrice)+' · '+r.qty+'개</p>'+moneyNote(r)+'</div><b>'+price(r.unitPrice*r.qty)+'</b></div>').join('')+'</div>';
  }
  function checkout(state,id,opts,origin){
    const draft=Object.hasOwn(state.drafts,id)&&state.drafts[id];
    if(!draft){
      const paid=Object.hasOwn(state.orders,id);
      return '<h1>모의 주문서</h1><div class="mall-empty"><h2>'+(paid?'이미 모의 결제를 마쳤어요':'주문할 상품을 확인해 주세요')+'</h2>'+link(paid?'영수증 보기':'장바구니 보기',(paid?'receipt/'+id:'cart')+origin,'mall-primary')+'</div>';
    }
    return '<h1>모의 주문서</h1><div class="mall-columns"><div><section class="mall-info"><h2>배송지</h2><p>'+address+'</p></section><section class="mall-info"><h2>주문 상품</h2>'+orderLines(draft.items,opts)+'</section></div>'+
      '<aside class="mall-summary"><h2>결제 수단</h2><p class="mall-method">'+icon('check')+'모의 결제</p>'+sumBlock('모의 구매 합계',draft.total)+button('모의 결제하기','pay','mall-primary mall-full','data-order="'+esc(id)+'"')+'</aside></div>';
  }
  function completed(state,id,origin){
    const o=Object.hasOwn(state.orders,id)&&state.orders[id];
    if(!o)return '<h1>주문 완료</h1>'+empty('확인할 주문이 없어요',origin);
    return '<div class="mall-complete"><span class="mall-check">'+icon('check')+'</span><h1>모의 주문을 마쳤어요</h1><p>'+o.items.length+'개 품목 · 총 '+count(o.items)+'개</p>'+sumBlock('모의 구매 합계',o.total)+link('영수증 보기','receipt/'+id+origin,'mall-primary mall-full')+'</div>';
  }
  const orderDate=s=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
  function receipt(state,id,opts,origin){
    const o=Object.hasOwn(state.orders,id)&&state.orders[id];
    return '<h1>모의 영수증</h1>'+(o?'<div class="mall-columns"><section class="mall-info"><h2>구매 상품</h2>'+orderLines(o.items,opts)+'</section><aside class="mall-summary"><p class="mall-date">'+orderDate(o.createdAt)+'</p>'+sumBlock('모의 구매 합계',o.total)+link('모의 구매 내역 보기','orders'+origin,'mall-primary mall-full')+'</aside></div>':'<div class="mall-empty"><p>구매 내역에서 영수증을 선택해 주세요.</p>'+link('모의 구매 내역 보기','orders'+origin,'mall-primary')+'</div>');
  }
  function orderList(state,origin){
    const rows=Object.values(state.orders).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    return '<h1>모의 구매 내역</h1>'+(rows.length?'<div class="mall-history">'+rows.map(o=>link('<span><small>'+orderDate(o.createdAt)+'</small><strong>'+esc(o.items[0].name)+(o.items.length>1?' 외 '+(o.items.length-1)+'개 품목':'')+'</strong><small>총 '+count(o.items)+'개</small></span><b>'+price(o.total)+' ›</b>','receipt/'+o.id+origin,'mall-history-row')).join('')+'</div>':empty('아직 구매한 물품이 없어요',origin))+ (rows.length?link('쇼핑으로 돌아가기',(origin?'shop/category/film':'shop')+origin,'mall-text-link'):'');
  }
  function view(route,opts={}){
    routePath(route,opts);
    const [base,id]=strip(route),origin=originOf(route,opts);let content;
    try{
      const state=model.read(scopeOf(opts));
      switch(base){
        case 'shop':content=home(route,opts,state,origin);break;
        case 'product':content=product(route,id,opts,origin);break;
        case 'cart':content=cartView(state,opts,origin);break;
        case 'checkout':content=checkout(state,id,opts,origin);break;
        case 'order-complete':content=completed(state,id,origin);break;
        case 'receipt':content=receipt(state,id,opts,origin);break;
        case 'orders':content=orderList(state,origin);break;
        default:content=empty('화면을 찾을 수 없어요',origin);
      }
    }catch{content='<h1>쇼핑</h1><p>저장한 쇼핑 정보를 열지 못했어요. 브라우저의 저장 공간을 확인해 주세요.</p>';}
    return '<article class="mall-screen" data-mall-screen="'+esc(base)+'">'+content+'<p class="mall-status" role="status" aria-live="polite"></p><footer class="mall-footnote">실제 결제와 배송은 없어요.</footer></article>';
  }
  function bind(container,route,opts={}){
    const el=container?.matches?.('.mall-screen')?container:container?.querySelector?.('.mall-screen');
    if(!el||el.dataset.bound==='1')return;el.dataset.bound='1';
    const scope=scopeOf(opts),origin=originOf(route,opts),[base,id]=strip(route);
    const info=text=>{el.querySelector('.mall-status').textContent=text;};
    function paint(focus='',message=''){
      const parent=el.parentElement;el.outerHTML=view(route,opts);const current=parent.querySelector('.mall-screen');
      bind(current,route,opts);current.querySelector('.mall-status').textContent=message;
      if(focus)current.querySelector(focus)?.focus({preventScroll:true});
    }
    function updateResults(){
      const f=getFilters(route,opts);
      el.querySelector('.mall-results').innerHTML=catalog(f,opts,origin);
      el.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===f.category)));
    }
    el.addEventListener('input',e=>{if(!e.target.matches('.mall-search input'))return;getFilters(route,opts).query=e.target.value;updateResults();});
    el.addEventListener('click',async e=>{
      const a=e.target.closest('[data-mall-go],[data-mall-action]');if(!a||!el.contains(a)||a.disabled)return;
      if(a.hasAttribute('data-mall-go')){
        if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
        e.preventDefault();navigate(route,a.dataset.mallGo,opts);return;
      }
      const action=a.dataset.mallAction,sku=a.dataset.sku,qkey=scope+'|'+route,q=quantities.get(qkey)||1;
      if(action==='category'||action==='reset'){
        const f=getFilters(route,opts);f.category=action==='reset'?'all':a.dataset.category;
        if(action==='reset'){f.query='';el.querySelector('.mall-search input').value='';}
        updateResults();if(action==='reset')el.querySelector('.mall-search input').focus();return;
      }
      const busy=['pay','direct','checkout-cart','add','add-detail','remove','cart-plus','cart-minus'].includes(action);
      if(busy){if(el.dataset.busy==='1')return;el.dataset.busy='1';a.disabled=true;}
      try{
        if(action==='add'||action==='add-detail'){
          await model.add(sku,action==='add'?1:q,scope);if(!el.isConnected)return;
          paint('[data-mall-action="'+action+'"][data-sku="'+sku+'"]','장바구니에 '+products[sku].name+' '+(action==='add'?1:q)+'개를 담았어요.');return;
        }
        if(action==='detail-plus'||action==='detail-minus'){
          quantities.set(qkey,Math.max(1,Math.min(99,q+(action==='detail-plus'?1:-1))));paint('[data-mall-action="'+action+'"]:not(:disabled)');return;
        }
        if(action==='remove'||action==='cart-plus'||action==='cart-minus'){
          await model.adjust(sku,action==='remove'?'remove':action==='cart-plus'?1:-1,scope);if(!el.isConnected)return;paint('[data-mall-action="'+action+'"][data-sku="'+sku+'"]:not(:disabled)');return;
        }
        if(action==='direct'||action==='checkout-cart'){
          const draft=await model.begin(action==='direct'?'direct':'cart',sku,q,scope);if(el.isConnected)navigate(route,'checkout/'+draft+origin,opts);return;
        }
        if(action==='pay'){
          const order=await model.pay(id,scope);if(el.isConnected)navigate(route,'order-complete/'+order.id+origin,opts);
        }
      }catch(err){info(err?.message?.includes('주세요')||err?.message?.includes('있어요')?err.message:'저장하지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.');}
      finally{if(busy&&el.isConnected){delete el.dataset.busy;a.disabled=false;}}
    });
  }
  window.FarmMall={isRoute,view,bind,backTarget,backLabel,resetEntry};
})();
