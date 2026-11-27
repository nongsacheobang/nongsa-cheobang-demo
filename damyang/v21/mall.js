(() => {
  'use strict';
  const model=window.FarmShop,products=model.products,stores=model.stores,price=model.price;
  // v21 농장 용품: 분류 = 입점 매장(가상 4곳). 예전 링크의 film 분류는 하우스 자재 매장으로 연결한다.
  const categories={all:'전체',...Object.fromEntries(Object.entries(stores).map(([id,s])=>[id,s.name]))};
  const legacyCategory={film:'house',drain:'water',safety:'work'};
  // 사진이 없는 상품은 매장 색 바탕에 선 그림으로 보여준다(외부 이미지 없음).
  const artPaths={
    roll:'<rect x="14" y="20" width="36" height="24" rx="4"/><ellipse cx="14" cy="32" rx="5" ry="12"/><path d="M50 26h6M50 38h6"/>',
    tape:'<circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="7"/><path d="M46 38l10 6"/>',
    clip:'<path d="M20 44V24a8 8 0 0116 0v16a5 5 0 01-10 0V26"/><path d="M40 20h8M40 30h8M40 40h8"/>',
    pipe:'<path d="M12 46c0-18 12-30 40-30"/><path d="M12 52c0-22 16-36 40-36" opacity=".5"/>',
    net:'<rect x="14" y="14" width="36" height="36" rx="3"/><path d="M14 26h36M14 38h36M26 14v36M38 14v36"/>',
    hose:'<path d="M14 40c0-10 8-14 16-14s16 4 16-6-10-8-14-4"/><path d="M14 40v10M44 20l8-6"/>',
    valve:'<path d="M12 36h40M24 36V24h16v12"/><path d="M32 24v-8M24 16h16"/>',
    sprinkler:'<path d="M32 50V30"/><path d="M24 50h16"/><path d="M32 28l-12-12M32 28l12-12M32 28V12" stroke-dasharray="3 4"/>',
    drip:'<path d="M10 24h44"/><path d="M20 30c-3 5-3 8 0 8s3-3 0-8M36 30c-3 5-3 8 0 8s3-3 0-8M48 40c-3 5-3 8 0 8s3-3 0-8"/>',
    bucket:'<path d="M16 22h32l-4 28H20z"/><path d="M18 22c0-10 28-10 28 0"/>',
    pump:'<rect x="20" y="22" width="24" height="26" rx="4"/><path d="M32 22V12h12M26 34h12"/>',
    thermo:'<circle cx="32" cy="32" r="16"/><path d="M32 32l8-8M32 18v3M46 32h-3M18 32h3"/>',
    glove:'<path d="M22 50V30l-4-8a3 3 0 015-3l3 6V14a3 3 0 016 0v10-12a3 3 0 016 0v12-9a3 3 0 016 0v19c0 8-4 16-10 16z"/>',
    boot:'<path d="M22 12h14v26l14 4a4 4 0 014 4v4H22z"/><path d="M22 44h32"/>',
    hat:'<path d="M10 40c0-4 10-6 22-6s22 2 22 6-10 6-22 6-22-2-22-6z"/><path d="M20 36c0-12 5-18 12-18s12 6 12 18"/>',
    apron:'<path d="M24 12h16v8l8 6-4 26H20l-4-26 8-6z"/><path d="M26 34h12"/>',
    mask:'<path d="M14 26c6-4 30-4 36 0v10c-6 8-30 8-36 0z"/><path d="M14 30H8M50 30h6"/>',
    tray:'<rect x="10" y="20" width="44" height="26" rx="3"/><path d="M10 33h44M21 20v26M32 20v26M43 20v26"/>',
    pot:'<path d="M18 26h28l-4 24H22z"/><path d="M16 20h32v6H16z"/>',
    soil:'<path d="M18 14h28l4 36H14z"/><path d="M22 30c4 4 16 4 20 0"/>',
    stake:'<path d="M24 54L36 10M36 10l4 2"/><path d="M40 54L48 24"/><path d="M18 30h30"/>',
    twine:'<circle cx="28" cy="32" r="14"/><path d="M18 26c6 4 14 4 20 0M18 38c6-4 14-4 20 0"/><path d="M42 32c6 0 10 4 12 10"/>',
    scissors:'<circle cx="20" cy="44" r="6"/><circle cx="34" cy="48" r="6"/><path d="M24 40L46 14M30 43l18-16"/>',
    sprayer:'<rect x="20" y="24" width="20" height="28" rx="4"/><path d="M26 24v-8h12l8 4M30 16v-4"/>'
  };
  const previews=['home','category','empty-search','product','cart','empty-cart','checkout','complete','receipt','orders','legacy-receipt','legacy-orders'];
  const routeBases=['shop','product','cart','checkout','order-complete','receipt','orders'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeDecode=s=>{try{return decodeURIComponent(s)}catch{return s}};
  const iconPaths={
    cart:'<path d="M2.5 3.5h2.7l2 11h11l2.5-8H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17.5" cy="19" r="1.4"/>',
    search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5"/>',
    bag:'<path d="M4.7 7.4h14.6l.9 13H3.8l.9-13ZM8.5 8V6a3.5 3.5 0 117 0v2"/>',
    plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',check:'<path d="m5 12 5 5 9-11"/>',
    order:'<path d="M5 3h14v18l-3-1.8L13 21l-3-1.8L5 21V3Z"/><path d="M8.5 8h7m-7 4h6"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'
  };
  const icon=k=>'<svg class="mall-icon" aria-hidden="true" viewBox="0 0 24 24">'+iconPaths[k]+'</svg>';
  const isRoute=route=>routeBases.includes(String(route).replace(/^#/,'').split('/')[0]);
  const destinations={shop:'쇼핑 홈으로',product:'상품 상세로',cart:'장바구니로',checkout:'주문서로','order-complete':'주문 완료로',receipt:'영수증으로',orders:'모의 구매 내역으로','repair-result':'기록 결과로',home:'농장 홈으로',detail:'기록 상세로',journal:'농장 일지로',calendar:'달력으로',damage:'피해 기록으로',saved:'저장한 기록으로',settings:'설정으로',news:'소식으로'};
  const backLabel=route=>{const p=String(route).replace(/^#/,'').split('/');return p[0]==='shop'&&p[1]==='store'?'매장으로':destinations[p[0]]||'이전 화면으로';};
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
  function img(item,base,cls=''){
    const p=products[item];
    if(p?.image)return '<img class="'+cls+'" src="'+esc((base||'')+p.image)+'" alt="" width="600" height="460">';
    const s=stores[p?.store]||{tone:'#eef0ef',ink:'#5c5c5c'};
    return '<span class="mall-art '+cls+'" style="--art-bg:'+s.tone+';--art-ink:'+s.ink+'" aria-hidden="true"><svg viewBox="0 0 64 64">'+(artPaths[p?.art]||artPaths.bucket)+'</svg></span>';
  }
  // 가상 매장 로고: 매장색 원 안에 분야 기호(하우스 아치·물방울·장갑·새싹). 실제 업체 상표가 아니다.
  const logoPaths={
    house:'<path d="M8 25V16a8 8 0 0116 0v9"/><path d="M5 25h22M12 25v-7M20 25v-7"/>',
    water:'<path d="M16 5c5 7 8 11 8 15a8 8 0 01-16 0c0-4 3-8 8-15z"/><path d="M12 20a4 4 0 004 4"/>',
    work:'<path d="M10 27V15l-2-4a2 2 0 013-2l2 4V7a2 2 0 014 0v6-7a2 2 0 014 0v7-5a2 2 0 014 0v11c0 5-3 8-7 8z"/>',
    garden:'<path d="M16 27V15"/><path d="M16 17c0-6-4-9-10-9 0 6 4 9 10 9zM16 14c0-5 4-8 10-8 0 5-4 8-10 8z"/>'
  };
  const logo=(id,cls='')=>{const s=stores[id];return '<span class="mall-logo '+cls+'" style="--logo-bg:'+s.tone+';--logo-ink:'+s.ink+'" aria-hidden="true"><svg viewBox="0 0 32 32">'+(logoPaths[id]||'')+'</svg></span>';};
  const storeOf=r=>r.storeName||stores[products[r.product]?.store]?.name||'농장 용품';
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
    const transit=(window.FarmTrial?.ns||'damyang-public-v21-')+'mall-nav/'+scope;
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
    if(base==='shop'&&strip(route)[1]==='store')return 'shop'+origin;
    if(base==='shop')return '';
    if(base==='receipt'||base==='order-complete')return 'orders'+origin;
    if(base==='checkout')return 'cart'+origin;
    return (origin?'shop/category/film':'shop')+origin;
  }
  function navigate(route,next,opts){
    const path=routePath(route,opts),already=path.indexOf(next);
    const chain=already>=0?path.slice(0,already+1):[...path,next];
    pending={route:next,path:chain,scope:scopeOf(opts)};
    try{sessionStorage.setItem((window.FarmTrial?.ns||'damyang-public-v21-')+'mall-nav/'+pending.scope,JSON.stringify(pending))}catch{}
    if(opts.go)opts.go(next);else location.hash=next;
  }
  function getFilters(route,opts){
    const key=scopeOf(opts)+'|'+route;
    if(!filters.has(key)){
      const parts=strip(route),i=parts.indexOf('search'),j=parts.indexOf('category');
      const s=parts.indexOf('store'),raw=s>=0?parts[s+1]:j>=0?(legacyCategory[parts[j+1]]||parts[j+1]):'';
      const category=raw&&raw!=='all'&&Object.hasOwn(categories,raw)?raw:'all';
      filters.set(key,{category,query:i>=0?safeDecode(parts[i+1]||''):'',store:(s>=0||j>=0)&&category!=='all'?category:''});
    }
    return filters.get(key);
  }
  function catalog(filters,opts,origin){
    const q=filters.query.trim().toLocaleLowerCase('ko-KR');
    const matches=Object.entries(products).filter(([,p])=>(filters.category==='all'||p.store===filters.category)&&p.name.toLocaleLowerCase('ko-KR').includes(q));
    if(!matches.length)return '<div class="mall-empty">'+icon('search')+'<h2>찾는 상품이 없어요</h2>'+button('전체 보기','reset','mall-soft')+'</div>';
    return '<p class="mall-count">상품 '+matches.length+'개</p><div class="mall-grid">'+matches.map(([id,p])=>'<article class="mall-card">'+link(img(id,opts.assetBase)+'<small class="mall-card-store">'+(filters.store?'':esc(stores[p.store].name))+'</small><h2>'+esc(p.name)+'</h2>',productLink(id,origin),'mall-card-open')+
      '<div class="mall-card-foot"><div><strong>'+price(p.price)+'</strong>'+moneyNote(p)+'</div>'+button(icon('plus')+'담기','add','mall-add','data-sku="'+id+'" aria-label="'+p.name+' 담기"')+'</div></article>').join('')+'</div>';
  }
  function home(route,opts,state,origin){
    const f=getFilters(route,opts),cartQty=count(state.cart);
    const counts=Object.fromEntries(Object.keys(stores).map(id=>[id,Object.values(products).filter(p=>p.store===id).length]));
    const store=f.store&&stores[f.store];

    const top=store
      ?'<section class="mall-store-head">'+logo(f.store,'mall-logo-lg')+'<div><h2>'+esc(store.name)+'</h2><p>'+esc(store.field)+' · 상품 '+counts[f.store]+'개 · 가상 매장</p></div></section>'
      :'<section class="mall-stores" aria-labelledby="mall-stores-title"><h2 id="mall-stores-title">입점 매장</h2><div class="mall-store-row">'+Object.keys(stores).map(id=>link(logo(id)+'<span>'+esc(stores[id].name)+'</span>','shop/store/'+id+origin,'mall-store-pick')).join('')+'</div></section>';
    return '<header class="mall-home-head"><h1>농장 용품</h1><div>'+link(icon('order')+'<span>'+(window.FarmTrial?.on?'구매 내역':'모의 구매 내역')+'</span>','orders'+origin,'mall-tool')+link(icon('cart')+(window.FarmTrial?.on?'<span class="mall-cart-label" aria-hidden="true">장바구니</span>':'')+'<span class="mall-counter" data-count="'+cartQty+'" aria-hidden="true">'+(cartQty>99?'99+':cartQty)+'</span><span class="mall-sr">장바구니, 담은 수량 '+cartQty+'개</span>','cart'+origin,'mall-tool mall-cart-tool')+'</div></header>'+
      '<label class="mall-search">'+icon('search')+'<input type="search" aria-label="상품 검색" autocomplete="off" placeholder="어떤 농장 용품을 찾으세요?" value="'+esc(f.query)+'"></label>'+top+
      (store?link('‹ 입점 매장 전체 보기','shop'+origin,'mall-text-link mall-all-stores'):'')+'<div class="mall-results">'+catalog(f,opts,origin)+'</div>';
  }
  function stepper(q,id,cart=false){
    const attr='data-sku="'+id+'"',name=products[id].name,act=cart?'cart':'detail';
    return '<div class="mall-stepper">'+button(icon('minus'),act+'-minus','',attr+' aria-label="'+name+' 수량 줄이기" '+(q<=1?'disabled':''))+'<output aria-label="'+name+' 수량">'+q+'개</output>'+button(icon('plus'),act+'-plus','',attr+' aria-label="'+name+' 수량 늘리기" '+(q>=99?'disabled':''))+'</div>';
  }
  function product(route,id,opts,origin){
    const item=products[id];if(!Object.hasOwn(products,id))return empty('상품을 찾을 수 없어요',origin);
    const q=quantities.get(scopeOf(opts)+'|'+route)||1;
    return '<div class="mall-detail"><div class="mall-detail-image">'+img(id,opts.assetBase)+'</div><div class="mall-detail-copy">'+link(logo(item.store,'mall-logo-sm')+'<span>'+esc(stores[item.store].name)+'<small>가상 매장</small></span><b aria-hidden="true">›</b>','shop/store/'+item.store+origin,'mall-store-link')+'<h1>'+esc(item.name)+'</h1><div class="mall-detail-price"><strong>'+price(item.price)+'</strong><small class="mall-unit">/ '+esc(item.unit)+'</small>'+moneyNote(item)+'</div><p class="mall-description">'+esc(item.description)+'</p>'+
      '<div class="mall-quantity"><strong>수량</strong>'+stepper(q,id)+'</div><div class="mall-actions">'+button('장바구니 담기','add-detail','mall-soft','data-sku="'+id+'"')+button('바로 모의 구매','direct','mall-primary','data-sku="'+id+'"')+'</div>'+link('장바구니 보기','cart'+origin,'mall-text-link')+'</div></div>';
  }
  const sumBlock=(label,value)=>'<div class="mall-total"><span>'+label+'</span><strong>'+price(value)+'</strong></div>';
  function empty(title,origin,action='쇼핑 계속하기'){
    return '<div class="mall-empty">'+icon('bag')+'<h2>'+title+'</h2>'+link(action,(origin?'shop/category/film':'shop')+origin,'mall-soft')+'</div>';
  }
  function cartView(state,opts,origin){
    const rows=state.cart;
    if(!rows.length)return '<h1>장바구니</h1>'+empty('장바구니가 비어 있어요',origin);
    return '<h1>장바구니</h1><div class="mall-columns"><div class="mall-cart-list">'+rows.map(r=>{const item=products[r.product];return '<article class="mall-cart-row">'+link(img(r.product,opts.assetBase)+'<span class="mall-sr">'+esc(item.name)+' 상세 보기</span>',productLink(r.product,origin),'mall-thumb')+'<div><p class="mall-row-store">'+esc(stores[item.store].name)+'</p><h2>'+link(item.name,productLink(r.product,origin))+'</h2><p>개당 '+price(item.price)+'</p>'+moneyNote(item)+stepper(r.qty,r.product,true)+'</div>'+button('삭제','remove','mall-remove','data-sku="'+r.product+'" aria-label="'+item.name+' 삭제"')+'</article>';}).join('')+'</div>'+
      '<aside class="mall-summary">'+sumBlock('합계',model.total(model.snapshot(rows)))+button('주문하기','checkout-cart','mall-primary mall-full')+'</aside></div>';
  }
  function orderLines(items,opts){
    return '<div class="mall-order-lines">'+items.map(r=>'<div class="mall-line">'+img(r.product,opts.assetBase,'mall-small-thumb')+'<div><strong>'+esc(r.name)+'</strong><p>'+esc(storeOf(r))+' · 개당 '+price(r.unitPrice)+' · '+r.qty+'개</p>'+moneyNote(r)+'</div><b>'+price(r.unitPrice*r.qty)+'</b></div>').join('')+'</div>';
  }
  // 영수증: 주문 시점 snapshot을 매장별로 묶는다(가격·이름은 주문 때 값 그대로).
  function byStore(items){
    const groups=new Map();
    for(const r of items){const k=storeOf(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
    return [...groups].map(([name,rows])=>({name,rows,sum:rows.reduce((n,r)=>n+r.unitPrice*r.qty,0)}));
  }
  const orderNo=id=>'SIM-'+String(id).replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase();
  function receiptText(o){
    const lines=['[농사처방 농장 용품] 모의 영수증','실제 결제·배송이 없는 시연용 영수증이에요.','',
      '주문번호 '+orderNo(o.id),'일시 '+orderDate(o.createdAt),'배송지 '+address,'결제수단 '+(o.method?o.method+' · ':'')+'모의 결제',''];
    // 메일 앱 링크 길이 제한(약 2,000자) 때문에 품목은 매장당 3줄까지만 적고 나머지는 개수로 줄인다.
    for(const g of byStore(o.items)){
      lines.push('■ '+g.name);
      for(const r of g.rows.slice(0,3))lines.push('- '+r.name+' '+r.qty+'개 '+price(r.unitPrice*r.qty));
      if(g.rows.length>3)lines.push('- 외 '+(g.rows.length-3)+'개 품목');
      lines.push('  소계 '+price(g.sum),'');
    }
    lines.push('모의 구매 합계 '+price(o.total));
    return lines.join('\n');
  }
  function mailSheet(o){
    const href='mailto:?subject='+encodeURIComponent('[농사처방] 모의 영수증 '+orderNo(o.id))+'&body='+encodeURIComponent(receiptText(o));
    return '<dialog class="mall-mail" aria-labelledby="mall-mail-title"><form method="dialog" class="mall-mail-form" novalidate>'+
      '<h2 id="mall-mail-title">메일로 영수증 보내기</h2>'+
      '<div class="mall-mail-ask"><p class="mall-mail-note">시연용이에요. 실제로 메일을 보내지 않고 보낸 것으로 표시만 해요. 입력한 주소는 저장하지 않아요.</p>'+
      '<label for="mall-mail-to">받는 메일 주소</label><input id="mall-mail-to" type="email" inputmode="email" autocomplete="off" placeholder="name@example.com" aria-describedby="mall-mail-error">'+
      '<p class="mall-mail-error" id="mall-mail-error" role="alert"></p>'+
      '<div class="mall-mail-actions">'+button('취소','mail-close','mall-soft')+button('보내기','mail-send','mall-primary')+'</div></div>'+
      '<div class="mall-mail-done" hidden><span class="mall-check">'+icon('check')+'</span><p class="mall-mail-result" role="status"></p>'+
      '<p class="mall-mail-note">실제 메일로 받아 보려면 메일 앱에서 받는 사람을 적고 직접 보내세요.</p>'+
      '<a class="mall-soft mall-full" href="'+esc(href)+'">메일 앱으로 직접 보내기</a>'+
      '<div class="mall-mail-actions">'+button('다른 주소로','mail-again','mall-soft')+button('닫기','mail-close','mall-primary')+'</div></div>'+
      '</form></dialog>';
  }
  // 261127 허간 '쇼핑에 카드 등록'(체험본만): 시연용 가상 카드만 고른다. 실제 카드 번호·유효기간·CVC 입력칸은 만들지 않는다.
  const CARDS=[{id:'nh',label:'가상 농협카드',last4:'4821'},{id:'kb',label:'가상 국민카드',last4:'3107'}];
  const cardKey=()=>(window.FarmTrial?.ns||'')+'mall-card';
  function myCard(){if(!window.FarmTrial?.on)return null;try{const c=JSON.parse(localStorage.getItem(cardKey())||'null');return CARDS.find(x=>x.id===c?.id)||null;}catch{return null;}}
  const cardName=c=>c.label+' •••• '+c.last4;
  function payBox(){
    if(!window.FarmTrial?.on)return '<p class="mall-method">'+icon('check')+'모의 결제</p>';
    const c=myCard();
    return c?'<div class="mall-card-row"><p class="mall-method">'+icon('check')+esc(cardName(c))+'</p><button type="button" class="mall-soft mall-card-change" data-mall-action="card-open">카드 바꾸기</button></div>'
      :'<div class="mall-card-row"><p class="mall-card-none">등록한 결제 카드가 없어요</p><button type="button" class="mall-soft mall-card-change" data-mall-action="card-open">결제 카드 등록</button></div>';
  }
  function cardDialog(el,done){
    let d=document.getElementById('mall-card-sheet');
    if(!d){d=document.createElement('dialog');d.id='mall-card-sheet';d.className='mall-card-sheet';d.setAttribute('aria-labelledby','mall-card-title');document.body.append(d);}
    const c=myCard();
    d.innerHTML='<form method="dialog" class="mall-card-form"><h2 id="mall-card-title">결제 카드 등록</h2><p class="mall-card-note">시연용 가상 카드예요. 실제 카드 번호는 받지 않고, 실제 결제도 하지 않아요.</p>'+
      '<fieldset><legend class="sr">카드 고르기</legend>'+CARDS.map((x,i)=>'<label class="mall-card-option"><input type="radio" name="card" value="'+x.id+'"'+((c?c.id===x.id:i===0)?' checked':'')+'><span class="mall-card-face" data-card="'+x.id+'"><b>'+esc(x.label)+'</b><small>•••• '+x.last4+'</small></span></label>').join('')+'</fieldset>'+
      '<p class="mall-card-error" role="alert"></p><div class="mall-card-actions">'+(c?'<button type="button" class="mall-soft" data-card="remove">등록 지우기</button>':'')+'<button type="button" class="mall-soft" data-card="cancel">취소</button><button type="submit" class="mall-primary" data-card="save">'+(c?'이 카드로 바꾸기':'등록하기')+'</button></div></form>';
    const err=m=>{d.querySelector('.mall-card-error').textContent=m;};
    d.querySelector('[data-card="cancel"]').onclick=()=>d.close();
    d.querySelector('[data-card="remove"]')?.addEventListener('click',()=>{try{localStorage.removeItem(cardKey());}catch{err('지우지 못했어요. 다시 눌러 주세요.');return;}d.close();done('등록한 카드를 지웠어요.');});
    d.querySelector('form').onsubmit=e=>{e.preventDefault();const id=d.querySelector('input[name="card"]:checked')?.value;const x=CARDS.find(c=>c.id===id);if(!x)return;
      try{localStorage.setItem(cardKey(),JSON.stringify({id:x.id,at:new Date().toISOString()}));}catch{err('이 기기에 저장하지 못했어요. 다시 눌러 주세요.');return;}
      d.close();done(cardName(x)+'를 결제 카드로 등록했어요.');};
    d.addEventListener('close',()=>setTimeout(()=>el.querySelector('[data-mall-action="card-open"]')?.focus({preventScroll:true}),0),{once:true});
    d.showModal();d.querySelector('input:checked')?.focus();
  }
  function checkout(state,id,opts,origin){
    const draft=Object.hasOwn(state.drafts,id)&&state.drafts[id];
    if(!draft){
      const paid=Object.hasOwn(state.orders,id);
      return '<h1>모의 주문서</h1><div class="mall-empty"><h2>'+(paid?'이미 모의 결제를 마쳤어요':'주문할 상품을 확인해 주세요')+'</h2>'+link(paid?'영수증 보기':'장바구니 보기',(paid?'receipt/'+id:'cart')+origin,'mall-primary')+'</div>';
    }
    return '<h1>모의 주문서</h1><div class="mall-columns"><div><section class="mall-info"><h2>배송지</h2><p>'+address+'</p></section><section class="mall-info"><h2>주문 상품</h2>'+orderLines(draft.items,opts)+'</section></div>'+
      '<aside class="mall-summary"><h2>결제 수단</h2>'+payBox()+sumBlock('모의 구매 합계',draft.total)+button(myCard()?'가상 카드로 모의 결제하기':'모의 결제하기','pay','mall-primary mall-full','data-order="'+esc(id)+'"')+'</aside></div>';
  }
  function completed(state,id,origin){
    const o=Object.hasOwn(state.orders,id)&&state.orders[id];
    if(!o)return '<h1>주문 완료</h1>'+empty('확인할 주문이 없어요',origin);
    return '<div class="mall-complete"><span class="mall-check">'+icon('check')+'</span><h1>모의 주문을 마쳤어요</h1><p>'+o.items.length+'개 품목 · 총 '+count(o.items)+'개</p>'+sumBlock('모의 구매 합계',o.total)+link('영수증 보기','receipt/'+id+origin,'mall-primary mall-full')+'</div>';
  }
  const orderDate=s=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
  function receipt(state,id,opts,origin){
    const o=Object.hasOwn(state.orders,id)&&state.orders[id];
    if(!o)return '<h1>모의 영수증</h1><div class="mall-empty"><p>구매 내역에서 영수증을 선택해 주세요.</p>'+link('모의 구매 내역 보기','orders'+origin,'mall-primary')+'</div>';
    const fact=(k,v)=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>';
    return '<h1>모의 영수증</h1><div class="mall-receipt">'+
      '<header class="mall-receipt-head"><p class="mall-receipt-brand">농사처방 · 농장 용품</p><p class="mall-receipt-tag">모의 영수증 · 실제 거래 아님</p></header>'+
      '<dl class="mall-receipt-facts">'+fact('주문번호',orderNo(o.id))+fact('일시',orderDate(o.createdAt))+fact('배송지',address)+fact('결제수단',o.method?esc(o.method)+' · 모의 결제':'모의 결제')+'</dl>'+
      byStore(o.items).map(g=>'<section class="mall-receipt-store"><h2>'+esc(g.name)+' <small>가상 매장</small></h2>'+
        g.rows.map(r=>'<div class="mall-receipt-row"><span>'+esc(r.name)+'<small>'+price(r.unitPrice)+' × '+r.qty+'개</small></span><b>'+price(r.unitPrice*r.qty)+'</b></div>').join('')+
        '<div class="mall-receipt-sub"><span>매장 소계</span><b>'+price(g.sum)+'</b></div></section>').join('')+
      '<div class="mall-receipt-total"><span>모의 구매 합계</span><strong>'+price(o.total)+'</strong></div>'+
      '<p class="mall-receipt-foot">시연용 가상 가격이에요. 실제 결제와 배송은 없어요.</p></div>'+
      (window.FarmTrial?.on?'<div class="mall-receipt-actions">'+link('모의 구매 내역 보기','orders'+origin,'mall-primary mall-full')+'</div>':'<div class="mall-receipt-actions">'+button(icon('mail')+'메일로 영수증 보내기','mail-open','mall-primary mall-full')+link('모의 구매 내역 보기','orders'+origin,'mall-soft mall-full')+'</div>')+(window.FarmTrial?.on?'':mailSheet(o));
  }
  function orderList(state,origin){
    const rows=Object.values(state.orders).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    // 261127 허간: 구매 내역 카드형(체험본). 상품 사진 썸네일 · 날짜 · 모의 결제 완료 · 합계 · 영수증 보기
    if(window.FarmTrial?.on){
      const when=s=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
      const card=o=>{const thumbs=o.items.slice(0,3).map(r=>'<span class="moc-thumb">'+img(r.product,'','moc-img')+'</span>').join('')+(o.items.length>3?'<span class="moc-more">+'+(o.items.length-3)+'</span>':'');
        return '<li>'+link('<span class="moc-top"><span class="moc-date">'+when(o.createdAt)+'</span><span class="moc-chip">모의 결제 완료</span></span>'+
          '<span class="moc-body"><span class="moc-thumbs">'+thumbs+'</span><span class="moc-text"><strong>'+esc(o.items[0].name)+(o.items.length>1?' 외 '+(o.items.length-1)+'개':'')+'</strong><small>총 '+count(o.items)+'개'+(o.method?' · '+esc(String(o.method).replace(/ ••••.*$/,'')):'')+'</small></span></span>'+
          '<span class="moc-foot"><b>'+price(o.total)+'</b><span>영수증 보기 <i aria-hidden="true">›</i></span></span>','receipt/'+o.id+origin,'mall-order-card')+'</li>';};
      return '<div class="moc-head"><h1>모의 구매 내역</h1><p>'+(rows.length?'주문 '+rows.length+'건 · 실제 결제와 배송은 없어요':'실제 결제와 배송은 없어요')+'</p></div>'+
        (rows.length?'<ul class="mall-history mall-orders">'+rows.map(card).join('')+'</ul>'+link('쇼핑 계속하기',(origin?'shop/category/film':'shop')+origin,'mall-soft mall-full moc-more-shop'):empty('아직 구매한 물품이 없어요',origin));
    }
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
    // 메일 영수증(시연): 주소는 화면에만 쓰고 저장·전송하지 않는다.
    const sheet=el.querySelector('.mall-mail');
    function mail(action){
      const ask=sheet?.querySelector('.mall-mail-ask'),done=sheet?.querySelector('.mall-mail-done'),input=sheet?.querySelector('input'),error=sheet?.querySelector('.mall-mail-error');
      if(!sheet)return;
      if(action==='mail-open'){if(sheet.open)return;ask.hidden=false;done.hidden=true;input.value='';error.textContent='';input.removeAttribute('aria-invalid');sheet.showModal();input.focus();return;}
      if(action==='mail-close'){sheet.close();return;}
      if(action==='mail-again'){ask.hidden=false;done.hidden=true;input.value='';error.textContent='';input.focus();return;}
      if(action==='mail-send'){
        if(ask.hidden)return;   // 이미 보낸 상태에서 Enter·연속 클릭은 무시
        const v=input.value.trim();
        if(!v||!input.checkValidity()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){error.textContent='메일 주소를 name@example.com 모양으로 적어 주세요.';input.setAttribute('aria-invalid','true');input.focus();return;}
        input.removeAttribute('aria-invalid');error.textContent='';
        ask.hidden=true;done.hidden=false;
        sheet.querySelector('.mall-mail-result').textContent=v+' 주소로 보낸 것으로 표시했어요. 시연용이라 실제로 발송하지 않았어요.';
        input.value='';
        sheet.querySelector('[data-mall-action="mail-close"]:not(.mall-soft)')?.focus();
      }
    }
    if(sheet){
      sheet.querySelector('form').addEventListener('submit',e=>{e.preventDefault();if(!sheet.querySelector('.mall-mail-ask').hidden)mail('mail-send');});
      // 브라우저가 닫힌 뒤 초점을 되돌리는 동작보다 늦게 실행되도록 다음 틱에서 버튼으로 돌린다.
      sheet.addEventListener('close',()=>{sheet.querySelector('input').value='';setTimeout(()=>el.querySelector('[data-mall-action="mail-open"]')?.focus({preventScroll:true}),0);});
      sheet.addEventListener('click',e=>{const b=e.target.closest('[data-mall-action^="mail-"]');if(b){e.stopPropagation();mail(b.dataset.mallAction);}});
    }
    el.addEventListener('input',e=>{if(!e.target.matches('.mall-search input'))return;getFilters(route,opts).query=e.target.value;updateResults();});
    el.addEventListener('click',async e=>{
      const a=e.target.closest('[data-mall-go],[data-mall-action]');if(!a||!el.contains(a)||a.disabled)return;
      if(a.hasAttribute('data-mall-go')){
        if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
        e.preventDefault();navigate(route,a.dataset.mallGo,opts);return;
      }
      const action=a.dataset.mallAction,sku=a.dataset.sku,qkey=scope+'|'+route,q=quantities.get(qkey)||1;
      if(action.startsWith('mail-')){mail(action);return;}
      if(action==='card-open'){cardDialog(el,msg=>{if(el.isConnected)paint('[data-mall-action="card-open"]',msg);});return;}
      if(action==='category'||action==='reset'){
        const f=getFilters(route,opts);f.category=action==='reset'?(f.store||'all'):a.dataset.category;   // 매장 화면의 '전체 보기'는 그 매장 상품으로
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
          const c=myCard(),order=await model.pay(id,scope,c?cardName(c):undefined);if(el.isConnected)navigate(route,'order-complete/'+order.id+origin,opts);
        }
      }catch(err){info(err?.message?.includes('주세요')||err?.message?.includes('있어요')?err.message:'저장하지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.');}
      finally{if(busy&&el.isConnected){delete el.dataset.busy;a.disabled=false;}}
    });
  }
  window.FarmMall={isRoute,view,bind,backTarget,backLabel,resetEntry};
})();
