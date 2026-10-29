"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");

test("shared account UI mounts into the real weather header action slot", () => {
  const html = read("index.html");
  assert.match(html, /id="siteAccountSlot" class="top-actions topbar-actions"/);
  assert.match(html, /account-header\.js\?v=8/);
  assert.match(html, /20261029-weather-header-1/);
});

test("account integration uses a compact menu and separates status feedback", () => {
  const source = read("account-header.js");
  assert.match(source, /softm:account-ready/);
  assert.match(source, /weatherAccountToggle/);
  assert.match(source, /weatherAccountButton/);
  assert.match(source, /position:fixed;z-index:2800/);
  assert.match(source, /로그아웃되었습니다\./);
  assert.match(source, /weatherAccountToast/);
});

test("offline shell includes the account header integration", () => {
  const worker = read("sw.js");
  assert.match(worker, /weatherhannun-shell-v57-account-header-weather-dashboard/);
  assert.match(worker, /account-header\.js\?v=8/);
});
