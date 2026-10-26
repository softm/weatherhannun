const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("hourly forecast visibly exposes wind and gust without treating missing as zero",()=>{
 const app=fs.readFileSync("app.js","utf8");
 assert.match(app,/class="hour-gust">돌 /);
 assert.match(app,/<small>풍속<\/small>/);
 assert.match(app,/<small>돌풍<\/small>/);
 assert.match(app,/gusts=rows\.map/);
 assert.doesNotMatch(app,/gust[^\n]{0,80}\?[^\n]{0,80}:0/);
});

test("activity cards evaluate their displayed best time instead of mixing current reasons",()=>{
 const app=fs.readFileSync("app.js","utf8");
 assert.match(app,/data:best\?activityEvalAt\(type,best\.index\):current/);
 assert.match(app,/best=bestActivity\(type\),current=activityEvalAt\(type,0\)/);
});
