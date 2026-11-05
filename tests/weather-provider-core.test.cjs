const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const provider=require("../weather-provider-core.js");

function validPayload(){
 const hourly={time:["2026-10-27T01:00"]};
 const daily={time:["2026-10-27"]};
 for(const field of provider.HOURLY_FIELDS)hourly[field]=[null];
 for(const field of provider.DAILY_FIELDS)daily[field]=[null];
 return {current:{time:"2026-10-27T01:00",temperature_2m:14},hourly,daily};
}

test("WH-D01 builds common API requests without a secret",()=>{
 const forecast=new URL(provider.buildForecastUrl({name:"서울",lat:37.5665,lon:126.978}));
 const air=new URL(provider.buildAirUrl({name:"서울",lat:37.5665,lon:126.978}));
 assert.equal(forecast.origin+forecast.pathname,provider.FORECAST_ENDPOINT);
 assert.equal(air.origin+air.pathname,provider.AIR_ENDPOINT);
 for(const url of [forecast,air]){
  assert.equal(url.searchParams.get("lat"),"37.5665");
  assert.equal(url.searchParams.get("lon"),"126.978");
  assert.equal(url.searchParams.get("name"),"서울");
  assert.equal(url.searchParams.get("apikey"),null);
  assert.equal(url.searchParams.get("key"),null);
  assert.equal(url.searchParams.get("token"),null);
 }
});

test("provider payload contract reports missing fields instead of filling them",()=>{
 const incomplete={current:{time:"2026-10-27T01:00",temperature_2m:null},hourly:{time:[]},daily:{time:[]}};
 const result=provider.inspectForecastPayload(incomplete);
 assert.equal(result.valid,false);
 for(const field of ["current.temperature_2m","hourly.time","daily.time","hourly.precipitation","daily.precipitation_sum"]){
  assert.ok(result.missingFields.includes(field),field);
 }
});

test("provider contract requires aligned arrays while allowing explicit null cells",()=>{
 const payload=validPayload();
 assert.deepEqual(provider.inspectForecastPayload(payload),{valid:true,missingFields:[]});
 payload.hourly.precipitation=[];
 assert.deepEqual(provider.inspectForecastPayload(payload).missingFields,["hourly.precipitation"]);
});

test("source metadata keeps forecast, valid, fetched and observed times distinct",()=>{
 const payload=validPayload();
 const record=provider.sourceRecord({payload,fetchedAt:"2026-10-26T16:01:00.000Z"});
 assert.equal(record.kind,"forecast");
 assert.equal(record.validAt,"2026-10-27T01:00");
 assert.equal(record.fetchedAt,"2026-10-26T16:01:00.000Z");
 assert.equal(record.observedAt,null);
 assert.equal(record.issuedAt,null);
 assert.deepEqual(record.missingFields,[]);
});

test("commercial ads and subscriptions stay blocked until every product gate passes",()=>{
 const gate=provider.releaseReadiness();
 assert.equal(gate.operatingMode,"kma_primary_metno_global");
 assert.equal(gate.advertising.allowed,false);
 assert.equal(gate.subscriptions.allowed,false);
 assert.ok(gate.advertising.blockers.length>=2);
 assert.equal(gate.officialObservations.available,true);
 assert.equal(gate.officialWarnings.available,true);
 assert.equal(gate.radar.available,true);
 assert.equal(Object.isFrozen(provider.DEPLOYMENT_GATES),true);
});

test("freshness distinguishes fresh, stale, expired and unknown",()=>{
 const now=Date.parse("2026-10-27T03:00:00.000Z");
 assert.equal(provider.freshness("2026-10-27T01:00:00.000Z",now),"fresh");
 assert.equal(provider.freshness("2026-10-26T23:30:00.000Z",now),"stale");
 assert.equal(provider.freshness("2026-10-26T20:00:00.000Z",now),"expired");
 assert.equal(provider.freshness("bad",now),"unknown");
});

test("data transparency page exposes the common API providers and commercial gates",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../data-status.html"),"utf8");
 for(const token of ["weather-provider-core.js?v=43","official-warning-status","radar-status","advertising-gate","subscription-gate","국내 기상청 중심","AirKorea 관측소 실측","Open‑Meteo를 포함한 외부 예보 API를 웹·앱에서 직접 호출하지 않습니다"]){
  assert.ok(html.includes(token),token);
 }
});
