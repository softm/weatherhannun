const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../region-search-ui.js"),"utf8");
const data=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/korea-regions-202602.json"),"utf8"));
const core=require("../region-search-core.js");
function createHarness(){
  const nodes=new Map(),events=[],requests=[];
  function node(id){
    if(nodes.has(id))return nodes.get(id);
    const v={id,innerHTML:"",value:"",textContent:"",open:id==="locationDialog",
      attributes:{},handlers:new Map(),setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(key,cb){this.handlers.set(key,cb);},
      focus(){this.focused=true;},close(){this.open=false;this.handlers.get("close")?.();}};
    nodes.set(id,v);return v;
  }
  class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
  const document={readyState:"complete",getElementById:node};
  const window={WeatherRegionSearchCore:core,dispatchEvent:e=>events.push(e)};
  const fetch=async url=>{requests.push(url);return{ok:true,json:async()=>data};};
  vm.runInNewContext(source,{window,document,fetch,CustomEvent,URL,setTimeout,clearTimeout,console});
  return {window,node,events,requests};
}
test("opening and typing a district name renders full legal dong address suggestions",async()=>{
 const h=createHarness();
 const input=h.node("locationSearch");
 input.value="옥길동";
 await h.window.WeatherRegionSearch.search();
 assert.match(h.node("searchResults").innerHTML,/경기도 부천시 소사구 옥길동/);
 assert.match(h.node("searchResults").innerHTML,/경기도 광명시 옥길동/);
 assert.match(h.node("searchResults").innerHTML,/법정동/);
 assert.equal(input.attributes["aria-expanded"],"true");
 assert.equal(h.requests.length,1);
});
test("clicking the matching hierarchy row applies correct district's centroid without a new API call",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="부천 소사구 옥길동";
 await h.window.WeatherRegionSearch.search();
 const area=h.node("searchResults");
 area.handlers.get("click")({target:{closest:()=>({dataset:{regionChoice:"0"}})}});
 assert.equal(h.events.length,1);
 assert.equal(h.events[0].type,"weatherhannun:change-location");
 assert.equal(h.events[0].detail.address,"경기도 부천시 소사구 옥길동");
 assert.equal(h.events[0].detail.regionCenter,true);
 assert.equal(h.node("locationDialog").open,false);
});
test("multiple searches use a single cached local dataset without typing network requests",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="역삼동";
 await h.window.WeatherRegionSearch.search();
 h.node("locationSearch").value="서산 화곡리";
 await h.window.WeatherRegionSearch.search();
 assert.equal(h.requests.length,1);
 assert.match(h.node("searchResults").innerHTML,/서산시 대산읍 화곡리/);
});
test("road/building address is not falsely geocoded as an exact point",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="세종대로 110";
 await h.window.WeatherRegionSearch.search();
 assert.match(h.node("searchResults").innerHTML,/정확한 지점을 판별할 수 없습니다/);
 assert.equal(h.events.length,0);
});
