(function(){
  "use strict";
  const core=window.WeatherStartupBriefingCore;
  const briefingApi=window.WeatherHannunBriefingCore;
  const dialog=document.getElementById("startupWeatherBriefing");
  if(!core||!briefingApi||!dialog)return;
  const SESSION="weatherhannun:startup-briefing:session:v1";
  const DISMISSED="weatherhannun:startup-briefing:dismissed-day:v1";
  let latest=null,timer=0,attempts=0;
  const $=id=>document.getElementById(id);
  const get=(store,key)=>{try{return store.getItem(key)||"";}catch(_){return "";}};
  const set=(store,key,value)=>{try{store.setItem(key,value);}catch(_){ }};
  function blockingDialogOpen(){return ["weatherLocationWelcome","locationDialog","renameLocationDialog"].some(id=>document.getElementById(id)?.open);}
  function render(model){
    dialog.dataset.tone=model.tone;
    $("startupBriefingIcon").textContent=model.icon;
    $("startupBriefingEyebrow").textContent=model.eyebrow;
    $("startupBriefingTitle").textContent=model.title;
    $("startupBriefingPlace").textContent=model.where;
    $("startupBriefingSummary").textContent=model.summary;
    $("startupBriefingFacts").innerHTML=model.evidence.map(item=>'<div><span>'+escapeHtml(item.label)+'</span><strong>'+escapeHtml(item.value)+'</strong></div>').join("");
    $("startupBriefingEvents").innerHTML=model.events.length?model.events.map(item=>'<div class="startup-event"><span aria-hidden="true">'+escapeHtml(item.icon)+'</span><div><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.time)+' · '+escapeHtml(item.evidence)+'</small></div></div>').join(""):'<div class="startup-event is-calm"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span><div><strong>가까운 시간의 큰 변화가 적어요</strong><small>특보가 없다는 뜻은 아니므로 외출 전 최신 예보를 다시 확인하세요.</small></div></div>';
    $("startupBriefingSource").textContent=model.source;
  }
  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
  function tryOpen(){
    clearTimeout(timer);
    const model=latest&&core.build(latest,briefingApi);
    const allowed=core.shouldShow({valid:model?.valid,dayKey:model?.dayKey,sessionSeen:get(sessionStorage,SESSION)==="shown",dismissedDay:get(localStorage,DISMISSED),blockingDialogOpen:blockingDialogOpen()});
    if(allowed&&dialog.showModal){render(model);dialog.showModal();set(sessionStorage,SESSION,"shown");attempts=0;return;}
    if(model?.valid&&blockingDialogOpen()&&attempts++<30)timer=setTimeout(tryOpen,500);
  }
  function close(){if(dialog.open)dialog.close();}
  $("startupBriefingClose")?.addEventListener("click",close);
  $("startupBriefingLater")?.addEventListener("click",close);
  $("startupBriefingDismissToday")?.addEventListener("click",()=>{const model=latest&&core.build(latest,briefingApi);if(model?.dayKey)set(localStorage,DISMISSED,model.dayKey);close();});
  $("startupBriefingDetail")?.addEventListener("click",()=>{close();document.querySelector('[data-view="today"]')?.click();setTimeout(()=>document.querySelector(".briefing-board")?.scrollIntoView({behavior:"smooth",block:"start"}),100);});
  window.addEventListener("weatherhannun:data",event=>{latest=event.detail;attempts=0;timer=setTimeout(tryOpen,450);});
})();
