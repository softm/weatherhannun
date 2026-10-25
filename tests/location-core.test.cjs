const test=require("node:test");
const assert=require("node:assert/strict");
const x=require("../location-core.js");
const seosan={name:"서산",lat:36.7845,lon:126.4503};
const seoul={name:"서울",lat:37.5665,lon:126.978};
test("coordinates normalized and finite only",()=> {
  assert.equal(x.cleanPlace({name:"bad",lat:null,lon:126}),null);
  assert.equal(x.cleanPlace({name:"bad",lat:" ",lon:126}),null);
  assert.equal(x.cleanPlace({name:"bad",lat:100,lon:126}),null);
  assert.equal(x.cleanPlace({name:"ok",lat:"36.7",lon:"126.4"}).lat,36.7);
});
test("GPS source retained, coordinates matched within neighborhood-scale 3 digits",()=>{
  const gps={name:"현재 위치",lat:37.40043,lon:126.8021,source:"gps"};
  assert.equal(x.cleanPlace(gps).source,"gps");
  assert.equal(x.same(gps,{name:"집",lat:37.4004,lon:126.80212}),true);
});
test("existing saved list deduplicated and invalid values ignored",()=>{
 const a=x.collection([seosan,{...seosan,name:"내 농장"},null,{lat:Infinity,lon:0},seoul]);
 assert.equal(a.length,2);assert.equal(a[0].name,"서산");
});
test("can store and switch between multiple favorites",()=>{
 const a=x.add([],seosan);
 const b=x.add(a.items,seoul);
 assert.equal(b.items.length,2);
 assert.equal(b.items[1].name,"서울");
 assert.equal(x.add(b.items,seosan).error,"exists");
});
test("saved place rename preserves stable id and coordinates",()=>{
 const a=x.add([],seosan).items[0];
 const b=x.rename([a],a.id,"내 농장").items[0];
 assert.equal(b.id,a.id);assert.equal(b.name,"내 농장");assert.equal(b.lat,a.lat);
});
test("delete active location switches to remaining location or default",()=>{
 const items=x.collection([seosan,seoul]);
 const a=x.remove(items,items[0].id);
 assert.equal(a.items.length,1);
 assert.equal(x.afterDelete(seosan,a.removed,a.items,seosan).name,"서울");
 const b=x.remove(a.items,a.items[0].id);
 assert.equal(x.afterDelete(seoul,b.removed,b.items,seosan).name,"서산");
});
test("delete inactive location does not disrupt current selection",()=>{
 const items=x.collection([seosan,seoul]);
 const a=x.remove(items,items[1].id);
 assert.equal(x.afterDelete(seosan,a.removed,a.items,seosan),null);
});
test("limit saves to 10 places",()=>{
 const a=Array.from({length:10},(_,i)=>({name:"L"+i,lat:36+i*.03,lon:126}));
 assert.equal(x.add(x.collection(a),{name:"11",lat:39,lon:128}).error,"full");
});
