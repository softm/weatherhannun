/* 날씨한눈: meteorologist-aware language + presenter UX + local favorites.
 * Deliberately no generative AI and no ungrounded official-alert claims.
 */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const FAVORITES="weatherhannun_favorite_locations_v1";
  const limit=5;
  let mode="short",latest=null,activeLoc=null,briefing=null;
  function esc(value){return String(value===undefined||value===null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function validLoc(x){return x && typeof x.name==="string" && x.name.length>0 && Number.isFinite(Number(x.lat)) && Math.abs(Number(x.lat))<=90 && Number.isFinite(Number(x.lon)) && Math.abs(Number(x.lon))<=180;}
  function readFavorites(){try{let x=JSON.parse(localStorage.getItem(FAVORITES)||"[]");return Array.isArray(x)?x.filter(validLoc).slice(0,limit).map(l=>({name:String(l.name).slice(0,45),lat:Number(l.lat),lon:Number(l.lon)})):[];}catch(_){return [];}}
  function storeFavorites(items){try{localStorage.setItem(FAVORITES,JSON.stringify(items));}catch(_){message("저장 공간에 접근할 수 없습니다.");}}
  function same(a,b){return validLoc(a)&&validLoc(b)&&Math.abs(Number(a.lat)-Number(b.lat))<0.002&&Math.abs(Number(a.lon)-Number(b.lon))<0.002;}
  function message(s){if($("favoriteMessage"))$("favoriteMessage").textContent=s;}
  function renderFavorites(){
    const list=readFavorites(),target=$("favoriteLocations");
    if(!target)return;
    target.innerHTML=list.length?list.map((loc,i)=>'<div class="favorite-row"><button type="button" data-favorite="'+i+'" class="favorite-choice '+(same(loc,activeLoc)?"selected":"")+'">★ '+esc(loc.name)+'</button><button type="button" data-delete-favorite="'+i+'" class="favorite-delete" aria-label="'+esc(loc.name)+' 관심 지역 삭제">✕</button></div>').join(""):'<p class="muted-text">아직 저장한 지역이 없어요. 자주 보는 곳을 최대 5개 저장할 수 있습니다.</p>';
    const saved=activeLoc&&list.some(x=>same(x,activeLoc));
    if($("saveCurrentLocation"))$("saveCurrentLocation").textContent=saved?"★ 저장된 지역":"☆ 현재 지역 저장";
    if($("saveCurrentLocation"))$("saveCurrentLocation").disabled=!!saved;
  }
  function onFavoritesClick(e){
    const deleteButton=e.target.closest("[data-delete-favorite]");
    const btn=e.target.closest("[data-favorite]");
    if(deleteButton){
      const list=readFavorites(),i=Number(deleteButton.dataset.deleteFavorite);
      if(i>=0&&i<list.length){list.splice(i,1);storeFavorites(list);renderFavorites();message("관심 지역에서 삭제했습니다.");}
      return;
    }
    if(btn){
      const loc=readFavorites()[Number(btn.dataset.favorite)];if(!loc)return;
      $("locationDialog").close();
      window.dispatchEvent(new CustomEvent("weatherhannun:change-location",{detail:loc}));
    }
  }
  function saveCurrent(){
    if(!validLoc(activeLoc)){message("먼저 지역을 선택해 주세요.");return;}
    const list=readFavorites();
    if(list.some(x=>same(x,activeLoc))){message("이미 저장된 지역입니다.");return;}
    if(list.length>=limit){message("관심 지역은 최대 "+limit+"곳까지 저장할 수 있습니다.");return;}
    list.push({name:activeLoc.name,lat:Number(activeLoc.lat),lon:Number(activeLoc.lon)});
    storeFavorites(list);renderFavorites();message("★ "+activeLoc.name+"을(를) 저장했습니다.");
  }
  function evidenceText(e){return '<div class="brief-evidence-pair"><dt>'+esc(e.label)+'</dt><dd>'+esc(e.value)+'</dd></div>';}
  function showMode(next){
    mode=next==="detail"?"detail":"short";
    document.querySelectorAll("[data-brief-mode]").forEach(b=>{const selected=b.dataset.briefMode===mode;b.classList.toggle("active",selected);b.setAttribute("aria-pressed",String(selected));});
    if($("briefingText")&&briefing)$("briefingText").textContent=mode==="detail"?briefing.detail:briefing.short;
    if($("briefingModeTitle"))$("briefingModeTitle").textContent=mode==="detail"?"30초 상세 해설":"10초 날씨 브리핑";
  }
  function renderBriefing(payload){
    const core=window.WeatherHannunBriefingCore;
    if(!core||!payload||!$("briefingText"))return;
    latest=payload;
    activeLoc=payload.loc;
    briefing=core.analyse(payload);
    $("briefingHeadline").textContent=briefing.headline;
    $("briefingText").textContent=mode==="detail"?briefing.detail:briefing.short;
    $("briefingSource").textContent=briefing.source+" · 관측 실황 아님";
    const state=payload.status==="live"?"방금 API 조회":payload.status==="cached-error"?"통신 오류 · 저장된 예보":"저장된 예보";
    const out=briefing.freshness.state==="stale"?"오래된 예보 · 재조회 필요":state;
    $("briefingFreshness").textContent=out;
    $("briefingFreshness").className="briefing-freshness "+(briefing.freshness.state==="stale"||payload.status==="cached-error"?"stale":payload.status==="live"?"live":"cached");
    const time=briefing.validAt||"—";
    $("briefingValidAt").textContent="예보 유효시각: "+time.replace("T"," ")+" (KST) / 모델 산출시각 별도 미제공";
    $("briefingEvidence").innerHTML=briefing.evidence.map(evidenceText).join("");
    $("briefingChangeEvents").innerHTML=briefing.events.length?briefing.events.slice(0,3).map(x=>'<div class="briefing-event"><span class="briefing-event-icon" aria-hidden="true">'+esc(x.icon)+'</span><div><b>'+esc(x.title)+'</b><small>'+esc(core.dateText(x.time))+'</small><span>'+esc(x.evidence)+'</span></div></div>').join(""):'<div class="briefing-no-event">설정된 기준에 해당하는 큰 변화는 없습니다.<small>기상특보가 없다는 의미는 아닙니다.</small></div>';
    renderFavorites();
  }
  function init(){
    document.querySelectorAll("[data-brief-mode]").forEach(btn=>btn.addEventListener("click",()=>showMode(btn.dataset.briefMode)));
    $("favoriteLocations")?.addEventListener("click",onFavoritesClick);
    $("saveCurrentLocation")?.addEventListener("click",saveCurrent);
    renderFavorites();
    showMode(mode);
  }
  window.addEventListener("weatherhannun:data",event=>renderBriefing(event.detail));
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();