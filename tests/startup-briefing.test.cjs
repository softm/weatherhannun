const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../startup-briefing-core.js");
const briefing=require("../briefing-core.js");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
function payload(){const time=Array.from({length:36},(_,i)=>`2026-10-${String(29+Math.floor(i/24)).padStart(2,"0")}T${String(i%24).padStart(2,"0")}:00`);return{loc:{name:"옥길동"},at:"2026-10-29T00:00:00Z",weather:{current:{time:time[0],temperature_2m:17,weather_code:1},hourly:{time,temperature_2m:time.map(()=>17),precipitation_probability:time.map((_,i)=>i===3?70:0),precipitation:time.map((_,i)=>i===3?.5:0),wind_speed_10m:time.map(()=>8),wind_gusts_10m:time.map(()=>15),weather_code:time.map(()=>1),is_day:time.map(()=>1)},daily:{temperature_2m_max:[21],temperature_2m_min:[10]}}};}
test("시작 브리핑은 지역·핵심 변화·근거와 모델 출처를 압축한다",()=>{const x=core.build(payload(),briefing);assert.equal(x.valid,true);assert.equal(x.dayKey,"2026-10-29");assert.equal(x.where,"옥길동");assert.equal(x.tone,"caution");assert.equal(x.events[0].title,"비 가능성 증가");assert.equal(x.evidence.length,3);assert.match(x.source,/모델 예보/);assert.match(x.source,/관측 실황 아님/);});
test("실행 중 중복, 당일 숨김, 위치 팝업 중에는 시작 브리핑을 열지 않는다",()=>{const base={valid:true,dayKey:"2026-10-29",sessionSeen:false,dismissedDay:"",blockingDialogOpen:false};assert.equal(core.shouldShow(base),true);assert.equal(core.shouldShow({...base,sessionSeen:true}),false);assert.equal(core.shouldShow({...base,dismissedDay:base.dayKey}),false);assert.equal(core.shouldShow({...base,blockingDialogOpen:true}),false);});
test("시작 브리핑 자산과 접근 가능한 대화상자가 오프라인 셸에 포함된다",()=>{const page=read("index.html"),worker=read("sw.js"),ui=read("startup-briefing.js");assert.match(page,/id="startupWeatherBriefing"[^>]*aria-labelledby="startupBriefingTitle"/);assert.match(page,/오늘은 다시 보지 않기/);for(const asset of ["startup-briefing.css?v=45","startup-briefing-core.js?v=45","startup-briefing.js?v=45"])assert.match(worker,new RegExp(asset.replace(/[.?]/g,"\\$&")));assert.match(ui,/weatherLocationWelcome/);assert.match(ui,/sessionStorage/);});
