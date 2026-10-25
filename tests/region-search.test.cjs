/* Run: node --test tests/region-search.test.cjs */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../region-search-core.js");
const locations=require("../location-core.js");
const dataset=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/korea-regions-202602.json"),"utf8"));
const index=core.load(dataset);
test("local Korean address index includes 2026-02 nationwide subdivisions",()=>{
 assert.equal(dataset.date,"2026-02");
 assert.equal(index.length,19574);
 assert.ok(index.some(x=>x.full==="경기도 부천시 소사구 옥길동"));
});
test("same dong name yields distinct cities and full administrative hierarchy",()=>{
 const a=core.search(index,"옥길동");
 assert.ok(a.length>=2);
 assert.ok(a.some(x=>x.full==="경기도 부천시 소사구 옥길동"));
 assert.ok(a.some(x=>x.full==="경기도 광명시 옥길동"));
});
test("longer city/district query narrows to the right neighborhood",()=>{
 const a=core.search(index,"부천 소사구 옥길동");
 assert.equal(a.length,1);
 assert.equal(a[0].full,"경기도 부천시 소사구 옥길동");
 const loc=core.toLocation(a[0]);
 assert.equal(loc.name,"부천시 소사구 옥길동");
 assert.equal(loc.address,"경기도 부천시 소사구 옥길동");
 assert.equal(loc.regionCenter,true);
 assert.equal(loc.source,"manual");
 assert.ok(loc.lat>37&&loc.lon>126);
});
test("searches ri under town and province rather than showing an arbitrary duplicate",()=>{
 const a=core.search(index,"서산 화곡리");
 assert.equal(a.length,1);
 assert.equal(a[0].full,"충청남도 서산시 대산읍 화곡리");
 assert.equal(a[0].kind,"ri");
});
test("input may be borough-only and should rank exact borough over neighborhoods",()=>{
 const a=core.search(index,"강남구");
 assert.ok(a.length>0);
 assert.equal(a[0].full,"서울특별시 강남구");
 assert.equal(a[0].kind,"gu");
});
test("town and city names match ordinary short forms, province aliases",()=>{
 assert.equal(core.search(index,"전북 전주시").length>0,true);
 assert.equal(core.search(index,"서울").at(0)?.name,"서울특별시");
 assert.ok(core.search(index,"서산 대산읍").some(x=>x.full==="충청남도 서산시 대산읍"));
});
test("parcel lot numbers must not turn representative dong location into fake exact address",()=>{
 const a=core.search(index,"옥길동 123-4");
 assert.equal(a.length,2);
 assert.notEqual(core.removeLot("옥길동 123-4"),"옥길동 123-4");
 assert.equal(core.search(index,"세종대로 110").length,0);
 assert.equal(core.isStreet("세종대로 110"),true);
});
test("selected region keeps representative-coordinate metadata in saved favorites",()=>{
 const a=core.toLocation(core.search(index,"부천 소사구 옥길동")[0]);
 const saved=locations.add([],a);
 assert.equal(saved.error,null);
 assert.equal(saved.items[0].regionCenter,true);
 assert.equal(saved.items[0].administrative,"경기도 부천시 소사구 옥길동");
});
test("unknown and empty regions are safe",()=>{
 assert.deepEqual(core.search(index,""),[]);
 assert.deepEqual(core.search(index,"@@"),[]);
 assert.equal(core.toLocation(null),null);
});
