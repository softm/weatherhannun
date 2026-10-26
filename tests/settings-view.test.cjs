"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");

test("settings gear opens a dedicated settings view", () => {
  const html = read("index.html");
  const app = read("app.js");

  assert.match(html, /id="settingsButton"[^>]*data-view="settings"/);
  assert.match(html, /id="settingsButton"[\s\S]*?>[\s\S]*?settings/);
  assert.match(html, /id="view-settings"[^>]*aria-label="설정"/);
  assert.match(app, /"map","compare","settings"/);
});

test("appearance, location, alerts and app information live in the settings view", () => {
  const html = read("index.html");
  const settingsStart = html.indexOf('id="view-settings"');
  const settingsEnd = html.indexOf('class="status-footer', settingsStart);
  const settings = html.slice(settingsStart, settingsEnd);
  const activityStart = html.indexOf('id="view-activity"');
  const activityEnd = html.indexOf('id="view-air"', activityStart);
  const activity = html.slice(activityStart, activityEnd);

  for (const token of [
    'data-theme-choice="light"',
    'data-theme-choice="dark"',
    'id="settingsManageLocations"',
    'id="settingsUseCurrentLocation"',
    'id="homeWidgetSettings"',
    'id="homeWidgetAdd"',
    'id="homeWidgetSync"',
    'id="membershipSettings"',
    'id="membershipRestore"',
    'id="membershipManage"',
    'id="productMetricsConsent"',
    'id="productMetricsReset"',
    'id="watchSettings"',
    './privacy.html',
    './data-status.html'
  ]) assert.ok(settings.includes(token), `missing settings control ${token}`);

  assert.ok(!activity.includes('id="watchSettings"'), "alerts must not remain mixed into activity recommendations");
});

test("all weather alert shortcuts route to the unified settings view", () => {
  const html = read("index.html");
  const today = read("stitch-today.js");
  const shortcuts = [...html.matchAll(/class="alert-cta[^>]*data-view="([^"]+)"[^>]*data-scroll-target="watchSettings"/g)];

  assert.equal(shortcuts.length, 3);
  assert.ok(shortcuts.every(match => match[1] === "settings"));
  assert.match(today, /go\('settings'\)[\s\S]*?watch-settings/);
});

test("theme choices replace the standalone header theme toggle", () => {
  const layout = read("stitch-layout.js");
  const html = read("index.html");

  assert.match(layout, /querySelectorAll\("\[data-theme-choice\]"\)/);
  assert.match(layout, /localStorage\.setItem\(KEY,choice\)/);
  assert.doesNotMatch(layout, /weatherThemeToggle/);
  assert.doesNotMatch(html, /weatherThemeToggle/);
});

test("alert settings explain timing and preview the native notification summary", () => {
  const html = read("index.html");
  const insights = read("forecast-insights.js");

  for (const token of [
    'id="notificationPreviewTitle"',
    'id="notificationPreviewBody"',
    'id="notificationPreviewSchedule"',
    'id="morningTime"',
    'id="eveningTime"',
    "시간별",
    "활동 추천",
    "알림 설정"
  ]) assert.ok(html.includes(token), `missing notification preview token ${token}`);

  assert.match(insights, /function renderNotificationPreview\(\)/);
  assert.match(insights, /12시간 비 최고/);
  assert.match(insights, /우산 챙겨요/);
  assert.match(insights, /addEventListener\("change",renderNotificationPreview\)/);
});
