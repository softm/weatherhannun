import {onRequest} from "firebase-functions/v2/https";
import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
if(!getApps().length)initializeApp();
const db=getFirestore();
const allowedOrigin="https://softm.github.io";
const finite=x=>Number.isFinite(Number(x));
const json=(res,status,body)=>res.status(status).json(body);
function coords(q){const lat=Number(q.lat),lon=Number(q.lon);if(!finite(q.lat)||!finite(q.lon)||lat < -90||lat>90||lon < -180||lon>180)throw Error("invalid_coordinates");return {lat,lon};}
function inKorea({lat,lon}){return lat>=33&&lat<=39&&lon>=124&&lon<=132;}
async function fetchJson(url,headers={}){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),9000);try{const r=await fetch(url,{headers,signal:ctrl.signal});if(!r.ok)throw Error("upstream_"+r.status);return await r.json();}finally{clearTimeout(t);}}
function normalizeMet(data,loc){const series=data?.properties?.timeseries;if(!Array.isArray(series)||!series.length)throw Error("invalid_met_payload");const hourly=series.slice(0,168).map(x=>({time:x.time,temperature:x.data?.instant?.details?.air_temperature??null,humidity:x.data?.instant?.details?.relative_humidity??null,windSpeed:x.data?.instant?.details?.wind_speed??null,precipitation:x.data?.next_1_hours?.details?.precipitation_amount??null,condition:x.data?.next_1_hours?.summary?.symbol_code??null}));return {location:{...loc,timezone:"UTC"},current:hourly[0],hourly,daily:[],airQuality:null,alerts:[],officialForecast:null,comparison:null,source:{provider:"MET Norway",issuedAt:data.properties?.meta?.updated_at??null,fetchedAt:new Date().toISOString(),attribution:"MET Norway (met.no)"},stale:false};}
export const weatherApi=onRequest({region:"asia-northeast3",cors:[allowedOrigin],maxInstances:10,timeoutSeconds:30},async(req,res)=>{
 if(req.method!=="GET")return json(res,405,{error:"method_not_allowed"});
 let loc;try{loc=coords(req.query);}catch{return json(res,400,{error:"invalid_coordinates"});}
 const key=`${Math.round(loc.lat*100)/100}_${Math.round(loc.lon*100)/100}`;
 const doc=db.collection("weather_api_cache").doc(key);
 try{
  const cached=await doc.get(),value=cached.data();
  if(value&&Date.now()-value.cachedAt<30*60*1000)return json(res,200,{...value.payload,cache:{hit:true}});
  if(inKorea(loc))return json(res,503,{error:"kma_not_configured",message:"국내 기상청 공식 API 연결 전에는 다른 공급자 자료를 공식 실황으로 표시하지 않습니다."});
  const url=new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  url.searchParams.set("lat",String(loc.lat));url.searchParams.set("lon",String(loc.lon));
  const data=await fetchJson(url,{"User-Agent":"WeatherHannun/0.1 (https://softm.github.io/weatherhannun/)"});
  const payload=normalizeMet(data,loc);
  await doc.set({payload,cachedAt:Date.now()});
  return json(res,200,{...payload,cache:{hit:false}});
 }catch(e){
  try{const old=(await doc.get()).data();if(old?.payload)return json(res,200,{...old.payload,stale:true,cache:{hit:true,fallback:true}});}catch{}
  return json(res,502,{error:"weather_provider_unavailable"});
 }
});
