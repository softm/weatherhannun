/* 날씨한눈: meteorologist-aware language + presenter UX + local favorites.
 * Deliberately no generative AI and no ungrounded official-alert claims.
 */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  let mode="short",briefing=null,spokenText="",utterance=null,activeSentence=-1,playRequested=false;
  const esc=value=>String(value===undefined||value===null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function paintBriefingText(){
    const el=$("briefingText");
    if(!el||!briefing)return;
    const sentence=mode==="detail"?briefing.detail:briefing.short;
    const highlighter=window.WeatherBriefingHighlights;
    spokenText=sentence;
    const parts=sentence.match(/[^.!?。！？]+[.!?。！？]?\s*/g)||[sentence];
    el.replaceChildren();
    parts.forEach((part,index)=>{
      const span=document.createElement("span");
      span.className="briefing-sentence";
      span.dataset.sentenceIndex=String(index);
      span.dataset.start=String(parts.slice(0,index).join("").length);
      if(highlighter)highlighter.render(span,part,{where:briefing.where,events:briefing.events});
      else span.textContent=part;
      el.appendChild(span);
    });
    setActiveSentence(activeSentence);
  }
  function setActiveSentence(index){
    activeSentence=index;
    document.querySelectorAll("#briefingText .briefing-sentence").forEach((node,i)=>node.classList.toggle("is-speaking",i===index));
    const current=document.querySelector('#briefingText .briefing-sentence.is-speaking');
    current?.scrollIntoView?.({block:"nearest",behavior:"smooth"});
  }
  function stopBriefing(message="재생을 멈췄습니다."){
    if("speechSynthesis" in window)window.speechSynthesis.cancel();
    utterance=null;setActiveSentence(-1);
    const button=$("briefingPlay"),status=$("briefingPlayStatus");
    if(button){button.classList.remove("is-playing");button.setAttribute("aria-pressed","false");button.querySelector(".material-symbols-outlined").textContent="play_arrow";button.querySelector("span:last-child").textContent="브리핑 듣기";}
    if(status)status.textContent=message;
  }
  function playBriefing(){
    if(!briefing||!spokenText){playRequested=true;const status=$("briefingPlayStatus");if(status)status.textContent="최신 예보를 불러온 뒤 자동으로 재생합니다.";return;}
    playRequested=false;
    if(!("speechSynthesis" in window)){const status=$("briefingPlayStatus");if(status)status.textContent="이 기기에서는 음성 재생을 지원하지 않습니다.";return;}
    if(utterance){stopBriefing();return;}
    window.speechSynthesis.cancel();
    const next=new SpeechSynthesisUtterance(spokenText);
    next.lang="ko-KR";next.rate=1;next.pitch=1;
    next.onboundary=event=>{
      const sentences=Array.from(document.querySelectorAll("#briefingText .briefing-sentence"));
      let index=0;sentences.forEach((node,i)=>{if(Number(node.dataset.start)<=event.charIndex)index=i;});
      setActiveSentence(index);
      const status=$("briefingPlayStatus");if(status)status.textContent=(index+1)+" / "+sentences.length+" 문장 재생 중";
    };
    next.onend=()=>stopBriefing("브리핑 재생을 마쳤습니다.");
    next.onerror=()=>stopBriefing("음성 재생을 완료하지 못했습니다. 다시 눌러 주세요.");
    utterance=next;setActiveSentence(0);
    const button=$("briefingPlay");if(button){button.classList.add("is-playing");button.setAttribute("aria-pressed","true");button.querySelector(".material-symbols-outlined").textContent="stop";button.querySelector("span:last-child").textContent="재생 멈춤";}
    const status=$("briefingPlayStatus");if(status)status.textContent="브리핑을 재생합니다.";
    window.speechSynthesis.speak(next);
  }
  function evidenceText(e){return '<div class="brief-evidence-pair"><dt>'+esc(e.label)+'</dt><dd>'+esc(e.value)+'</dd></div>';}
  function showMode(next){
    if(utterance)stopBriefing("길이를 바꿨습니다. 재생 버튼을 눌러 주세요.");
    mode=next==="detail"?"detail":"short";
    document.querySelectorAll("[data-brief-mode]").forEach(b=>{const selected=b.dataset.briefMode===mode;b.classList.toggle("active",selected);b.setAttribute("aria-pressed",String(selected));});
    paintBriefingText();
    if($("briefingModeTitle"))$("briefingModeTitle").textContent=mode==="detail"?"30초 상세 해설":"10초 날씨 브리핑";
  }
  function renderBriefing(payload){
    const core=window.WeatherHannunBriefingCore;
    if(!core||!payload||!$("briefingText"))return;
    briefing=core.analyse(payload);
    $("briefingHeadline").textContent=briefing.headline;
    paintBriefingText();
    $("briefingSource").textContent=briefing.source;
    const state=payload.status==="live"?"방금 API 조회":payload.status==="cached-error"?"통신 오류 · 저장된 예보":"저장된 예보";
    const out=briefing.freshness.state==="stale"?"오래된 예보 · 재조회 필요":state;
    $("briefingFreshness").textContent=out;
    $("briefingFreshness").className="briefing-freshness "+(briefing.freshness.state==="stale"||payload.status==="cached-error"?"stale":payload.status==="live"?"live":"cached");
    const time=briefing.validAt||"—";
    $("briefingValidAt").textContent="예보 유효시각: "+time.replace("T"," ")+" (KST) / 모델 산출시각 별도 미제공";
    $("briefingEvidence").innerHTML=briefing.evidence.map(evidenceText).join("");
    $("briefingChangeEvents").innerHTML=briefing.events.length?briefing.events.slice(0,3).map(x=>'<div class="briefing-event"><span class="briefing-event-icon" aria-hidden="true">'+esc(x.icon)+'</span><div><b>'+esc(x.title)+'</b><small>'+esc(core.dateText(x.time))+'</small><span>'+esc(x.evidence)+'</span></div></div>').join(""):'<div class="briefing-no-event">설정된 기준에 해당하는 큰 변화는 없습니다.<small>기상특보가 없다는 의미는 아닙니다.</small></div>';
    if(playRequested)setTimeout(playBriefing,80);
  }
  function init(){
    document.querySelectorAll("[data-brief-mode]").forEach(btn=>btn.addEventListener("click",()=>showMode(btn.dataset.briefMode)));
    showMode(mode);
    $("briefingPlay")?.addEventListener("click",playBriefing);
  }
  window.addEventListener("weatherhannun:data",event=>renderBriefing(event.detail));
  window.WeatherHannunBriefingPlayer={play(){document.querySelector('[data-view="today"]')?.click();setTimeout(()=>{const visible=document.querySelector('[data-stitch-brief-play]');if(visible){visible.scrollIntoView({block:"center",behavior:"smooth"});visible.click();return;}$("briefingText")?.scrollIntoView({block:"center",behavior:"smooth"});playBriefing();},180);},stop:stopBriefing};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
