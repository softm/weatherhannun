(function(){
  "use strict";
  const core=window.WeatherHannunPlusPersonalization;
  const STORAGE="weatherhannun:plus-personalization:v1";
  let membership=null,activePriority=[];
  const element=id=>document.getElementById(id);
  function releaseAllowed(){
    try{return window.WeatherProviderCore?.releaseReadiness?.().subscriptions?.allowed===true;}catch(_){return false;}
  }
  function usable(){return membership?.plans?.plus?.entitled===true&&releaseAllowed();}
  function read(){
    try{return JSON.parse(localStorage.getItem(STORAGE)||"null")||{};}catch(_){return {};}
  }
  function write(value){try{localStorage.setItem(STORAGE,JSON.stringify(value));}catch(_){}}
  function selectedPriority(){return core.normalizePriority([...document.querySelectorAll(".plus-activity-priorities input:checked")].map(input=>input.value));}
  function dispatchPriority(priority){
    activePriority=usable()?core.normalizePriority(priority):[];
    window.dispatchEvent(new CustomEvent("weatherhannun:activity-priority",{detail:{version:core.VERSION,activities:activePriority}}));
  }
  function restore(){
    const saved=read(),profile=element("plusAlertProfile");
    if(profile&&core.PROFILES[saved.profile])profile.value=saved.profile;
    const priority=core.normalizePriority(saved.activities?.length?saved.activities:["walk","laundry","harvest"]);
    document.querySelectorAll(".plus-activity-priorities input").forEach(input=>{input.checked=priority.includes(input.value);});
    dispatchPriority(priority);
  }
  function render(){
    const controls=element("plusPersonalizationControls"),badge=element("plusPersonalizationBadge"),status=element("plusPersonalizationStatus");
    if(controls)controls.disabled=!usable();
    if(badge)badge.textContent=usable()?"사용 가능":membership?.plans?.plus?.entitled?"데이터 권리 필요":"Plus";
    if(status){
      if(usable())status.textContent="프리셋은 기존 무료 알림 조건에 값을 채웁니다. 확인 후 ‘알림 조건 저장’을 눌러야 Android 백그라운드 알림에 반영됩니다.";
      else if(membership?.plans?.plus?.entitled)status.textContent="Plus 권한은 확인됐지만 상업 데이터 이용권 게이트가 닫혀 있어 개인화 프로필을 적용하지 않습니다.";
      else status.textContent="검증된 Plus 권한과 상업 데이터 이용권이 준비되면 사용할 수 있습니다.";
    }
    if(usable())restore();else dispatchPriority([]);
  }
  function applyProfile(){
    if(!usable())return render();
    const id=element("plusAlertProfile")?.value||"commute",profile=core.profile(id),mapping={
      watchRain:profile.watchRain,watchDry:profile.watchDry,watchClear:profile.watchClear,watchFrost:profile.watchFrost,watchWind:profile.watchWind
    };
    Object.entries(mapping).forEach(([field,value])=>{if(element(field))element(field).checked=value;});
    if(element("rainThreshold"))element("rainThreshold").value=String(profile.rainThreshold);
    if(element("dryThreshold"))element("dryThreshold").value=String(profile.dryThreshold);
    if(element("clearHours"))element("clearHours").value=String(profile.clearHours);
    const priority=selectedPriority();
    write({version:core.VERSION,profile:id,activities:priority});dispatchPriority(priority);
    const status=element("plusPersonalizationStatus");
    if(status)status.textContent=`${profile.label} 프리셋을 화면에 적용했습니다. 아래 ‘알림 조건 저장’을 눌러 확정하세요.`;
  }
  function bind(){
    if(!element("plusPersonalization")||!core)return;
    membership=window.WeatherHannunMembership?.current?.()||null;
    document.querySelectorAll(".plus-activity-priorities input").forEach(input=>input.addEventListener("change",function(){
      const checked=[...document.querySelectorAll(".plus-activity-priorities input:checked")];
      if(checked.length<=3)return;
      this.checked=false;
      const status=element("plusPersonalizationStatus");if(status)status.textContent="TOP 3 우선 활동은 최대 3개까지 선택할 수 있습니다.";
    }));
    element("plusPersonalizationApply")?.addEventListener("click",applyProfile);
    render();
  }
  window.WeatherHannunPlusPreferences={currentPriority:function(){return activePriority.slice();}};
  window.addEventListener("weatherhannun:membership",event=>{membership=event.detail||null;render();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
