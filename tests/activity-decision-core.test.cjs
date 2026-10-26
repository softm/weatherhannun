const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../activity-decision-core.js");

const full={temp:20,rain:5,mm:0,wind:5,gust:9,humidity:55,uv:2,isDay:1};

test("all six required activities, including irrigation, are explicit",()=>{
 assert.deepEqual(Object.keys(core.DEFINITIONS).sort(),["carwash","harvest","irrigation","laundry","spray","walk"]);
 assert.equal(core.RULE_VERSION,"WH-ACTIVITY-v2");
});

test("the browser loads the rule module before the app and exposes irrigation",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
 assert.ok(html.indexOf("activity-decision-core.js?v=28")<html.indexOf("app.js?v=34"));
 assert.match(html,/data-activity="irrigation">💧 관수 참고/);
});

test("missing fields never become a safe or numeric activity score",()=>{
 for(const type of Object.keys(core.DEFINITIONS)){
  const result=core.evaluate(type,{time:"2026-10-26T12:00"},[]);
  assert.equal(result.available,false,type);
  assert.equal(result.score,null,type);
  assert.match(result.reasons[0].detail,/자료가 없어/);
 }
});

test("zero rain is accepted only when the API actually supplied zero",()=>{
 const result=core.evaluate("walk",full,[]);
 assert.equal(result.available,true);
 assert.equal(result.score,100);
 const absent=core.evaluate("walk",{...full,rain:null,mm:null},[]);
 assert.equal(absent.available,false);
});

test("irrigation is weather suitability only and reacts to forecast rain",()=>{
 const future=Array.from({length:6},(_,index)=>({...full,rain:index===2?70:5,mm:index===2?.8:0}));
 const result=core.evaluate("irrigation",full,future);
 assert.equal(result.available,true);
 assert.ok(result.score<=45);
 assert.match(result.reasons.map(reason=>reason.label).join(" "),/강수 예보/);
 assert.match(result.disclaimer,/토양수분/);
});

test("carwash and irrigation require enough forward rain evidence",()=>{
 assert.equal(core.evaluate("carwash",full,[]).available,false);
 assert.equal(core.evaluate("irrigation",full,[full]).available,false);
 assert.equal(core.evaluate("carwash",full,[full,full]).available,true);
});

test("spraying remains capped and penalizes rain or wind independently",()=>{
 const calm=core.evaluate("spray",full,[]);
 assert.equal(calm.score,85);
 const risky=core.evaluate("spray",{...full,rain:50,wind:20,gust:30},[]);
 assert.ok(risky.score<calm.score);
});
