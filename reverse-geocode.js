/* WeatherHannun · OpenStreetMap Nominatim reverse lookup.
 * Keyless, cached and low-volume lookup of approximate GPS coordinates.
 * Source attribution: © OpenStreetMap contributors (ODbL).
 * Public Nominatim has a STRICT max 1 req/s policy; replace with a managed
 * provider or self-host for higher traffic. Never use for bulk geocoding.
 */
(function (root, factory) {
  "use strict";
  const core=factory();
  if (typeof module==="object" && module.exports) module.exports=core;
  if (root) root.WeatherReverseGeocoder=core;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const API="https://nominatim.openstreetmap.org/reverse";
  const CACHE_KEY="weatherhannun_reverse_address_cache_v1";
  const RATE_KEY="weatherhannun_reverse_address_lastrequest_v1";
  const TTL=30*24*60*60*1000;
  const MIN_INTERVAL=1150;
  const ongoing=new Map();
  let lastRequest=0;
  let requestQueue=Promise.resolve(); // serialize different-coordinate requests per browser tab
  function string(v){return typeof v==="string"?v.trim():"";}
  function validNumber(v){return typeof v==="number"&&Number.isFinite(v);}
  function cleanText(v){return string(v).replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").slice(0,90);}
  function dedupe(parts){
    const unique=[];
    for(const part of parts){const word=cleanText(part);if(word&&!unique.some(x=>x===word))unique.push(word);}
    return unique;
  }
  function format(data){
    if(!data||typeof data!=="object"||data.error)return null;
    const a=data.address||{};
    const state=a.state||a.province||a.region;
    const city=a.city||a.municipality||a.town||a.county;
    const district=a.borough||a.city_district||a.district||(city!==a.county?a.county:null);
    const neighborhood=a.suburb||a.quarter||a.neighbourhood||a.village||a.hamlet||a.residential||a.locality;
    let administrative=dedupe([state,city,district,neighborhood]);
    const road=cleanText(a.road||a.pedestrian||a.living_street||a.footway||"");
    if(administrative.length===0&&typeof data.display_name==="string"){
      // A low-confidence fallback, never treat a nearby POI as a home address.
      administrative=dedupe(data.display_name.split(",").slice(0,5).reverse().filter(v=>!/^(대한민국|South Korea|Korea|Republic of Korea|\d{4,6})$/i.test(v.trim())));
    }
    if(!administrative.length)return null;
    const shortName=administrative.length>=3?administrative.slice(-3).join(" "):administrative.join(" ");
    const adminAddress=administrative.join(" ");
    // Coordinate is deliberately reduced to 3 decimal places (~100 m). Do not
    // display house_number or building identity as precise residence information.
    const displayAddress=road&&!administrative.includes(road)?adminAddress+" · "+road+" 인근":adminAddress;
    return {
      name:shortName.slice(0,70),address:displayAddress.slice(0,160),
      administrative:adminAddress.slice(0,140),road:road.slice(0,90),
      approximate:true,provider:"OpenStreetMap",attribution:"© OpenStreetMap contributors"
    };
  }
  function coordinate(v){return Number(v).toFixed(3);}
  function cacheId(lat,lon){return coordinate(lat)+","+coordinate(lon);}
  function storage(){
    try{
      if(typeof localStorage!=="undefined")return localStorage;
    }catch(_){}
    return null;
  }
  function getCached(id,now){
    const box=storage();if(!box)return null;
    try{
      const doc=JSON.parse(box.getItem(CACHE_KEY)||"{}");
      const item=doc[id];
      if(item && Number.isFinite(item.at) && now-item.at<TTL && now>=item.at && item.value?.address)return item.value;
    }catch(_){}
    return null;
  }
  function setCached(id,result,now){
    const box=storage();if(!box)return;
    try{
      const all=JSON.parse(box.getItem(CACHE_KEY)||"{}");
      const doc=all&&typeof all==="object"&&!Array.isArray(all)?all:{};
      doc[id]={at:now,value:result};
      const keys=Object.keys(doc).sort((a,b)=>(doc[b]?.at||0)-(doc[a]?.at||0));
      for(const key of keys.slice(30))delete doc[key];
      box.setItem(CACHE_KEY,JSON.stringify(doc));
    }catch(_){}
  }
  function buildUrl(lat,lon){
    const url=new URL(API);
    url.searchParams.set("format","jsonv2");
    url.searchParams.set("lat",coordinate(lat));
    url.searchParams.set("lon",coordinate(lon));
    url.searchParams.set("zoom","17"); // approximate street, no building number
    url.searchParams.set("addressdetails","1");
    url.searchParams.set("layer","address");
    url.searchParams.set("accept-language","ko");
    return url.toString();
  }
  async function resolve(lat,lon,options){
    if(!validNumber(lat)||!validNumber(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    const opts=options||{};
    const key=cacheId(lat,lon),now=Date.now();
    if(!opts.force){
      const saved=getCached(key,now);
      if(saved)return {...saved,cache:true};
    }
    if(ongoing.has(key))return ongoing.get(key);
    const promise=requestQueue.then(async()=>{
      const box=storage();
      let otherRequest=0;
      try{otherRequest=Number(box?.getItem(RATE_KEY))||0;}catch(_){}
      const delay=Math.max(0,MIN_INTERVAL-(Date.now()-Math.max(lastRequest,otherRequest)));
      if(delay)await new Promise(ok=>setTimeout(ok,delay));
      lastRequest=Date.now();
      try{box?.setItem(RATE_KEY,String(lastRequest));}catch(_){}
      const ctrl=new AbortController();
      const timeout=setTimeout(()=>ctrl.abort(),9500);
      try{
        const response=await fetch(buildUrl(lat,lon),{
          signal:ctrl.signal,method:"GET",mode:"cors",credentials:"omit",
          referrerPolicy:"strict-origin-when-cross-origin",
          headers:{"Accept":"application/json"}
        });
        if(!response.ok)throw new Error("reverse geocoding HTTP "+response.status);
        const raw=await response.json(),formatted=format(raw);
        if(formatted)setCached(key,formatted,Date.now());
        return formatted;
      }finally{clearTimeout(timeout);}
    })().catch(()=>null).finally(()=>ongoing.delete(key));
    requestQueue=promise.then(()=>{},()=>{});
    ongoing.set(key,promise);
    return promise;
  }
  return Object.freeze({format,resolve,buildUrl,cacheId});
});