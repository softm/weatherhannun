const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../hourly-explorer-core.js');
test('hourly range starts at current hour and preserves unknown metrics',()=>{
 const w={current:{time:'2026-11-02T10:20'},hourly:{time:['2026-11-02T09:00','2026-11-02T10:00','2026-11-02T11:00'],temperature_2m:[9,null,11],precipitation:[0,undefined,0]}};
 const rows=C.rows(w);assert.equal(rows.length,2);assert.equal(rows[0].time,'2026-11-02T10:00');assert.equal(C.format(rows[0].temp),'--');assert.equal(C.format(rows[0].mm),'--');assert.equal(C.format(rows[1].mm),'0');
 assert.equal(C.format(rows[0].feels),'--');assert.equal(C.format(NaN),'--');assert.equal(C.format('3'),'--');
});
test('periods and dates do not extend beyond supplied forecast',()=>{
 const all=Array.from({length:70},(_,i)=>({time:new Date(Date.UTC(2026,10,2,i)).toISOString().slice(0,16)}));
 assert.equal(C.range(all,'24').length,24);assert.equal(C.range(all,'48').length,48);assert.equal(C.range(all,'168').length,70);
 assert.equal(C.range(all,'custom','2026-11-03','2026-11-03').length,24);assert.equal(C.range(all,'custom','2026-11-05','2026-11-04').length,0);
 assert.deepEqual(C.rows({current:{time:'2030-01-01T00:00'},hourly:{time:all.map(x=>x.time)}}),[]);
 assert.deepEqual(C.rows({}),[]);
});

test('wall clock can advance beyond an older current observation',()=>{
 const weather={current:{time:'2026-11-02T00:00'},hourly:{time:['2026-11-02T00:00','2026-11-02T01:00','2026-11-02T02:00'],temperature_2m:[10,11,12]}};
 assert.equal(C.rows(weather,'2026-11-02T01:45')[0].time,'2026-11-02T01:00');
});
