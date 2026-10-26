"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const metrics=require("../product-metrics-core.js");

test("local metrics are opt-in, allowlisted and contain no payload fields",()=>{
  let state=metrics.empty("2026-10-01");
  state=metrics.record(state,"today_open","2026-10-01");
  assert.deepEqual(state.days,{});
  state=metrics.setConsent(state,true,"2026-10-01");
  state=metrics.record(state,"today_open","2026-10-01");
  state=metrics.record(state,"location_changed","2026-10-01",{lat:37.5});
  state=metrics.record(state,"unknown_event","2026-10-01");
  assert.deepEqual(state.days["2026-10-01"],{today_open:1,location_changed:1});
  assert.doesNotMatch(JSON.stringify(state),/lat|lon|query|address|userId/i);
});

test("summary calculates device-only quality rates without claiming cohort percentages",()=>{
  let state=metrics.setConsent(metrics.empty("2026-10-01"),true,"2026-10-01");
  for(const event of ["today_open","forecast_success","forecast_success","forecast_error","activity_open"])state=metrics.record(state,event,"2026-10-01");
  state=metrics.record(state,"today_open","2026-10-02");
  const summary=metrics.summary(state,"2026-10-02");
  assert.equal(summary.sessions,2);
  assert.equal(summary.forecastSuccessRate,2/3);
  assert.equal(summary.actionUseRate,1/2);
  assert.equal(summary.retainedD1,true);
  assert.equal(summary.retainedD7,false);
});

test("disabling clears counters and offline shell includes the local-only module",()=>{
  let state=metrics.setConsent(metrics.empty("2026-10-01"),true,"2026-10-01");
  state=metrics.record(state,"today_open","2026-10-01");
  state=metrics.setConsent(state,false,"2026-10-02");
  assert.deepEqual(state.days,{});
  const html=fs.readFileSync("index.html","utf8"),worker=fs.readFileSync("sw.js","utf8");
  for(const token of ["productMetricsConsent","product-metrics-core.js?v=33","product-metrics.js?v=33"]){
    assert.ok(html.includes(token),token);
    if(token.endsWith("v=33"))assert.ok(worker.includes(token),token);
  }
});
