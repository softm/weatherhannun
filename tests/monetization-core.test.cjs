"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const core=require("../monetization-core.js");

test("paid plans stay blocked without Android, data rights and Play state",()=>{
  const view=core.evaluate(null,{nativeAvailable:false,releaseReadiness:{subscriptions:{allowed:false,blockers:["data rights"]}}});
  assert.equal(view.plans.free.entitled,true);
  assert.equal(view.plans.plus.purchasable,false);
  assert.equal(view.plans.agriculture.purchasable,false);
  assert.ok(view.blockers.some(message=>message.includes("Android")));
  assert.ok(view.blockers.includes("data rights"));
});

test("only Play-returned products become purchasable and no price is invented",()=>{
  const state={enabled:true,connected:true,resolved:true,products:[
    {plan:"plus",productId:"weatherhannun.plus",available:true,price:"₩2,900",billingPeriod:"P1M"},
    {plan:"agriculture",productId:"weatherhannun.agri",available:false,price:""}
  ],entitlements:[]};
  const view=core.evaluate(state,{nativeAvailable:true,releaseReadiness:{subscriptions:{allowed:true,blockers:[]}}});
  assert.equal(view.plans.plus.purchasable,true);
  assert.equal(view.plans.plus.product.price,"₩2,900");
  assert.equal(view.plans.agriculture.purchasable,false);
  assert.equal(view.plans.agriculture.product.price,"");
});

test("agriculture entitlement includes Plus value and storefront is cached offline",()=>{
  const view=core.evaluate({enabled:true,connected:true,resolved:true,entitlements:["agriculture"]},{nativeAvailable:true,releaseReadiness:{subscriptions:{allowed:true,blockers:[]}}});
  assert.equal(view.plans.agriculture.entitled,true);
  assert.equal(view.plans.plus.entitled,true);
  const html=fs.readFileSync("index.html","utf8");
  const worker=fs.readFileSync("sw.js","utf8");
  for(const token of ["membershipSettings","monetization-core.js?v=32","monetization-settings.js?v=34"]){
    assert.ok(html.includes(token),token);
    if(token.endsWith("v=32"))assert.ok(worker.includes(token),token);
  }
});
