const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
global.WeatherHannunBriefingCore=require("../briefing-core.js");
const hub=require("../briefing-hub-core.js");

function payload(){
  const times=Array.from({length:48},(_,i)=>`2026-11-${String(1+Math.floor(i/24)).padStart(2,"0")}T${String(i%24).padStart(2,"0")}:00`);
  return {loc:{name:"옥길동"},at:"2026-11-01T00:00:00+09:00",status:"live",weather:{current:{time:times[0],temperature_2m:10,weather_code:1},hourly:{time:times,temperature_2m:times.map((_,i)=>10-i/10),precipitation_probability:times.map((_,i)=>i===3?70:10),precipitation:times.map((_,i)=>i===3?.8:0),wind_speed_10m:times.map(()=>8),wind_gusts_10m:times.map(()=>18),uv_index:times.map(()=>1),is_day:times.map((_,i)=>i%24>=7&&i%24<18?1:0),weather_code:times.map(()=>1)},daily:{temperature_2m_min:[5],temperature_2m_max:[14]}}};
}

test("여섯 가지 목적별 브리핑은 같은 모델 예보 근거에서 생성된다",()=>{
  const result=hub.build(payload());
  assert.deepEqual(result.map(x=>x.id),["summary","commute","life","safety","farming","sleep"]);
  assert.match(result.find(x=>x.id==="commute").text,/3시부터 비 가능성/);
  assert.match(result.find(x=>x.id==="farming").text,/모델 예보/);
  assert.doesNotMatch(result.map(x=>x.text).join(" "),/관측 결과|실측 결과/);
});

test("누락 수치는 임의의 0으로 바꾸지 않는다",()=>{
  const data=payload();data.weather.hourly.precipitation_probability=data.weather.hourly.precipitation_probability.map(()=>null);
  const life=hub.build(data).find(x=>x.id==="life");
  assert.match(life.text,/최고 강수확률은 정보 없음/);
});

test("예약 설정은 종류·시각·전달 방식을 보수적으로 정규화한다",()=>{
  assert.deepEqual(hub.normalizeSettings({enabled:true,types:["commute","bad"],morning:"06:30",evening:"20:00",delivery:"auto"}),{enabled:true,types:["commute"],morning:"06:30",evening:"20:00",delivery:"auto"});
  assert.equal(hub.normalizeSettings({}).delivery,"tap");
});

test("브리핑 전용 메뉴와 예약·알림·자동재생 UI가 오프라인 셸에 포함된다",()=>{
  const html=read("index.html"),worker=read("sw.js"),ui=read("briefing-hub.js");
  assert.match(html,/data-view="briefing"/);assert.match(html,/id="view-briefing"/);
  for(const label of ["한눈 요약","출근·외출","생활 준비","안전 기상","농작업","취침 전"])assert.match(html,new RegExp(label));
  assert.match(html,/알림만/);assert.match(html,/알림을 누르면 재생/);assert.match(html,/시간에 바로 재생/);
  assert.match(ui,/weatherhannun:briefing-settings/);assert.match(ui,/new Notification/);assert.match(ui,/setInterval\(runSchedule,30000\)/);
  for(const asset of ["briefing-hub.css?v=1","briefing-hub-core.js?v=1","briefing-hub.js?v=1"])assert.match(worker,new RegExp(asset.replace(/[.?]/g,"\\$&")));
});
