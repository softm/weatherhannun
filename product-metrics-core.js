/* WH-K01 local-only measurement contract. No identifiers, coordinates, text or network transport. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherHannunMetricsCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CONTRACT_VERSION="WH-K01-local-v1";
  const ALLOWED_EVENTS=Object.freeze([
    "today_open","location_changed","rain_card_open","hourly_open","outfit_open","activity_open",
    "widget_added","widget_refresh","overlay_enabled","overlay_disabled","alert_saved",
    "forecast_success","forecast_error"
  ]);
  const DAY_PATTERN=/^\d{4}-\d{2}-\d{2}$/;
  function day(value){return DAY_PATTERN.test(String(value||""))?String(value):null;}
  function empty(today){return {version:CONTRACT_VERSION,consent:false,installedOn:day(today),days:{}};}
  function normalize(raw,today){
    const value=raw&&typeof raw==="object"?raw:{};
    const result=empty(today);
    result.consent=value.consent===true;
    result.installedOn=day(value.installedOn)||day(today);
    if(value.days&&typeof value.days==="object"){
      Object.keys(value.days).filter(day).sort().slice(-35).forEach(key=>{
        const source=value.days[key];
        if(!source||typeof source!=="object")return;
        const bucket={};
        ALLOWED_EVENTS.forEach(event=>{
          const count=Number(source[event]);
          if(Number.isInteger(count)&&count>0)bucket[event]=Math.min(count,100000);
        });
        if(Object.keys(bucket).length)result.days[key]=bucket;
      });
    }
    return result;
  }
  function setConsent(raw,consent,today){
    const state=normalize(raw,today);
    state.consent=consent===true;
    if(!state.consent)state.days={};
    return state;
  }
  function record(raw,event,today){
    const state=normalize(raw,today);
    const key=day(today);
    if(!state.consent||!key||!ALLOWED_EVENTS.includes(event))return state;
    const bucket=state.days[key]||(state.days[key]={});
    bucket[event]=Math.min(100000,(Number(bucket[event])||0)+1);
    const keys=Object.keys(state.days).sort();
    keys.slice(0,Math.max(0,keys.length-35)).forEach(old=>delete state.days[old]);
    return state;
  }
  function eventTotal(state,event){return Object.values(state.days).reduce((sum,bucket)=>sum+(Number(bucket[event])||0),0);}
  function plusDays(value,offset){
    const parsed=day(value);if(!parsed)return null;
    const date=new Date(parsed+"T00:00:00Z");date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);
  }
  function summary(raw,today){
    const state=normalize(raw,today);
    const sessions=eventTotal(state,"today_open");
    const success=eventTotal(state,"forecast_success"),failure=eventTotal(state,"forecast_error");
    const actions=eventTotal(state,"rain_card_open")+eventTotal(state,"outfit_open")+eventTotal(state,"activity_open");
    const activeDays=Object.keys(state.days).filter(key=>(state.days[key].today_open||0)>0);
    const returned=offset=>{
      const target=plusDays(state.installedOn,offset);
      return target?activeDays.includes(target):false;
    };
    return Object.freeze({
      consent:state.consent,
      installedOn:state.installedOn,
      retainedD1:returned(1),retainedD7:returned(7),retainedD30:returned(30),
      activeDays:activeDays.length,sessions,
      forecastRequests:success+failure,
      forecastSuccessRate:success+failure?success/(success+failure):null,
      actionUseRate:sessions?actions/sessions:null,
      widgetAdds:eventTotal(state,"widget_added"),
      overlayEnables:eventTotal(state,"overlay_enabled"),
      alertSaves:eventTotal(state,"alert_saved")
    });
  }
  return Object.freeze({CONTRACT_VERSION,ALLOWED_EVENTS,empty,normalize,setConsent,record,summary});
});
