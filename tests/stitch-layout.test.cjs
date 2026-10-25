"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = x => fs.readFileSync(x,"utf8");

test("Stitch design assets and theme are wired into page",()=>{
 const html=read("index.html"), css=read("stitch-theme.css"), js=read("stitch-layout.js"),sw=read("sw.js");
 assert.ok(html.includes("./stitch-theme.css"));
 assert.ok(html.includes("./stitch-layout.js"));
 assert.ok(html.indexOf('src="./stitch-layout.js"')<html.indexOf('src="./app.js"'));
 assert.ok(js.includes('id:"view-hourly"'));
 assert.ok(js.includes('data-view'));
 assert.ok(js.includes("weatherhannun:stitch-theme:v1"));
 assert.ok(css.includes('data-weather-theme="dark"'));
 assert.ok(sw.includes("./stitch-layout.js"));
 const icons=fs.readdirSync("assets/stitch").filter(x=>x.endsWith(".svg"));
 assert.equal(icons.length,10);
 for(const icon of icons)assert.match(read("assets/stitch/"+icon),/<svg[\s\S]*<\/svg>/);
});

test("navigation supports hourly and preserves existing views",()=>{
 const app=read("app.js");
 for(const key of ['"today"','"hourly"','"weekly"','"activity"','"air"','"map"'])assert.ok(app.includes(key));
 assert.ok(read("index.html").includes('id="view-today"'));
 assert.ok(read("index.html").includes('id="view-weekly"'));
});
