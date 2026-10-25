const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const source=fs.readFileSync(path.join(__dirname,"../sw.js"),"utf8");

test("service worker refreshes shell assets instead of seeding a new cache with stale HTTP responses",()=>{
  assert.match(source,/fetch\(url,\{cache:"reload"\}\)/);
  assert.match(source,/fetch\(req,\{cache:"no-store"\}\)/);
  assert.doesNotMatch(source,/cache\.addAll\(SHELL\)/);
});
