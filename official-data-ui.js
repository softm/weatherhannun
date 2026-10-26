"use strict";
(function(){
  function init(){
    var gate=window.WeatherProviderCore&&window.WeatherProviderCore.releaseReadiness();
    var status=document.getElementById("officialMapLayerStatus");
    if(!status)return;
    if(!gate){
      status.textContent="공식 자료 연결 상태를 확인하지 못했습니다. 기상청 원문에서 직접 확인하세요.";
      status.dataset.state="error";
      return;
    }
    var reasons=[gate.officialWarnings.reason,gate.radar.reason].filter(Boolean);
    status.textContent=reasons.join(" ");
    status.dataset.state=gate.officialWarnings.available&&gate.radar.available?"ready":"unavailable";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
