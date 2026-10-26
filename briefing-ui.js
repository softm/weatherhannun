/* 날씨한눈: meteorologist-aware language + presenter UX + local favorites.
 * Deliberately no generative AI and no ungrounded official-alert claims.
 */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  let mode="short",briefing=null;
  const esc=value=>String(value===undefined||value===null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function paintBriefingText(){
    const el=$("briefingText");
    if(!el||!briefing)return;
    const sentence=mode==="detail"?briefing.detail:briefing.short;
    const highlighter=window.WeatherBriefingHighlights;
    if(highlighter)highlighter.render(el,sentence,{where:briefing.where,events:briefing.events});
    else el.textContent=sentence;
  }
  function evidenceText(e){return '<div class="brief-evidence-pair"><dt>'+esc(e.label)+'</dt><dd>'+esc(e.value)+'</dd></div>';}
  function showMode(next){
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
    $("briefingSource").textContent=briefing.source+" · 관측 실황 아님";
    const state=payload.status==="live"?"방금 API 조회":payload.status==="cached-error"?"통신 오류 · 저장된 예보":"저장된 예보";
    const out=briefing.freshness.state==="stale"?"오래된 예보 · 재조회 필요":state;
    $("briefingFreshness").textContent=out;
    $("briefingFreshness").className="briefing-freshness "+(briefing.freshness.state==="stale"||payload.status==="cached-error"?"stale":payload.status==="live"?"live":"cached");
    const time=briefing.validAt||"—";
    $("briefingValidAt").textContent="예보 유효시각: "+time.replace("T"," ")+" (KST) / 모델 산출시각 별도 미제공";
    $("briefingEvidence").innerHTML=briefing.evidence.map(evidenceText).join("");
    $("briefingChangeEvents").innerHTML=briefing.events.length?briefing.events.slice(0,3).map(x=>'<div class="briefing-event"><span class="briefing-event-icon" aria-hidden="true">'+esc(x.icon)+'</span><div><b>'+esc(x.title)+'</b><small>'+esc(core.dateText(x.time))+'</small><span>'+esc(x.evidence)+'</span></div></div>').join(""):'<div class="briefing-no-event">설정된 기준에 해당하는 큰 변화는 없습니다.<small>기상특보가 없다는 의미는 아닙니다.</small></div>';
  }
  function init(){
    document.querySelectorAll("[data-brief-mode]").forEach(btn=>btn.addEventListener("click",()=>showMode(btn.dataset.briefMode)));
    showMode(mode);
  }
  window.addEventListener("weatherhannun:data",event=>renderBriefing(event.detail));
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();