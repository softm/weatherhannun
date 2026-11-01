const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");

test("브리핑 음성 재생과 현재 문장 강조 UI를 제공한다",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const js=fs.readFileSync(path.join(root,"briefing-ui.js"),"utf8");
  const css=fs.readFileSync(path.join(root,"briefing-ui.css"),"utf8");
  assert.match(html,/id="briefingPlay"/);
  assert.match(html,/브리핑 듣기/);
  assert.match(js,/SpeechSynthesisUtterance/);
  assert.match(js,/WeatherHannunBriefingPlayer/);
  assert.match(css,/\.briefing-sentence\.is-speaking/);
});

test("알림 미리보기와 오프라인 셸에 브리핑 듣기가 반영된다",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const worker=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  assert.match(html,/volume_up[\s\S]*브리핑 듣기/);
  assert.match(worker,/briefing-ui\.js\?v=21/);
  assert.match(worker,/briefing-ui\.css\?v=21/);
});
