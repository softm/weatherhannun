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
  assert.match(worker,/briefing-ui\.css\?v=23/);
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

test("홈 브리핑 카드에서 전용 브리핑 룸으로 이동한다",()=>{
  const template=fs.readFileSync(path.join(root,"stitch-today.template.html"),"utf8");
  const script=fs.readFileSync(path.join(root,"stitch-today.js"),"utf8");
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.match(template,/data-stitch-brief-room[\s\S]*브리핑 룸/);
  assert.match(script,/briefRoom[\s\S]*go\('briefing'\)/);
  assert.match(html,/class="briefing-room-link" data-view="briefing"/);
});

test("브리핑 음성은 기기 합성을 기본으로 사용하고 Google TTS를 요청하지 않는다",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const today=fs.readFileSync(path.join(root,"stitch-today.js"),"utf8");
  const hub=fs.readFileSync(path.join(root,"briefing-hub.js"),"utf8");
  const compact=fs.readFileSync(path.join(root,"briefing-ui.js"),"utf8");
  const worker=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  assert.doesNotMatch(html,/weatherhannun-tts-endpoint|briefing-cloud-tts\.js|cloudfunctions\.net\/weatherBriefingTts/);
  assert.doesNotMatch(today,/WeatherHannunCloudTTS|cloud\.play/);
  assert.doesNotMatch(hub,/WeatherHannunCloudTTS|cloud\.play/);
  assert.doesNotMatch(worker,/briefing-cloud-tts\.js/);
  assert.match(today,/speechSynthesis\.speak\(utterance\)/);
  assert.match(hub,/speechSynthesis\.speak\(utterance\)/);
  assert.match(compact,/speechSynthesis\.speak\(next\)/);
  assert.match(html,/기기 음성 브리핑/);
  assert.match(today,/playStitchSpeech/);
  assert.match(hub,/devicePlay\(item\)/);
});
