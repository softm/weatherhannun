/* Browser-independent end-to-end unit harness for location-manager.js.
   Runs the production script with mocked browser permission, dialogs and storage. */
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../location-core.js");
const source=fs.readFileSync(path.join(__dirname,"../location-manager.js"),"utf8");
const SEOSAN={name:"서산",lat:36.7845,lon:126.4503};
function boot({permission="prompt",initial={},pos={latitude:37.50122,longitude:126.76442},fail=null,search="",reverse=null}={}){
  const store=new Map(Object.entries(initial).map(([k,v])=>[k,typeof v==="string"?v:JSON.stringify(v)]));
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };
  const nodes=new Map();
  function node(id){
    if(nodes.has(id))return nodes.get(id);
    const el={id,innerHTML:"",textContent:"",value:"",open:false,disabled:false,
      handlers:new Map(),
      addEventListener(type,fn){this.handlers.set(type,fn);},
      showModal(){this.open=true;},
      close(){this.open=false;this.handlers.get("close")?.();},
      focus(){},select(){},click(){this.handlers.get("click")?.({target:this})}
    };
    nodes.set(id,el);return el;
  }
  const callbacks=new Map(),events=[],calls={geo:0,permission:0};
  const window={
    WeatherLocationCore:core,WeatherReverseGeocoder:reverse,isSecureContext:true,
    addEventListener(type,fn){callbacks.set(type,fn);},
    dispatchEvent(e){
      events.push(e);
      if(e.type==="weatherhannun:change-location"){
        localStorage.setItem("weatherhannun_location",JSON.stringify(e.detail));
        callbacks.get("weatherhannun:location-applied")?.({detail:e.detail});
      }
    }
  };
  const document={
    readyState:"complete",
    getElementById:node,
    querySelectorAll:()=>[],
    addEventListener(){}
  };
  const navigator={
    geolocation:{getCurrentPosition(ok,bad){calls.geo++;if(fail)bad(fail);else ok({coords:pos});}},
    permissions:{query:async()=>{calls.permission++;return{state:permission};}}
  };
  class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts.detail;}}
  const context=vm.createContext({window,document,navigator,localStorage,location:{search},URLSearchParams,CustomEvent,console,Promise,setTimeout});
  vm.runInContext(source,context);
  return {window,document,node,store,events,calls,callbacks,localStorage,settle:()=>new Promise(r=>setImmediate(r))};
}
test("first visit: shows opt-in sheet and does NOT trigger browser prompt before user gesture",async()=>{
 const t=boot();
 await t.settle();
 assert.equal(t.node("weatherLocationWelcome").open,true);
 assert.equal(t.calls.geo,0);
 t.node("welcomeUseLocation").click();
 await t.settle();
 assert.equal(t.calls.geo,1);
 assert.equal(t.events.at(-1).detail.source,"gps");
 assert.equal(t.events.at(-1).detail.lat,37.501);
 assert.equal(t.node("weatherLocationWelcome").open,false);
 assert.equal(t.localStorage.getItem("weatherhannun_geo_intro_v1"),"done");
});
test("permission denied: user can opt for manual region without repeated prompting",async()=>{
 const t=boot({permission:"denied"});
 await t.settle();
 assert.equal(t.node("weatherLocationWelcome").open,true);
 t.node("welcomeLater").click();
 assert.equal(t.calls.geo,0);
 assert.equal(t.localStorage.getItem("weatherhannun_geo_intro_v1"),"done");
});
test("previous GPS choice and granted permission auto refreshes on entry",async()=>{
 const t=boot({permission:"granted",initial:{weatherhannun_location:{name:"내 현재 위치",lat:35,lon:127,source:"gps"}}});
 await t.settle();
 assert.equal(t.calls.geo,1);
 assert.equal(t.events.at(-1).detail.lat,37.501);
});
test("manual selection is respected even when GPS permission is granted",async()=>{
 const t=boot({permission:"granted",initial:{weatherhannun_location:{...SEOSAN,source:"manual"}}});
 await t.settle();
 assert.equal(t.calls.geo,0);
});
test("GPS location can be saved, renamed, deleted and undone",async()=>{
 const t=boot();
 await t.settle();
 await t.window.WeatherLocationManager.requestCurrentPosition(true);
 t.node("saveCurrentLocation").click();
 let data=JSON.parse(t.localStorage.getItem("weatherhannun_places_v2"));
 assert.equal(data.length,1);
 const id=data[0].id;
 // Simulate the saved-row delegation fired by button click.
 const fakeButton=attribute=>({hasAttribute:name=>name===attribute,getAttribute:()=>id});
 const fire=attribute=>t.node("favoriteLocations").handlers.get("click")({target:{closest:()=>fakeButton(attribute)}});
 fire("data-location-edit");
 t.node("editLocationName").value="우리 집";
 t.node("renameLocationForm").handlers.get("submit")({preventDefault(){}});
 data=JSON.parse(t.localStorage.getItem("weatherhannun_places_v2"));
 assert.equal(data[0].name,"우리 집");
 fire("data-location-delete");
 assert.equal(JSON.parse(t.localStorage.getItem("weatherhannun_places_v2")).length,0);
 assert.equal(t.events.at(-1).detail.name,"서산");
 assert.equal(t.node("locationDialog").open,false);
 t.node("undoLocationDelete").click();
 assert.equal(JSON.parse(t.localStorage.getItem("weatherhannun_places_v2"))[0].name,"우리 집");
});
test("old favorites migrate once to the new key and remain de-duplicated",async()=>{
 const t=boot({initial:{"weatherhannun_favorite_locations_v1":[SEOSAN,SEOSAN,{name:"서울",lat:37.56,lon:126.98}]}});
 await t.settle();
 assert.equal(JSON.parse(t.localStorage.getItem("weatherhannun_places_v2")).length,2);
 assert.equal(t.localStorage.getItem("weatherhannun_favorite_locations_v1"),null);
});
test("saved regions stay visible as one-tap chips and put the current region first",async()=>{
 const SEOUL={name:"서울",lat:37.56,lon:126.98,source:"manual"};
 const t=boot({initial:{
  weatherhannun_location:SEOUL,
  weatherhannun_places_v2:[SEOSAN,SEOUL]
 }});
 await t.settle();
 const html=t.node("locationQuickBar").innerHTML;
 assert.equal(t.node("managedCurrentName").textContent,"서울");
 assert.doesNotMatch(html,/등록 지역|2 \/ 10/);
 assert.match(html,/aria-label="저장 지역 전환 및 지역 관리"/);
 assert.match(html,/aria-current="location"/);
 assert.ok(html.indexOf(">서울<")<html.indexOf(">서산<"));
 const seosanId=core.key(SEOSAN);
 const button={
  hasAttribute:name=>name==="data-location-select",
  getAttribute:name=>name==="data-location-select"?seosanId:null
 };
 t.node("locationQuickBar").handlers.get("click")({target:{closest:()=>button}});
 assert.equal(t.events.at(-1).detail.name,"서산");
});
test("saved region order controls persist order without switching the active region",async()=>{
 const SEOUL={name:"서울",lat:37.56,lon:126.98,source:"manual"};
 const t=boot({initial:{
  weatherhannun_location:{...SEOSAN,source:"manual"},
  weatherhannun_places_v2:[SEOSAN,SEOUL]
 }});
 await t.settle();
 const beforeChanges=t.events.filter(event=>event.type==="weatherhannun:change-location").length;
 const seoulId=core.key(SEOUL);
 const moveButton={
  hasAttribute:name=>name==="data-location-move",
  getAttribute:name=>name==="data-location-id"?seoulId:name==="data-location-move"?"up":null
 };
 t.node("favoriteLocations").handlers.get("click")({target:{closest:()=>moveButton}});
 const saved=JSON.parse(t.localStorage.getItem("weatherhannun_places_v2"));
 assert.deepEqual(saved.map(place=>place.name),["서울","서산"]);
 assert.equal(t.events.filter(event=>event.type==="weatherhannun:change-location").length,beforeChanges);
 assert.match(t.node("favoriteLocations").innerHTML,/서울 위로 이동[^>]* disabled/);
 assert.match(t.node("locationMessage").textContent,/서울 순서를 위로/);
});
test("an unsaved active region exposes a direct register action",async()=>{
 const t=boot({initial:{weatherhannun_location:{...SEOSAN,source:"manual"}}});
 await t.settle();
 assert.match(t.node("locationQuickBar").innerHTML,/data-location-save-current/);
 assert.match(t.node("locationQuickBar").innerHTML,/이 지역 저장/);
 const button={hasAttribute:name=>name==="data-location-save-current",getAttribute:()=>null};
 t.node("locationQuickBar").handlers.get("click")({target:{closest:()=>button}});
 const saved=JSON.parse(t.localStorage.getItem("weatherhannun_places_v2"));
 assert.equal(saved.length,1);
 assert.equal(saved[0].name,"서산");
 assert.doesNotMatch(t.node("locationQuickBar").innerHTML,/data-location-save-current/);
});
test("새로 등록한 지역은 기존 등록 지역보다 앞에 저장되고 표시된다",async()=>{
 const SEOUL={name:"서울",lat:37.56,lon:126.98,source:"manual"};
 const t=boot({initial:{
  weatherhannun_location:{...SEOSAN,source:"manual"},
  weatherhannun_places_v2:[SEOUL]
 }});
 await t.settle();
 const button={hasAttribute:name=>name==="data-location-save-current",getAttribute:()=>null};
 t.node("locationQuickBar").handlers.get("click")({target:{closest:()=>button}});
 const saved=JSON.parse(t.localStorage.getItem("weatherhannun_places_v2"));
 assert.deepEqual(saved.map(place=>place.name),["서산","서울"]);
 const html=t.node("locationQuickBar").innerHTML;
 assert.ok(html.indexOf(">서산<")<html.indexOf(">서울<"));
});
test("shared location query suppresses auto GPS override",async()=>{
 const t=boot({permission:"granted",search:"?lat=37.5&lon=127&name=%EC%84%9C%EC%9A%B8"});
 await t.settle();
 assert.equal(t.calls.geo,0);
 assert.equal(t.node("weatherLocationWelcome").open,false);
});

test("GPS coordinates resolve to approximate Korean address in header, quick bar and saved state",async()=>{
 const t=boot({reverse:{resolve:async()=>({
  name:"부천시 소사구 옥길동",
  administrative:"경기도 부천시 소사구 옥길동",
  address:"경기도 부천시 소사구 옥길동 · 옥길로 인근",
  approximate:true
 })}});
 await t.settle();
 await t.window.WeatherLocationManager.requestCurrentPosition(true);
 await t.settle();
 const last=t.events.at(-1)?.detail;
 assert.equal(last?.name,"부천시 소사구 옥길동");
 assert.equal(last?.address,"경기도 부천시 소사구 옥길동 · 옥길로 인근");
 assert.equal(last?.source,"gps");
 assert.match(t.node("managedCurrentAddress").textContent,/옥길로 인근/);
 assert.doesNotMatch(t.node("locationQuickBar").innerHTML,/GPS 기준 추정주소|옥길로 인근/);
 assert.equal(JSON.parse(t.localStorage.getItem("weatherhannun_location")).address,last.address);
});
test("a pending address lookup cannot override a newly selected manual place",async()=>{
 let complete;
 const pending=new Promise(ok=>{complete=ok;});
 const t=boot({reverse:{resolve:()=>pending}});
 await t.settle();
 await t.window.WeatherLocationManager.requestCurrentPosition(true);
 // When user switches to another region, app broadcasts the new active selection.
 t.callbacks.get("weatherhannun:location-applied")({detail:{name:"서울",lat:37.56,lon:126.98,source:"manual"}});
 complete({name:"부천시 옥길동",address:"경기도 부천시 옥길동"});
 await t.settle();
 assert.equal(t.events.filter(e=>e.type==="weatherhannun:change-location").length,1);
});
