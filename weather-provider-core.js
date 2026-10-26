/* 날씨한눈 데이터 공급자·출시 게이트 계약. 공개 프런트에 비밀키를 두지 않는다. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherProviderCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CONTRACT_VERSION="WH-D01-v1";
  const FORECAST_ENDPOINT="https://api.open-meteo.com/v1/forecast";
  const AIR_ENDPOINT="https://air-quality-api.open-meteo.com/v1/air-quality";
  const PROVIDER=Object.freeze({
    id:"open-meteo-free-noncommercial",
    name:"Open-Meteo",
    mode:"noncommercial_preview",
    forecastProduct:"Forecast API 모델 예보",
    airProduct:"Air Quality API 모델 예측",
    licenseLabel:"현재 비상업 무료 API 운영 모드",
    commercialRightsVerified:false,
    observationAvailable:false,
    officialWarningsAvailable:false,
    radarAvailable:false
  });
  const DEPLOYMENT_GATES=Object.freeze({
    forecastCommercialRights:false,
    airCommercialRights:false,
    reverseGeocodeCommercialRights:false,
    mapTilesCommercialRights:false,
    officialDataRights:false,
    consentFlowVerified:false,
    productionAdUnitConfigured:false,
    playBillingConfigured:false
  });
  const HOURLY_FIELDS=Object.freeze(["temperature_2m","precipitation_probability","precipitation","weather_code","wind_speed_10m","wind_gusts_10m","relative_humidity_2m","uv_index","is_day"]);
  const DAILY_FIELDS=Object.freeze(["weather_code","temperature_2m_max","temperature_2m_min","precipitation_sum","precipitation_probability_max","sunrise","sunset","uv_index_max"]);
  const finite=value=>typeof value==="number"&&Number.isFinite(value);
  function normalizeLocation(raw){
    if(!raw)return null;
    const lat=Number(raw.lat),lon=Number(raw.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    return {name:String(raw.name||"선택 지역").trim().slice(0,75)||"선택 지역",lat,lon};
  }
  function buildForecastUrl(raw,{short=false}={}){
    const location=normalizeLocation(raw);
    if(!location)return "";
    const url=new URL(FORECAST_ENDPOINT);
    url.searchParams.set("latitude",String(location.lat));
    url.searchParams.set("longitude",String(location.lon));
    url.searchParams.set("timezone","Asia/Seoul");
    if(short){
      url.searchParams.set("current","temperature_2m,weather_code,is_day");
    }else{
      url.searchParams.set("current","temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m");
      url.searchParams.set("hourly","temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index,is_day");
      url.searchParams.set("daily","weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max");
      url.searchParams.set("forecast_days","7");
    }
    return url.href;
  }
  function buildAirUrl(raw){
    const location=normalizeLocation(raw);
    if(!location)return "";
    const url=new URL(AIR_ENDPOINT);
    url.searchParams.set("latitude",String(location.lat));
    url.searchParams.set("longitude",String(location.lon));
    url.searchParams.set("current","pm10,pm2_5,us_aqi");
    url.searchParams.set("timezone","Asia/Seoul");
    return url.href;
  }
  function inspectForecastPayload(payload,{short=false}={}){
    const missing=[];
    if(!payload||typeof payload!=="object")return {valid:false,missingFields:["payload"]};
    if(!payload.current||typeof payload.current!=="object")missing.push("current");
    if(typeof payload.current?.time!=="string")missing.push("current.time");
    if(!finite(payload.current?.temperature_2m))missing.push("current.temperature_2m");
    if(!short){
      if(!payload.hourly||!Array.isArray(payload.hourly.time)||!payload.hourly.time.length)missing.push("hourly.time");
      if(!payload.daily||!Array.isArray(payload.daily.time)||!payload.daily.time.length)missing.push("daily.time");
      const hourlyLength=Array.isArray(payload.hourly?.time)?payload.hourly.time.length:0;
      const dailyLength=Array.isArray(payload.daily?.time)?payload.daily.time.length:0;
      HOURLY_FIELDS.forEach(field=>{
        const values=payload.hourly?.[field];
        if(!Array.isArray(values)||values.length!==hourlyLength)missing.push("hourly."+field);
      });
      DAILY_FIELDS.forEach(field=>{
        const values=payload.daily?.[field];
        if(!Array.isArray(values)||values.length!==dailyLength)missing.push("daily."+field);
      });
    }
    return {valid:missing.length===0,missingFields:missing};
  }
  function inspectAirPayload(payload){
    const missing=[];
    if(!payload||typeof payload!=="object")return {valid:false,missingFields:["payload"]};
    if(typeof payload.current?.time!=="string")missing.push("current.time");
    if(!finite(payload.current?.pm10))missing.push("current.pm10");
    if(!finite(payload.current?.pm2_5))missing.push("current.pm2_5");
    return {valid:missing.length===0,missingFields:missing};
  }
  function freshness(fetchedAt,now=Date.now()){
    const at=Date.parse(fetchedAt);
    if(!Number.isFinite(at))return "unknown";
    const age=Math.max(0,now-at);
    return age>6*60*60*1000?"expired":age>3*60*60*1000?"stale":"fresh";
  }
  function sourceRecord({kind="forecast",payload,fetchedAt,cached=false,fallbackReason=""}={}){
    const air=kind==="air";
    const inspection=air?inspectAirPayload(payload):inspectForecastPayload(payload);
    return Object.freeze({
      contractVersion:CONTRACT_VERSION,
      provider:PROVIDER.id,
      providerName:PROVIDER.name,
      product:air?PROVIDER.airProduct:PROVIDER.forecastProduct,
      licenseId:"open-meteo-current-terms-review-required",
      kind:air?"air_model":"forecast",
      observedAt:null,
      issuedAt:null,
      validAt:payload?.current?.time||null,
      fetchedAt:typeof fetchedAt==="string"?fetchedAt:null,
      freshness:freshness(fetchedAt),
      cached:cached===true,
      missingFields:Object.freeze(inspection.missingFields.slice()),
      fallbackReason:String(fallbackReason||"").slice(0,180)
    });
  }
  function releaseReadiness(){
    const dataRights=DEPLOYMENT_GATES.forecastCommercialRights&&DEPLOYMENT_GATES.airCommercialRights&&DEPLOYMENT_GATES.reverseGeocodeCommercialRights&&DEPLOYMENT_GATES.mapTilesCommercialRights;
    const advertisingBlockers=[];
    if(!dataRights)advertisingBlockers.push("날씨·대기질·역지오코딩·지도 상업 이용권 미검증");
    if(!DEPLOYMENT_GATES.consentFlowVerified)advertisingBlockers.push("광고 동의 흐름 미검증");
    if(!DEPLOYMENT_GATES.productionAdUnitConfigured)advertisingBlockers.push("날씨한눈 전용 운영 광고 단위 미설정");
    const subscriptionBlockers=[];
    if(!dataRights)subscriptionBlockers.push("유료 서비스용 데이터 이용권 미검증");
    if(!DEPLOYMENT_GATES.playBillingConfigured)subscriptionBlockers.push("Play Billing 상품·복원 계약 미설정");
    return Object.freeze({
      contractVersion:CONTRACT_VERSION,
      operatingMode:PROVIDER.mode,
      advertising:Object.freeze({allowed:advertisingBlockers.length===0,blockers:Object.freeze(advertisingBlockers)}),
      subscriptions:Object.freeze({allowed:subscriptionBlockers.length===0,blockers:Object.freeze(subscriptionBlockers)}),
      officialObservations:Object.freeze({available:PROVIDER.observationAvailable,reason:"공식 관측 공급자·관측소 매핑이 연결되지 않았습니다."}),
      officialWarnings:Object.freeze({available:PROVIDER.officialWarningsAvailable,reason:"기상청 특보 API 이용권·서비스 키가 연결되지 않았습니다."}),
      radar:Object.freeze({available:PROVIDER.radarAvailable,reason:"허가된 레이더 영상·범례·관측시각 공급 경로가 연결되지 않았습니다."})
    });
  }
  return Object.freeze({CONTRACT_VERSION,FORECAST_ENDPOINT,AIR_ENDPOINT,PROVIDER,DEPLOYMENT_GATES,HOURLY_FIELDS,DAILY_FIELDS,normalizeLocation,buildForecastUrl,buildAirUrl,inspectForecastPayload,inspectAirPayload,freshness,sourceRecord,releaseReadiness});
});
