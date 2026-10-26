(function(){
  "use strict";
  const STORAGE_KEY="weatherhannun:local-metrics:v1";
  let state=null;
  let sessionRecorded=false;
  const element=id=>document.getElementById(id);
  function today(){
    try{return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  }
  function load(){
    let raw=null;try{raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");}catch(_){}
    state=window.WeatherHannunMetricsCore.normalize(raw,today());
    return state;
  }
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){}render();}
  function record(event){
    state=window.WeatherHannunMetricsCore.record(state,event,today());save();
  }
  function percent(value){return typeof value==="number"&&Number.isFinite(value)?Math.round(value*100)+"%":"측정 전";}
  function render(){
    if(!state||!element("productMetricsConsent"))return;
    const summary=window.WeatherHannunMetricsCore.summary(state,today());
    element("productMetricsConsent").checked=summary.consent;
    element("productMetricsStatus").textContent=summary.consent?
      "이 기기의 일별 횟수만 최대 35일 저장합니다. 서버로 전송하지 않아 전체 사용자 KPI는 아직 측정하지 않습니다.":
      "기본 OFF입니다. 동의 전에는 품질 이벤트를 저장하지 않습니다.";
    element("metricSessions").textContent=String(summary.sessions);
    element("metricForecastRate").textContent=percent(summary.forecastSuccessRate);
    element("metricActionRate").textContent=percent(summary.actionUseRate);
    element("metricActiveDays").textContent=String(summary.activeDays);
    element("productMetricsReset").disabled=!summary.consent&&summary.sessions===0;
  }
  function recordSession(){
    if(sessionRecorded||!state?.consent)return;
    sessionRecorded=true;record("today_open");
  }
  function bind(){
    if(!window.WeatherHannunMetricsCore||!element("productMetricsConsent"))return;
    load();recordSession();render();
    element("productMetricsConsent").addEventListener("change",function(){
      state=window.WeatherHannunMetricsCore.setConsent(state,this.checked,today());
      sessionRecorded=false;save();recordSession();
    });
    element("productMetricsReset").addEventListener("click",function(){
      state=window.WeatherHannunMetricsCore.empty(today());sessionRecorded=false;save();
    });
    document.addEventListener("click",event=>{
      if(event.target.closest(".rain-decision-link"))record("rain_card_open");
      else if(event.target.closest(".outfit-decision-link"))record("outfit_open");
      else if(event.target.closest("#homeWidgetAdd"))record("widget_added");
      else if(event.target.closest("#homeWidgetSync"))record("widget_refresh");
      else if(event.target.closest("#saveWatch"))record("alert_saved");
    });
    element("screenWeatherEnabled")?.addEventListener("change",function(){record(this.checked?"overlay_enabled":"overlay_disabled");});
    window.addEventListener("weatherhannun:view",event=>{
      if(event.detail?.view==="hourly")record("hourly_open");
      if(event.detail?.view==="activity")record("activity_open");
    });
    window.addEventListener("weatherhannun:location-applied",()=>record("location_changed"));
    window.addEventListener("weatherhannun:forecast-result",event=>record(event.detail?.ok?"forecast_success":"forecast_error"));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
