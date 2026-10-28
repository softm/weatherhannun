const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../region-search-ui.js"),"utf8");
const page=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
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
  vm.runInNewContext(source,{window,document,fetch,CustomEvent,URL,AbortController,setTimeout,clearTimeout,console});
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
 assert.match(h.node("searchResults").innerHTML,/<b>옥길동<\/b><em class="region-result-best">가장 적합<\/em>/);
 assert.equal(input.attributes["aria-expanded"],"true");
 assert.equal(h.requests.length,1);
});
test("the unified results panel is directly below the search field, before saved and quick regions",()=>{
 const field=page.indexOf('id="locationSearch"');
 const panel=page.indexOf('id="regionSearchPanel"');
 const results=page.indexOf('id="searchResults"');
 const current=page.indexOf('id="geoButton"');
 const favorites=page.indexOf('id="favoriteLocations"');
 assert.ok(field>=0&&field<panel);
 assert.ok(panel<results&&results<current&&current<favorites);
});
test("typing a suffix-free city name shows the city immediately in the visible panel",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="광명";
 await h.window.WeatherRegionSearch.search();
 assert.equal(h.node("regionSearchPanel").hidden,false);
 assert.match(h.node("searchResults").innerHTML,/<b>광명시<\/b>/);
 assert.doesNotMatch(h.node("searchResults").innerHTML,/광명동/);
});
test("clicking the matching hierarchy row applies correct district's centroid without a new API call",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="부천 소사구 옥길동";
 await h.window.WeatherRegionSearch.search();
 const area=h.node("searchResults");
 area.handlers.get("click")({target:{closest:()=>({dataset:{regionChoice:"0"}})}});
 assert.equal(h.events.length,1);
 assert.equal(h.events[0].type,"weatherhannun:change-location");
 assert.equal(h.events[0].detail.name,"옥길동");
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
test("a place-name search shows its linked administrative weather region",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="오이도";
 await h.window.WeatherRegionSearch.search();
 const html=h.node("searchResults").innerHTML;
 assert.match(html,/<b>정왕동<\/b>/);
 assert.match(html,/경기도 시흥시 정왕동/);
 assert.match(html,/오이도 검색 결과 · 법정동 대표 좌표/);
});
test("road/building address is not falsely geocoded as an exact point",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="세종대로 110";
 await h.window.WeatherRegionSearch.search();
 assert.match(h.node("searchResults").innerHTML,/정확한 지점을 판별할 수 없습니다/);
 assert.equal(h.events.length,0);
});

test("full road address returns only administrative prefix with explicit approximation",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="경기도 부천시 소사구 옥길로 38";
 await h.window.WeatherRegionSearch.search();
 assert.match(h.node("searchResults").innerHTML,/경기도 부천시 소사구/);
 assert.match(h.node("searchResults").innerHTML,/도로명·건물번호는 반영하지 않았습니다/);
});

test("city and borough inputs show their own best matching level, not every child dong",async()=>{
 const h=createHarness();
 h.node("locationSearch").value="부천 소사구";
 await h.window.WeatherRegionSearch.search();
 const html=h.node("searchResults").innerHTML;
 assert.match(html,/<b>소사구<\/b>/);
 assert.match(html,/경기도 부천시 소사구/);
 assert.doesNotMatch(html,/옥길동/);
 assert.match(html,/후보 1개/);
});
