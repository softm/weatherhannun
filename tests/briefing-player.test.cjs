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
  assert.match(worker,/briefing-ui\.js\?v=22/);
  assert.match(worker,/briefing-ui\.css\?v=22/);
});

test("실제 오늘 화면의 기상브리핑 카드에 듣기 버튼과 재생 강조가 표시된다",()=>{
  const template=fs.readFileSync(path.join(root,"stitch-today.template.html"),"utf8");
  const script=fs.readFileSync(path.join(root,"stitch-today.js"),"utf8");
  const css=fs.readFileSync(path.join(root,"stitch-today.css"),"utf8");
  assert.match(template,/data-stitch-brief-play[\s\S]*브리핑 듣기/);
  assert.match(script,/playStitchSpeech/);
  assert.match(script,/stitch-brief-sentence/);
  assert.match(css,/\.stitch-brief-sentence\.is-speaking/);
});

test("Google HD 음성은 서버 중계로 호출하고 실패하면 기기 음성으로 전환한다",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const cloud=fs.readFileSync(path.join(root,"briefing-cloud-tts.js"),"utf8");
  const today=fs.readFileSync(path.join(root,"stitch-today.js"),"utf8");
  const worker=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  assert.match(html,/weatherhannun-tts-endpoint/);
  assert.match(html,/cloudfunctions\.net\/weatherBriefingTts\/v1\/briefing\/speech/);
  assert.match(html,/briefing-cloud-tts\.js\?v=1/);
  assert.match(cloud,/method:"POST"/);
  assert.doesNotMatch(cloud,/API[_-]?KEY|AIza/i);
  assert.match(today,/WeatherHannunCloudTTS/);
  assert.match(today,/playDeviceSpeech/);
  assert.match(worker,/briefing-cloud-tts\.js\?v=1/);
});
