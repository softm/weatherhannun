const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("web favicon, header and PWA keep the v18 brand while the shell includes v19 alerts", () => {
  const index = read("index.html");
  const theme = read("stitch-theme.css");
  const manifest = read("manifest.webmanifest");
  const worker = read("sw.js");

  assert.match(index, /icon\.svg\?v=18/);
  assert.match(index, /apple-touch-icon/);
  assert.match(theme, /url\("\.\/icon\.svg\?v=18"\)/);
  assert.match(manifest, /icon\.svg\?v=18/);
  assert.match(manifest, /weatherhannun-512\.png\?v=18/);
  assert.match(worker, /weatherhannun-shell-v19-background-alerts/);
  assert.match(worker, /alert-rules-core\.js\?v=19/);
});

test("brand master keeps the fixed high-contrast MZ palette and simple silhouette", () => {
  const icon = read("icon.svg");
  for (const token of ["#0B1730", "#FFD84A", "#FF9F1C", "#F8FCFF", "#CFE4F7", "#68F0C4"]) {
    assert.ok(icon.includes(token), `missing ${token}`);
  }
  assert.match(icon, /#FFB020/);
  assert.doesNotMatch(icon, /<text|font-family/);
});
