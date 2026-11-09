/* Startup weather briefing view model. Model forecasts only; never claims observation or official warning. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherStartupBriefingCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function text(value,fallback){return typeof value==="string"&&value.trim()?value.trim():fallback;}
  function localDayKey(value){
    const date=value instanceof Date?value:new Date(value);
    if(Number.isNaN(date.getTime()))return null;
    const pad=number=>String(number).padStart(2,"0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function dayKey(briefing){
    const value=briefing&&briefing.validAt;
    return value?localDayKey(value):null;
  }
  function build(payload,briefingApi){
    const briefing=briefingApi&&typeof briefingApi.analyse==="function"?briefingApi.analyse(payload):null;
    if(!briefing||!briefing.valid)return {valid:false};
    const events=Array.isArray(briefing.events)?briefing.events.slice(0,2):[];
    const evidence=Array.isArray(briefing.evidence)?briefing.evidence.slice(0,3):[];
    const caution=events.some(event=>event&&event.severity==="caution");
    return {
      valid:true,
      dayKey:dayKey(briefing),
      where:text(briefing.where,"선택 지역"),
      eyebrow:caution?"오늘 먼저 확인하세요":"오늘의 날씨 인사이트",
      title:text(briefing.headline,"오늘 날씨 브리핑"),
      summary:text(briefing.short,"시간별 예보에서 오늘의 변화를 확인하세요."),
      tone:caution?"caution":"calm",
      icon:caution?"notifications_active":"auto_awesome",
      events:events.map(event=>({icon:text(event.icon,"•"),title:text(event.title,"예보 변화"),time:briefingApi.dateText(event.time),evidence:text(event.evidence,"수치 확인 필요")})),
      evidence:evidence.map(item=>({label:text(item.label,"예보 항목"),value:text(item.value,"정보 없음")})),
      source:text(briefing.source,"기상청 공식 예보")
    };
  }
  function shouldShow(state){
    return Boolean(state&&state.valid&&state.actionable&&state.dayKey&&state.todayKey&&state.dayKey===state.todayKey&&state.shownDay!==state.todayKey&&state.dismissedDay!==state.todayKey&&!state.blockingDialogOpen);
  }
  return Object.freeze({build,shouldShow,dayKey,localDayKey});
});
