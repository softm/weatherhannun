"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");

test("shared account UI mounts into the real weather header action slot", () => {
  const html = read("index.html");
  assert.match(html, /id="siteAccountSlot" class="top-actions topbar-actions"/);
  assert.match(html, /account-header\.js\?v=8/);
  assert.match(html, /20261029-weather-header-1/);
});

// The common module owns the menu and its feedback. Weather only styles its
// host; it must never hide it, proxy authentication buttons or move it again.
function fixture({readyState="complete",present=true,ui="icon-menu-v2"}={}) {
  const styles=new Map(),classes=new Set(),slotClasses=new Set(["top-actions","topbar-actions"]),events={};
  const host={dataset:{accountUi:ui},style:{setProperty:(name,value)=>styles.set(name,value)},classList:{add:name=>classes.add(name)}};
  const slot={classList:{remove:name=>slotClasses.delete(name)}};
  const state={present};
  const document={readyState,
    querySelector(selector){assert.equal(selector,'softm-site-account[data-site="weatherhannun"]');return state.present?host:null;},
    getElementById(id){assert.equal(id,"siteAccountSlot");return slot;},
    addEventListener(type,fn){events[type]=fn;}
  };
  const window={addEventListener(type,fn){events[type]=fn;}};
  vm.runInNewContext(read("account-header.js"),{document,window});
  return {styles,classes,slotClasses,events,state};
}

test("account integration keeps the shared icon visible without a duplicate menu", () => {
  const f=fixture();
  assert.equal(f.styles.get("display"),"inline-flex");
  assert.equal(f.styles.get("flex"),"0 0 auto");
  assert.equal(f.styles.get("margin"),"0");
  assert.equal(f.classes.has("weather-account-host"),true);
  assert.equal(f.slotClasses.has("topbar-actions"),false);
  assert.equal(f.slotClasses.has("top-actions"),true);
  const source=read("account-header.js");
  assert.doesNotMatch(source,/weatherAccountToggle|weatherAccountButton|createElement|innerHTML|\.append\(/);
  assert.doesNotMatch(source,/setProperty\(['"]display['"],\s*['"]none['"]/);
});

test("delayed account mounting responds only to this site's ready event", () => {
  const f=fixture({present:false});
  assert.equal(f.styles.size,0);f.state.present=true;
  f.events["softm:account-ready"]({detail:{siteId:"other"}});
  assert.equal(f.styles.size,0);
  f.events["softm:account-ready"]({detail:{siteId:"weatherhannun"}});
  assert.equal(f.styles.get("display"),"inline-flex");
});

test("DOMContentLoaded alignment is safe for missing or older hosts", () => {
  const f=fixture({readyState:"loading"});
  assert.equal(f.styles.size,0);f.events.DOMContentLoaded();
  assert.equal(f.styles.get("display"),"inline-flex");
  assert.equal(fixture({present:false}).styles.size,0);
  assert.equal(fixture({ui:"legacy"}).styles.size,0);
});

test("offline shell includes the account header integration", () => {
  const worker=read("sw.js");
  assert.match(worker,/weatherhannun-shell-v59-official-status/);
  assert.match(worker,/account-header\.js\?v=8/);
});
