/* Farm-wide local model for both mockup surfaces. Each order stores its own immutable line prices. */
(() => {
  'use strict';
  const products={
    hose:{name:'배수 호스',price:18000,category:'drain',description:'물이 고인 곳에서 물을 다른 곳으로 흘려보낼 때 쓰는 호스예요.'},
    gloves:{name:'방수 장갑',price:6000,category:'safety',description:'젖은 물건을 옮기거나 정리할 때 손에 끼는 작업용 장갑이에요.'},
    tape:{name:'비닐 보수 테이프',price:8000,category:'film',virtual:true,description:'하우스 비닐의 작은 찢김을 덧붙여 보수할 때 쓰는 테이프예요.'},
    film:{name:'하우스용 비닐(소량)',price:15000,category:'film',virtual:true,description:'비닐 일부를 덧대거나 교체할 때 쓰는 소량 포장 비닐이에요.'},
    connector:{name:'양수기용 호스 연결구',price:4500,category:'drain',virtual:true,description:'호스와 양수기 사이를 연결할 때 사용하는 부품이에요.'},
    boots:{name:'작업용 장화',price:22000,category:'safety',virtual:true,description:'젖은 통로나 농장 주변을 오갈 때 신는 작업용 장화예요.'}
  };
  for(const [id,p] of Object.entries(products))p.image='assets/mall/'+id+'.webp';
  const price=n=>n.toLocaleString('ko-KR')+'원';
  const newId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const key=scope=>'damyang-261123-v11-mall/'+scope;
  const storage=scope=>scope.startsWith('preview-')?sessionStorage:localStorage;
  const validQty=n=>Number.isInteger(n)&&n>=1&&n<=99;
  const imageItems=()=>[{product:'hose',qty:2},{product:'gloves',qty:1}];
  const snapshot=cart=>cart.map(({product,qty})=>({product,qty,name:products[product].name,unitPrice:products[product].price,virtual:!!products[product].virtual}));
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
    return raw?JSON.parse(raw):initial(scope);
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
  window.FarmShop={products,price,read,add,adjust,begin,pay,getOrder,orders,snapshot,total};
})();
