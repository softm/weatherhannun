const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../national-weather-core.js');
test('전국 날짜는 KST 자정과 월말을 기준으로 7일을 제공한다',()=>{
 assert.deepEqual(core.dates(new Date('2026-10-31T15:01:00Z')),['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07']);
});
test('미래 현재값 재사용을 막고 오전·오후는 해당 날짜 대표 시각을 사용한다',()=>{
 const p={current:{temperature_2m:20},hourly:{time:['2026-11-02T09:00','2026-11-02T15:00'],temperature_2m:[7,13],weather_code:[0,3],is_day:[1,1]}};
 assert.equal(core.sample(p,'2026-11-02','current','2026-11-01'),null);
 assert.equal(core.sample(p,'2026-11-02','morning','2026-11-01').temperature_2m,7);
 assert.equal(core.sample(p,'2026-11-02','afternoon','2026-11-01').temperature_2m,13);
 assert.equal(core.sample(p,'2026-11-03','morning','2026-11-01'),null);
 assert.equal(core.sample(null,'2026-11-01','current','2026-11-01'),null);
});
test('전국 지역 임시 조회는 저장 위치와 URL을 바꾸지 않고 기존 위치 복귀를 지원한다',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const apply=source.slice(source.indexOf('  function applyLocation('),source.indexOf('  function forecastUrl('));
 const original={name:'내 위치',lat:36,lon:127,source:'gps'},nodes={},writes=[],events=[];
 const context={STATE:{loc:original,weather:null},validLocation:()=>true,$:id=>nodes[id]??=( {} ),text(){},storeSet:(...args)=>writes.push(args),loadWeather(){},renderAll(){},window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,args){this.type=type;this.detail=args.detail;}}};
 vm.createContext(context);vm.runInContext(apply,context);
 context.applyLocation(core.cities[1],false,true);
 assert.equal(context.STATE.loc.name,'서울');assert.equal(context.STATE.loc.temporary,true);assert.equal(writes.length,0);assert.equal(nodes.temporaryLocationNotice.hidden,false);assert.equal(events[0].detail.temporary,true);
 context.applyLocation(original,false);
 assert.equal(context.STATE.loc.name,'내 위치');assert.equal(context.STATE.loc.temporary,false);assert.equal(writes.length,1);assert.equal(nodes.temporaryLocationNotice.hidden,true);
});
test('임시 조회 예보는 Android 알림과 위젯·화면날씨에 저장되지 않는다',()=>{
 const alerts=fs.readFileSync(require.resolve('../forecast-insights.js'),'utf8');
 const alertFunction=alerts.slice(alerts.indexOf('  function syncWithAndroid(){'),alerts.indexOf('  function renderAlerts(){'));
 const alertContext={data:{loc:{temporary:true}},nativeBridge(){throw Error('임시 지역이 네이티브 브리지에 도달했습니다.');}};
 vm.createContext(alertContext);vm.runInContext(alertFunction,alertContext);assert.equal(alertContext.syncWithAndroid(),false);
 const screen=fs.readFileSync(require.resolve('../screen-weather-settings.js'),'utf8');
 const begin=screen.indexOf('  function updateSnapshot(detail, previewRequested) {');
 const end=screen.indexOf('    var android = bridge();',begin);
 const context={latestWeather:{loc:{name:'원래 위치'}}};vm.createContext(context);
 vm.runInContext(screen.slice(begin,end)+'return true;}',context);
 assert.equal(context.updateSnapshot({loc:{name:'서울',temporary:true}}),false);
 assert.equal(context.latestWeather.loc.name,'원래 위치');
});
