const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const provider=require("../weather-provider-core.js");

test("WH-D01 builds public model requests without a secret",()=>{
 const forecast=new URL(provider.buildForecastUrl({name:"서울",lat:37.5665,lon:126.978}));
 const air=new URL(provider.buildAirUrl({name:"서울",lat:37.5665,lon:126.978}));
 assert.equal(forecast.origin+forecast.pathname,provider.FORECAST_ENDPOINT);
 assert.equal(air.origin+air.pathname,provider.AIR_ENDPOINT);
 for(const url of [forecast,air]){
  assert.equal(url.searchParams.get("apikey"),null);
  assert.equal(url.searchParams.get("key"),null);
  assert.equal(url.searchParams.get("token"),null);
 }
});

test("provider payload contract reports missing fields instead of filling them",()=>{
 const incomplete={current:{time:"2026-10-27T01:00",temperature_2m:null},hourly:{time:[]},daily:{time:[]}};
 const result=provider.inspectForecastPayload(incomplete);
 assert.equal(result.valid,false);
 assert.deepEqual(result.missingFields,["current.temperature_2m","hourly.time","daily.time"]);
});

test("source metadata keeps forecast, valid, fetched and observed times distinct",()=>{
 const payload={current:{time:"2026-10-27T01:00",temperature_2m:14},hourly:{time:["2026-10-27T01:00"]},daily:{time:["2026-10-27"]}};
 const record=provider.sourceRecord({payload,fetchedAt:"2026-10-26T16:01:00.000Z"});
 assert.equal(record.kind,"forecast");
 assert.equal(record.validAt,"2026-10-27T01:00");
 assert.equal(record.fetchedAt,"2026-10-26T16:01:00.000Z");
 assert.equal(record.observedAt,null);
 assert.equal(record.issuedAt,null);
 assert.deepEqual(record.missingFields,[]);
});

test("commercial ads and subscriptions remain hard-blocked in preview mode",()=>{
 const gate=provider.releaseReadiness();
 assert.equal(gate.operatingMode,"noncommercial_preview");
 assert.equal(gate.advertising.allowed,false);
 assert.equal(gate.subscriptions.allowed,false);
 assert.ok(gate.advertising.blockers.length>=2);
 assert.equal(gate.officialObservations.available,false);
 assert.equal(gate.officialWarnings.available,false);
 assert.equal(gate.radar.available,false);
 assert.equal(Object.isFrozen(provider.DEPLOYMENT_GATES),true);
});

test("freshness distinguishes fresh, stale, expired and unknown",()=>{
 const now=Date.parse("2026-10-27T03:00:00.000Z");
 assert.equal(provider.freshness("2026-10-27T01:00:00.000Z",now),"fresh");
 assert.equal(provider.freshness("2026-10-26T23:30:00.000Z",now),"stale");
 assert.equal(provider.freshness("2026-10-26T20:00:00.000Z",now),"expired");
 assert.equal(provider.freshness("bad",now),"unknown");
});

test("data transparency page exposes every unavailable official and commercial gate",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../data-status.html"),"utf8");
 for(const token of ["weather-provider-core.js?v=29","official-warning-status","radar-status","advertising-gate","subscription-gate","광고·유료 출시 차단 중","동일 지역·관측소·시각"]){
  assert.ok(html.includes(token),token);
 }
});
