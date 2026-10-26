/* Semantic weather briefing highlighting — Node native test runner */
const test=require("node:test");
const assert=require("node:assert/strict");
const {ranges,render}=require("../briefing-highlights.js");

const caption="옥길동의 현재 모델 예보는 대체로 맑거나 구름이 조금 있고 기온은 19°C입니다. 바람 강해질 가능성 — 10월 27일 12시를 확인해 주세요.";
const fact={where:"옥길동",events:[{id:"wind",title:"바람 강해질 가능성",time:"2026-10-27T12:00",severity:"caution"}]};
function highlighted(parts){return parts.filter(p=>p.kind).map(p=>({text:p.text,kind:p.kind}));}
function complete(parts){return parts.map(p=>p.text).join("");}

test("Stitch caster sample: preserves every original character",()=>{
  const parts=ranges(caption,fact);
  assert.equal(complete(parts),caption);
});
test("Stitch caster sample: blue place and temperature, green sky, amber wind hazard",()=>{
  const found=highlighted(ranges(caption,fact));
  assert.ok(found.some(p=>p.text==="옥길동"&&p.kind==="place"));
  assert.ok(found.some(p=>p.text==="대체로 맑거나 구름이 조금 있고"&&p.kind==="sky"));
  assert.ok(found.some(p=>p.text==="19°C"&&p.kind==="temperature"));
  assert.ok(found.some(p=>p.text==="바람 강해질 가능성"&&p.kind==="alert"));
  assert.ok(found.some(p=>p.text==="10월 27일 12시"&&p.kind==="time-warning"));
});
test("Calm, sunny forecast does not insert a warning highlight",()=>{
  const t="부천의 현재 모델 예보는 맑고 기온은 17°C입니다. 오늘은 가까운 시간의 큰 위험 신호가 없습니다.";
  const found=highlighted(ranges(t,{where:"부천",events:[]}));
  assert.ok(found.some(p=>p.kind==="place"));
  assert.ok(found.some(p=>p.kind==="sky"));
  assert.ok(found.some(p=>p.kind==="temperature"));
  assert.ok(!found.some(p=>p.kind==="alert"||p.kind==="time-warning"));
});
test("30-second explanation handles numerical evidence, consecutive events and safe actions",()=>{
  const t="서산의 현재 모델 예보는 흐리고 기온은 8°C입니다. 비 가능성 증가 — 10월 26일 15시. 강수확률 65%, 시간당 0.8mm. 이동과 시설물 관리에 유의하세요.";
  const segments=ranges(t,{where:"서산",events:[{title:"비 가능성 증가",time:"2026-10-26T15:00",severity:"caution"}]});
  assert.equal(complete(segments),t);
  const found=highlighted(segments);
  assert.ok(found.some(x=>x.text==="65%"&&x.kind==="metric"));
  assert.ok(found.some(x=>x.text==="0.8mm"&&x.kind==="metric"));
  assert.ok(found.some(x=>x.kind==="action"));
  assert.ok(found.some(x=>x.kind==="time-warning"));
  assert.ok(found.every(x=>x.text.length>0));
});
test("Snow/rain words are never given the sunny green classification",()=>{
  const x=highlighted(ranges("눈이 예상되고 기온은 -2°C입니다.",{}));
  assert.equal(x.find(y=>y.text==="눈이 예상되고")?.kind,"alert");
  assert.equal(x.find(y=>y.text==="-2°C")?.kind,"temperature");
});
test("Plain text fallback and generic non-hazard time remain intact",()=>{
  const txt="정보를 불러오는 중입니다. 10월 27일 12시 다시 확인해 주세요.";
  const x=ranges(txt,{});
  assert.equal(complete(x),txt);
  assert.equal(x.find(v=>v.text==="10월 27일 12시")?.kind,"time");
});
test("DOM-safe rendering keeps untrusted text as text nodes, not HTML",()=>{
  const made=[];
  const doc={
    createTextNode(text){const node={nodeType:3,textContent:text};made.push(node);return node;},
    createElement(tag){assert.equal(tag,"mark");const node={nodeType:1,tagName:tag,className:"",textContent:""};made.push(node);return node;}
  };
  const target={ownerDocument:doc,textContent:"",replaceChildren(...nodes){this.children=nodes;this.textContent=nodes.map(n=>n.textContent).join("");}};
  const unsafe='서산은 맑고 기온 22°C입니다. <img src=x onerror="alert(1)">';
  const items=render(target,unsafe,{where:"서산"});
  assert.equal(target.textContent,unsafe);
  assert.equal(complete(items),unsafe);
  assert.ok(target.children.every(node=>node.nodeType===3||(node.tagName==="mark"&&node.className.includes("weather-brief-mark--"))));
  assert.ok(target.children.some(node=>node.nodeType===3&&node.textContent.includes("<img")));
  assert.ok(!target.children.some(node=>node.tagName==="img"));
});
test("When no DOM renderer is available, use safe textContent fallback",()=>{
  const target={textContent:""};
  const sample="서산 20°C";
  const parts=render(target,sample,{where:"서산"});
  assert.equal(target.textContent,sample);
  assert.equal(complete(parts),sample);
});
test("Repeated forecast events never overlap or duplicate the sentence",()=>{
 const sentence="비 가능성 증가 — 10월 27일 12시. 비 가능성 증가 — 10월 28일 09시.";
 const parts=ranges(sentence,{where:"",events:[
   {title:"비 가능성 증가",time:"2026-10-27T12:00",severity:"caution"},
   {title:"비 가능성 증가",time:"2026-10-28T09:00",severity:"caution"}
 ]});
 assert.equal(complete(parts),sentence);
 assert.equal(parts.filter(x=>x.kind==="alert").length,2);
 assert.equal(parts.filter(x=>x.kind==="time-warning").length,2);
});
