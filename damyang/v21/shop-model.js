/* Farm-wide local model for both mockup surfaces. Each order stores its own immutable line prices. */
(() => {
  'use strict';
  // v21: 상품·매장 목록은 mall-catalog.js(가상 매장 4곳·80개)에서 받는다.
  const {products,stores}=window.FarmCatalog;
  const price=n=>n.toLocaleString('ko-KR')+'원';
  const newId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const key=scope=>'damyang-public-v21-mall/'+scope;
  const storage=scope=>scope.startsWith('preview-')?sessionStorage:localStorage;
  const validQty=n=>Number.isInteger(n)&&n>=1&&n<=99;
  const imageItems=()=>[{product:'hose',qty:2},{product:'gloves',qty:1}];
  const snapshot=cart=>cart.map(({product,qty})=>{const p=products[product];return {product,qty,name:p.name,unitPrice:p.price,virtual:!!p.virtual,store:p.store,storeName:stores[p.store].name};});
  const total=items=>items.reduce((n,row)=>n+row.unitPrice*row.qty,0);
  function initial(scope){
    const preview=scope.startsWith('preview-')?scope.slice(8).split(':')[0]:'';
    const cart=['cart','checkout'].includes(preview)?imageItems():[];
    const items=snapshot(preview.startsWith('legacy-')?[{product:'hose',qty:2}]:imageItems());
    const seed={id:'fixture',items,total:total(items),createdAt:'2026-11-23T01:00:00.000Z'};
    const drafts=preview==='checkout'?{fixture:{...seed,mode:'cart',revision:'initial'}}:{};
    const orders=['complete','receipt','orders','legacy-receipt','legacy-orders'].includes(preview)?{fixture:seed}:{};
    return {cart,revision:'initial',drafts,orders};
  }
  function read(scope='farm'){
    const raw=storage(scope).getItem(key(scope));
    const state=raw?JSON.parse(raw):initial(scope);
    state.cart=(Array.isArray(state.cart)?state.cart:[]).filter(row=>Object.hasOwn(products,row.product));   // 카탈로그에서 빠진 예전 상품은 장바구니에서 거른다
    return state;
  }
  function change(scope,mutate){
    const write=()=>{const state=read(scope);const result=mutate(state);storage(scope).setItem(key(scope),JSON.stringify(state));return result;};
    return navigator.locks?.request?navigator.locks.request(key(scope),write):Promise.resolve().then(write);
  }
  function add(id,qty,scope='farm'){
    return change(scope,state=>{
      if(!Object.hasOwn(products,id)||!validQty(qty))throw Error('상품과 수량을 확인해 주세요.');
      const current=state.cart.find(row=>row.product===id);
      if((current?.qty||0)+qty>99)throw Error('한 품목은 99개까지 담을 수 있어요.');
      if(current)current.qty+=qty;else state.cart.push({product:id,qty});
      state.revision=newId();
    });
  }
  function adjust(id,delta,scope='farm'){
    return change(scope,state=>{
      const row=state.cart.find(r=>r.product===id);if(!row)return;
      if(delta==='remove')state.cart=state.cart.filter(r=>r.product!==id);
      else if(validQty(row.qty+delta))row.qty+=delta;else return;
      state.revision=newId();
    });
  }
  function begin(mode,id,qty,scope='farm'){
    return change(scope,state=>{
      const cart=mode==='cart'?state.cart:[{product:id,qty}];
      if(!cart.length||cart.some(r=>!Object.hasOwn(products,r.product)||!validQty(r.qty)))throw Error('상품과 수량을 확인해 주세요.');
      const items=snapshot(cart),draft={id:newId(),items,total:total(items),mode,revision:state.revision};
      state.drafts[draft.id]=draft;return draft.id;
    });
  }
  function pay(id,scope='farm'){
    return change(scope,state=>{
      if(Object.hasOwn(state.orders,id))return state.orders[id];
      const draft=Object.hasOwn(state.drafts,id)&&state.drafts[id];
      if(!draft)throw Error('주문서를 다시 열어 주세요.');
      if(draft.mode==='cart'&&draft.revision!==state.revision)throw Error('장바구니가 바뀌었어요. 장바구니에서 다시 주문해 주세요.');
      const order={id,items:draft.items,total:draft.total,createdAt:new Date().toISOString()};
      state.orders[id]=order;delete state.drafts[id];
      if(draft.mode==='cart'){state.cart=[];state.revision=newId();}
      return order;
    });
  }
  function getOrder(id,scope='farm'){const items=read(scope).orders;return Object.hasOwn(items,id)?items[id]:null;}
  function orders(scope='farm'){return Object.values(read(scope).orders).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));}
  window.FarmShop={products,stores,price,read,add,adjust,begin,pay,getOrder,orders,snapshot,total};
})();
