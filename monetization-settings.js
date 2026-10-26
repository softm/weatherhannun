(function(){
  "use strict";
  let nativeState=null;
  let currentView=null;
  const element=id=>document.getElementById(id);
  function bridge(){
    const candidate=window.WeatherHannunAndroid;
    return candidate&&typeof candidate.billingState==="function"?candidate:null;
  }
  function readiness(){
    try{return window.WeatherProviderCore?.releaseReadiness?.()||null;}catch(_){return null;}
  }
  function periodLabel(value){
    return ({P1W:"주",P1M:"월",P3M:"3개월",P6M:"6개월",P1Y:"년"})[value]||value||"";
  }
  function readNative(){
    const android=bridge();
    if(!android){nativeState=null;render();return;}
    try{nativeState=window.WeatherHannunMonetization.parseState(android.billingState());}
    catch(_){nativeState=null;}
    render();
  }
  function render(){
    if(!element("membershipSettings")||!window.WeatherHannunMonetization)return;
    const android=bridge();
    const view=window.WeatherHannunMonetization.evaluate(nativeState,{nativeAvailable:!!android,releaseReadiness:readiness()});
    currentView=view;
    ["free","plus","agriculture"].forEach(plan=>{
      const card=document.querySelector(`[data-membership-plan="${plan}"]`);
      const status=card?.querySelector("[data-plan-status]");
      const price=card?.querySelector("[data-plan-price]");
      const button=card?.querySelector("[data-purchase-plan]");
      const planState=view.plans[plan];
      card?.classList.toggle("active",planState.entitled);
      if(status)status.textContent=planState.entitled?(plan==="free"?"기본 제공":"사용 중"):(plan==="free"?"기본 제공":"판매 전");
      if(price&&plan!=="free"){
        const product=planState.product;
        price.textContent=product?.price?(product.price+(product.billingPeriod?` / ${periodLabel(product.billingPeriod)}`:"")+(product.hasIntroOffer?" · 혜택은 Play에서 확인":"")):"가격 미확정 · 임의 가격을 표시하지 않음";
      }
      if(button){
        button.disabled=!planState.purchasable||planState.entitled;
        button.dataset.productId=planState.product?.productId||"";
        button.textContent=planState.entitled?"이용 중":planState.purchasable?"Google Play에서 확인":"판매 준비 중";
      }
    });
    const badge=element("membershipStatusBadge");
    const status=element("membershipStatus");
    const blockerList=element("membershipBlockers");
    if(badge)badge.textContent=view.state.entitlements.includes("agriculture")?"Premium":view.state.entitlements.includes("plus")?"Plus":view.state.enabled?(view.state.resolved?"Free":"확인 중"):"판매 전";
    if(status)status.textContent=view.state.status||(!android?"웹에서는 상품을 판매하지 않습니다. Android 앱에서 구매 상태를 확인할 수 있습니다.":"유료 판매 준비 상태를 확인하고 있습니다.");
    if(blockerList){
      blockerList.replaceChildren();
      (view.blockers.length?view.blockers:["새 구매 가능 조건을 충족했습니다."]).forEach(message=>{
        const item=document.createElement("li");item.textContent=message;blockerList.appendChild(item);
      });
    }
    const restore=element("membershipRestore");
    const manage=element("membershipManage");
    if(restore)restore.disabled=!android||!view.state.enabled;
    if(manage)manage.disabled=!android;
    window.dispatchEvent(new CustomEvent("weatherhannun:membership",{detail:view}));
  }
  function bind(){
    if(!element("membershipSettings"))return;
    document.querySelectorAll("[data-purchase-plan]").forEach(button=>button.addEventListener("click",function(){
      const productId=this.dataset.productId;
      if(!productId||this.disabled)return;
      try{bridge()?.purchasePlan?.(productId);}catch(_){}
    }));
    element("membershipRestore")?.addEventListener("click",function(){
      try{bridge()?.refreshBilling?.();this.disabled=true;element("membershipStatus").textContent="Google Play 구매 내역을 확인하고 있습니다.";}catch(_){}
    });
    element("membershipManage")?.addEventListener("click",function(){
      try{bridge()?.manageSubscriptions?.();}catch(_){}
    });
    readNative();
  }
  window.WeatherHannunBilling={
    syncWithAndroid:readNative,
    onAndroidState:function(state){nativeState=window.WeatherHannunMonetization?.parseState(state)||null;render();}
  };
  window.WeatherHannunMembership={current:function(){return currentView;}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
