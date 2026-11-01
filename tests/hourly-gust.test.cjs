const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("hourly forecast visibly exposes wind and gust without treating missing as zero",()=>{
 const core=require('../hourly-explorer-core.js');
 const weather={current:{time:'2026-11-02T10:20'},hourly:{time:['2026-11-02T10:00','2026-11-02T11:00'],wind_speed_10m:[5,null],wind_gusts_10m:[12,null]}};
 const rows=core.rows(weather);
 assert.equal(rows[0].gust,12);assert.equal(rows[0].wind,5);
 assert.equal(core.format(rows[1].gust),'--');assert.equal(core.format(rows[1].wind),'--');
 const ui=fs.readFileSync('hourly-explorer.js','utf8');
 assert.ok(ui.includes("['풍속',value(x.wind,'km/h')]"));
 assert.ok(ui.includes("['돌풍',value(x.gust,'km/h')]"));
});

test("activity cards evaluate their displayed best time instead of mixing current reasons",()=>{
 const app=fs.readFileSync("app.js","utf8");
 assert.match(app,/data:best\?activityEvalAt\(type,best\.index\):current/);
 assert.match(app,/best=bestActivity\(type\),current=activityEvalAt\(type,0\)/);
});
