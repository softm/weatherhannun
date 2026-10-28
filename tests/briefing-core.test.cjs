/* Run with: node --test tests/briefing-core.test.cjs */
const test=require("node:test");
const assert=require("node:assert/strict");
const core=require("../briefing-core.js");
function scenario(opt={}){
 const time=Array.from({length:36},(_,i)=>{
   const t=new Date(Date.UTC(2026,9,25,i,0,0));
   return t.toISOString().slice(0,16);
 });
 // Test uses UTC-like display strings; production API uses Asia/Seoul local timestamps.
 const at="2026-10-25T00:00:00Z";
 const array=(key,fallback)=>time.map((_,i)=>opt[key] && opt[key][i]!==undefined?opt[key][i]:fallback);
 return {loc:{name:"서산"},
   at,
   weather:{
      current:{time:time[0],temperature_2m:18,weather_code:0},
      hourly:{time,temperature_2m:array("temp",18),precipitation_probability:array("rain",0),precipitation:array("mm",0),wind_speed_10m:array("wind",5),wind_gusts_10m:array("gust",10),weather_code:array("code",0),is_day:array("day",1)},
      daily:{temperature_2m_max:[24],temperature_2m_min:[12]}
   },
   air:{current:{pm2_5:12}}
 };
}
test("sunny scenario: conservative no-event briefing and evidence",()=>{
 const x=core.analyse(scenario(),{now:Date.UTC(2026,9,25,0,0)});
 assert.equal(x.valid,true);
 assert.equal(x.events.length,0);
 assert.match(x.short,/24시간의 주요 위험 기준/);
 assert.equal(x.freshness.state,"recent");
 assert.equal(x.evidence.length,5);
});
test("rain scenario: interprets probability as possibility, not certainty",()=>{
 const s=scenario({rain:{3:65},mm:{3:.4}});
 const x=core.analyse(s,{now:Date.UTC(2026,9,25,0,5)});
 assert.equal(x.events[0].id,"rain");
 assert.match(x.short,/비 가능성 증가/);
 assert.match(x.short,/예보를 확인해 주세요/);
 assert.match(x.detail,/강수확률 65%/);
 assert.ok(!x.detail.includes("반드시 비"));
});
test("wind and cold, ordered by forecast time",()=>{
 const x=core.analyse(scenario({temp:{7:1},gust:{2:45}}),{now:Date.UTC(2026,9,25,0,1)});
 assert.ok(x.events.some(e=>e.id==="wind"));
 assert.ok(x.events.some(e=>e.id==="cold"));
 assert.equal(x.events[0].id,"wind");
});
test("missing data does not fabricate sunny outlook",()=>{
 const x=core.analyse({weather:null});
 assert.equal(x.valid,false);
 assert.equal(x.events.length,0);
 assert.match(x.short,/판단할 수 없습니다/);
});
test("stale cache correctly labeled",()=>{
 const old="2026-10-24T00:00:00Z";
 assert.equal(core.dataFreshness(old,Date.UTC(2026,9,25,0,0)).state,"stale");
 assert.equal(core.dataFreshness(null).state,"unknown");
});
test("missing numeric precipitation is not replaced with fabricated percentage",()=>{
 const s=scenario();
 s.weather.hourly.precipitation_probability=null;
 const x=core.analyse(s,{now:Date.UTC(2026,9,25,0,1)});
 assert.match(x.evidence[1].value,/정보 없음/);
});
test("partial risk coverage never becomes a reassuring no-event briefing",()=>{
 const s=scenario();
 s.weather.hourly.precipitation[5]=null;
 const x=core.analyse(s,{now:Date.UTC(2026,9,25,0,1)});
 assert.equal(x.events.length,0);
 assert.equal(x.headline,"주요 위험 판단 자료 부족");
 assert.match(x.short,/판단하지 않습니다/);
});
