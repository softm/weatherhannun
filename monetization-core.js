/* WH-P01/WH-P02 storefront policy. Prices and entitlements must come from Google Play. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherHannunMonetization=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CONTRACT_VERSION="WH-BILLING-v1";
  const PLAN_IDS=Object.freeze(["free","plus","agriculture"]);
  const text=(value,max=180)=>typeof value==="string"?value.trim().slice(0,max):"";
  function parseState(raw){
    let value=raw;
    if(typeof raw==="string"){
      try{value=JSON.parse(raw);}catch(_){value=null;}
    }
    value=value&&typeof value==="object"?value:{};
    const products=Array.isArray(value.products)?value.products.reduce((result,item)=>{
      const plan=text(item&&item.plan,32);
      if(!PLAN_IDS.includes(plan)||plan==="free")return result;
      result[plan]=Object.freeze({
        plan,
        productId:text(item.productId,128),
        available:item.available===true,
        price:text(item.price,80),
        billingPeriod:text(item.billingPeriod,24),
        hasIntroOffer:item.hasIntroOffer===true
      });
      return result;
    },{}):{};
    const entitlements=Array.isArray(value.entitlements)?value.entitlements.filter(id=>PLAN_IDS.includes(id)&&id!=="free"):[];
    const blockers=Array.isArray(value.blockers)?value.blockers.map(item=>text(item)).filter(Boolean):[];
    return Object.freeze({
      contractVersion:text(value.contractVersion,40),
      enabled:value.enabled===true,
      connected:value.connected===true,
      resolved:value.resolved===true,
      status:text(value.status,240),
      adFree:value.adFree===true,
      lastCheckedAt:text(value.lastCheckedAt,60),
      products:Object.freeze(products),
      entitlements:Object.freeze([...new Set(entitlements)]),
      blockers:Object.freeze([...new Set(blockers)])
    });
  }
  function evaluate(raw,{nativeAvailable=false,releaseReadiness=null}={}){
    const state=parseState(raw);
    const releaseAllowed=releaseReadiness?.subscriptions?.allowed===true;
    const releaseBlockers=Array.isArray(releaseReadiness?.subscriptions?.blockers)?releaseReadiness.subscriptions.blockers.map(item=>text(item)).filter(Boolean):[];
    const blockers=[];
    if(!nativeAvailable)blockers.push("Android 앱에서만 Google Play 구매·복원을 지원합니다.");
    if(!releaseAllowed)blockers.push(...releaseBlockers);
    blockers.push(...state.blockers);
    if(nativeAvailable&&state.enabled&&!state.connected)blockers.push("Google Play 연결이 준비되지 않았습니다.");
    const plans={};
    PLAN_IDS.forEach(plan=>{
      const entitled=plan==="free"||state.entitlements.includes(plan)||
        (plan==="plus"&&state.entitlements.includes("agriculture"));
      const product=state.products[plan]||null;
      plans[plan]=Object.freeze({
        entitled,
        product,
        purchasable:plan!=="free"&&nativeAvailable&&releaseAllowed&&state.enabled&&state.connected&&!!product?.available&&!!product?.productId
      });
    });
    return Object.freeze({state,plans:Object.freeze(plans),blockers:Object.freeze([...new Set(blockers)])});
  }
  return Object.freeze({CONTRACT_VERSION,PLAN_IDS,parseState,evaluate});
});
