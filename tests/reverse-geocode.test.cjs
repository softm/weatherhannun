const test=require("node:test");
const assert=require("node:assert/strict");
const reverse=require("../reverse-geocode.js");

const korean={
  display_name:"서울특별시, 중구, 명동, 대한민국",
  address:{country:"대한민국",state:"서울특별시",city:"서울특별시",borough:"중구",suburb:"명동",road:"세종대로",house_number:"110"}
};
test("Korean GPS reverse result presents administrative address, not guessed house number",()=>{
  const v=reverse.format(korean);
  assert.equal(v.name,"명동");
  assert.equal(v.administrative,"서울특별시 중구 명동");
  assert.equal(v.address,"서울특별시 중구 명동 · 세종대로 인근");
  assert.equal(v.approximate,true);
  assert.equal(v.address.includes("110"),false);
  assert.equal(v.provider,"OpenStreetMap");
});
test("Gyeonggi province / city / borough / dong addresses retain readable Korean hierarchy",()=>{
  const v=reverse.format({address:{country:"대한민국",state:"경기도",city:"부천시",borough:"소사구",suburb:"옥길동",road:"옥길로"}});
  assert.equal(v.address,"경기도 부천시 소사구 옥길동 · 옥길로 인근");
  assert.equal(v.name,"옥길동");
});
test("handle different Korea OSM administrative key shapes",()=>{
  const v=reverse.format({address:{province:"충청남도",town:"서산시",city_district:"지곡면",village:"화천리"}});
  assert.equal(v.address,"충청남도 서산시 지곡면 화천리");
});
test("do not return fictitious address from empty/error responses",()=>{
  assert.equal(reverse.format(null),null);
  assert.equal(reverse.format({error:"not found"}),null);
  assert.equal(reverse.format({address:{}}),null);
});
test("URL sends rounded coords with Korean locale, zoom street-level, address layer",()=>{
  const url=new URL(reverse.buildUrl(37.56642,126.97804));
  assert.equal(url.hostname,"nominatim.openstreetmap.org");
  assert.equal(url.searchParams.get("lat"),"37.566");
  assert.equal(url.searchParams.get("lon"),"126.978");
  assert.equal(url.searchParams.get("accept-language"),"ko");
  assert.equal(url.searchParams.get("layer"),"address");
  assert.equal(url.searchParams.get("zoom"),"17");
});
test("response is cached; repeat lookup skips additional third-party requests",async()=>{
  const oldFetch=global.fetch,oldStorage=global.localStorage;
  const storage=new Map();let fetched=0;
  global.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  global.fetch=async()=>{
    fetched++;
    return {ok:true,json:async()=>korean};
  };
  try{
    const first=await reverse.resolve(37.56642,126.97804);
    const second=await reverse.resolve(37.5664,126.978);
    assert.equal(first.name,"명동");
    assert.equal(second.cache,true);
    assert.equal(fetched,1);
  }finally{global.fetch=oldFetch;global.localStorage=oldStorage;}
});
