const test = require('node:test');
const assert = require('node:assert/strict');
const {summarise} = require('../rain-decision-core.js');
function weather(opts={}) {
  const times=Array.from({length:16},(_,i)=>{
    const utc=new Date(Date.UTC(2026,9,26,18+i));
    return utc.toISOString().slice(0,16);
  });
  return {current:{time:'2026-10-26T18:30'},hourly:{
    time:times,
    precipitation_probability:times.map((_,i)=>opts.p&&Object.hasOwn(opts.p,i)?opts.p[i]:0),
    precipitation:times.map((_,i)=>opts.mm&&Object.hasOwn(opts.mm,i)?opts.mm[i]:0)
  }};
}
test('rain later: reports an approximate model hour with evidence, not minute timing',()=>{
  const v=summarise(weather({p:{3:65,4:80},mm:{3:.5,4:.8}}));
  assert.equal(v.state,'later');
  assert.match(v.title,/오늘 21시경부터 비 가능성/);
  assert.equal(v.consecutiveHours,2);
  assert.match(v.detail,/최대 80%/);
  assert.match(v.detail,/1\.3mm/);
  assert.match(v.caution,/시간 단위 모델 예보/);
});
test('forecast high precipitation in current hour is not asserted as observed rain',()=>{
  const v=summarise(weather({p:{0:75,1:50}}));
  assert.equal(v.state,'now');
  assert.match(v.title,/비 가능성/);
  assert.ok(!v.title.includes('현재 비가 옵니다'));
});
test('no rain window uses cautious wording',()=>{
  const v=summarise(weather());
  assert.equal(v.state,'low');
  assert.match(v.caution,/배제할 수 없습니다/);
  assert.equal(v.maxProbability,0);
});
test('probability unavailable but precipitation evidence present',()=>{
  const v=weather({mm:{2:.9}});
  v.hourly.precipitation_probability=null;
  assert.equal(summarise(v).state,'later');
  assert.ok(!summarise(v).detail.includes('최대 0%'));
});
test('all precipitation data missing is unknown, not no-rain',()=>{
  const v=weather();
  v.hourly.precipitation_probability=null;
  v.hourly.precipitation=undefined;
  assert.equal(summarise(v).state,'unknown');
});
test('next-day rain uses date, not inaccurate today',()=>{
  const v=summarise(weather({p:{8:90}}));
  assert.match(v.title,/10월 27일 2시경/);
});
test('handles malformed and expired forecast time safely',()=>{
  assert.equal(summarise({}).state,'unknown');
  const v=weather(); v.current.time='2026-10-30T19:00';
  assert.equal(summarise(v).state,'unknown');
});
test('custom horizon has defined maximum',()=>{
  const v=summarise(weather({p:{13:99}}),12);
  assert.equal(v.state,'low');
  assert.equal(v.hours,12);
});
