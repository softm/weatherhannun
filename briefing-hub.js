(function(){
  "use strict";
  const $=id=>document.getElementById(id),KEY="weatherhannun_briefing_schedule_v1",LAST="weatherhannun_briefing_last_v1";
  let payload=null,items=[],selected="summary",playing=false;
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const settings=()=>window.WeatherHannunBriefingHubCore.normalizeSettings(JSON.parse(localStorage.getItem(KEY)||"null"));
  function saveSettings(){
    const value={enabled:$("briefScheduleEnabled").checked,types:Array.from(document.querySelectorAll("[data-brief-setting-type]:checked")).map(x=>x.value),morning:$("briefMorningTime").value,evening:$("briefEveningTime").value,delivery:document.querySelector("[name=briefDelivery]:checked")?.value};
    const next=window.WeatherHannunBriefingHubCore.normalizeSettings(value);localStorage.setItem(KEY,JSON.stringify(next));renderSettings(next);window.dispatchEvent(new CustomEvent("weatherhannun:briefing-settings",{detail:next}));if(next.enabled&&next.delivery!=="auto"&&"Notification" in window&&Notification.permission==="default")Notification.requestPermission();
  }
  function renderSettings(value=settings()){
    if(!$("briefScheduleEnabled"))return;$("briefScheduleEnabled").checked=value.enabled;$("briefMorningTime").value=value.morning;$("briefEveningTime").value=value.evening;
    document.querySelectorAll("[data-brief-setting-type]").forEach(x=>x.checked=value.types.includes(x.value));document.querySelectorAll("[name=briefDelivery]").forEach(x=>x.checked=x.value===value.delivery);
    $("briefScheduleStatus").textContent=value.enabled?`매일 ${value.morning} · ${value.evening} / ${value.delivery==="auto"?"바로 재생":value.delivery==="notice"?"알림만":"알림을 누르면 재생"}`:"예약 브리핑 꺼짐";
  }
  function sentenceNodes(text){return (String(text).match(/[^.!?。！？]+[.!?。！？]?\s*/g)||[text]).filter(Boolean);}
  function paintText(item){
    const box=$("briefHubText");box.replaceChildren();sentenceNodes(item.text).forEach((part,index)=>{const span=document.createElement("span");span.className="brief-hub-sentence";span.dataset.index=String(index);span.textContent=part;box.appendChild(span);});
  }
  function highlight(index){document.querySelectorAll(".brief-hub-sentence").forEach((x,i)=>x.classList.toggle("is-speaking",i===index));}
  function choose(id){selected=items.some(x=>x.id===id)?id:"summary";const item=items.find(x=>x.id===selected);if(!item)return;document.querySelectorAll("[data-brief-type]").forEach(x=>{const on=x.dataset.briefType===selected;x.classList.toggle("active",on);x.setAttribute("aria-pressed",String(on));});$("briefHubTitle").textContent=item.title;$("briefHubCaption").textContent=item.caption;paintText(item);$("briefHubEvidence").innerHTML=(item.evidence||[]).map(x=>`<span><small>${esc(x.label)}</small><b>${esc(x.value)}</b></span>`).join("");}
  function stop(message="재생을 멈췄습니다."){window.WeatherHannunCloudTTS?.stop?.();window.speechSynthesis?.cancel?.();playing=false;highlight(-1);const b=$("briefHubPlay");b?.classList.remove("is-playing");if(b)b.innerHTML='<span class="material-symbols-outlined" aria-hidden="true">play_arrow</span><span>이 브리핑 듣기</span>';if($("briefHubPlayStatus"))$("briefHubPlayStatus").textContent=message;}
  function devicePlay(item){
    if(!("speechSynthesis" in window))return stop("이 기기에서는 음성 재생을 지원하지 않습니다.");const parts=sentenceNodes(item.text),utterance=new SpeechSynthesisUtterance(item.text);utterance.lang="ko-KR";utterance.rate=.96;utterance.onboundary=e=>{let count=0,index=0;parts.forEach((p,i)=>{if(count<=e.charIndex)index=i;count+=p.length;});highlight(index);};utterance.onend=()=>stop("브리핑 재생 완료");utterance.onerror=()=>stop("음성을 재생하지 못했습니다.");window.speechSynthesis.speak(utterance);
  }
  async function play(itemOverride){
    const item=itemOverride?.text?itemOverride:items.find(x=>x.id===selected);if(!item)return;if(playing)return stop();playing=true;const b=$("briefHubPlay");b.classList.add("is-playing");b.innerHTML='<span class="material-symbols-outlined" aria-hidden="true">stop</span><span>재생 멈춤</span>';
    const cloud=window.WeatherHannunCloudTTS;if(!cloud?.configured?.())return devicePlay(item);
    try{await cloud.play(item.text,{onSentence:highlight,onStatus:message=>$("briefHubPlayStatus").textContent=message});stop("HD 브리핑 재생 완료");}catch(error){if(error?.name==="AbortError")return;$("briefHubPlayStatus").textContent="HD 음성 연결 실패 · 기기 음성으로 전환";devicePlay(item);}
  }
  function render(data){payload=data;items=window.WeatherHannunBriefingHubCore?.build(data)||[];const list=$("briefHubTypes");if(!list)return;list.innerHTML=items.map(x=>`<button type="button" data-brief-type="${x.id}" aria-pressed="false"><span class="material-symbols-outlined" aria-hidden="true">${x.icon}</span><span><b>${esc(x.title)}</b><small>${esc(x.caption)}</small></span></button>`).join("");choose(selected);}
  async function notify(item,tap){
    if(!("Notification" in window))return false;if(Notification.permission==="default")await Notification.requestPermission();if(Notification.permission!=="granted")return false;const note=new Notification(item.title,{body:item.text,icon:"./assets/brand/weatherhannun-192.png?v=18",tag:"weatherhannun-briefing"});if(tap)note.onclick=()=>{window.focus();document.querySelector('[data-view="briefing"]')?.click();choose(item.id);play(item);note.close();};return true;
  }
  async function runSchedule(){
    const value=settings();if(!value.enabled||!items.length)return;const now=new Date(),clock=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");if(![value.morning,value.evening].includes(clock))return;const key=now.toISOString().slice(0,10)+"-"+clock;if(localStorage.getItem(LAST)===key)return;localStorage.setItem(LAST,key);const selectedItems=value.types.map(id=>items.find(x=>x.id===id)).filter(Boolean),first=selectedItems[0]||items[0],item={id:first.id,title:"예약 날씨 브리핑",text:(selectedItems.length?selectedItems:[first]).map(x=>x.text).join(" ")};choose(first.id);
    if(value.delivery==="auto"){document.querySelector('[data-view="briefing"]')?.click();try{await play(item);}catch(_){await notify(item,true);}}else await notify(item,value.delivery==="tap");
  }
  function init(){
    $("briefHubTypes")?.addEventListener("click",e=>{const b=e.target.closest("[data-brief-type]");if(b)choose(b.dataset.briefType);});$("briefHubPlay")?.addEventListener("click",()=>play());$("briefingSettings")?.addEventListener("change",saveSettings);renderSettings();setInterval(runSchedule,30000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)runSchedule();});
  }
  window.addEventListener("weatherhannun:data",e=>render(e.detail));window.addEventListener("weatherhannun:view",e=>{if(e.detail.view==="briefing"&&e.detail.data)render(e.detail.data);});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
