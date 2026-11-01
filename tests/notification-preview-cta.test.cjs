const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("미리보기 알림 보내기는 모바일에서 눈에 띄는 주요 버튼이다", () => {
  const html = read("index.html");
  const css = read("settings.css");
  const worker = read("sw.js");
  const logic = read("forecast-insights.js");

  assert.match(html, /class="watch-action notification-preview-send"/);
  assert.match(html, /id="previewNotification"[^>]*>\s*<span[^>]*>notifications_active<\/span>/);
  assert.match(css, /\.notification-preview-send #previewNotification\s*\{[^}]*width: 100%;[^}]*min-height: 62px/);
  assert.match(css, /background: linear-gradient\(135deg, #1671e8, #0f58c5\)/);
  assert.match(css, /box-shadow: 0 5px 0 #083e91/);
  assert.match(html, /id="notificationPreviewTemperature"/);
  assert.match(html, /id="notificationPreviewCondition"/);
  assert.match(css, /\.notification-preview-main b\s*\{[^}]*font-size: 30px/);
  assert.match(logic, /temperature\.textContent=finite\(temp\)\?number\(temp\)\+"°"/);
  assert.match(html, /settings\.css\?v=37/);
  assert.match(html, /forecast-insights\.js\?v=35/);
  assert.match(worker, /settings\.css\?v=37/);
  assert.match(worker, /forecast-insights\.js\?v=35/);
});
