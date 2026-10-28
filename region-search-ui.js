/* WeatherHannun: Korea address search UI inspired by land-use search results.
 * Local static legal-dong/eup/myeon/ri centroids; no VWorld browser key.
 * Once loaded, search-as-you-type needs no per-keystroke network requests.
 */
(function(){
  "use strict";
  const core=window.WeatherRegionSearchCore;
  if(!core)return;
  const $=id=>document.getElementById(id);
  const DATA="./data/korea-regions-202602.json";
  const MAX_RESULTS=16;
  let index=null,loadPromise=null,results=[],revision=0,loading=false;
  function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function setPanelVisible(visible){
    const panel=$("regionSearchPanel");
    if(panel)panel.hidden=!visible;
    $("locationDialog")?.classList?.toggle("is-searching",Boolean(visible));
  }
  function renderHint(text,visible=true){
    const target=$("searchResults");
    if(!target)return;
    setPanelVisible(visible);
    target.innerHTML='<div class="region-search-hint">'+safe(text)+'</div>';
    $("locationSearch")?.setAttribute("aria-expanded","false");
  }
  function getIndex(){
    if(index)return Promise.resolve(index);
    if(loadPromise)return loadPromise;
    loading=true;
    const controller=typeof AbortController==="function"?new AbortController():null;
    const tid=controller?setTimeout(()=>controller.abort(),15000):null;
    const options=controller?{signal:controller.signal,cache:"force-cache"}:{cache:"force-cache"};
    loadPromise=fetch(DATA,options).then(resp=>{
      if(!resp.ok)throw new Error("지역 목록을 가져올 수 없습니다 ("+resp.status+")");
      return resp.json();
    }).then(data=>{
      index=core.load(data);
      return index;
    }).finally(()=>{if(tid!==null)clearTimeout(tid);loading=false;});
    return loadPromise.catch(err=>{loadPromise=null;throw err;});
  }
  function itemHtml(entry,i){
    const parts=String(entry.full||entry.name||"").split(/\s+/).filter(Boolean);
    const primary=parts.length>=3?parts.slice(-2).join(" "):entry.name;
    const parent=parts.length>=3?parts.slice(0,-2).join(" "):parts.slice(0,-1).join(" ");
    return '<button class="region-result" type="button" role="option" id="regionOption'+i+'" aria-selected="false" data-region-choice="'+i+'">'+
      '<span class="region-result-icon material-symbols-outlined" aria-hidden="true">location_on</span>'+
      '<span class="region-result-body"><b>'+safe(primary)+'</b><small>'+safe(parent)+'</small></span>'+
      '<span class="region-result-arrow material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>';
  }
  function renderResults(entries,rawQuery){
    results=entries||[];
    const area=$("searchResults");
    if(!area)return;
    setPanelVisible(true);
    const ignoredLot=core.removeLot(rawQuery)!==core.clean(rawQuery);
    const numericNote=core.isStreet(rawQuery)?
      '<p class="region-search-note">도로명·건물번호는 반영하지 않았습니다. 입력한 시·군·구까지만 식별된 지역의 대표 좌표로 날씨를 조회합니다.</p>':
      ignoredLot?'<p class="region-search-note">지번 숫자는 적용하지 않고 동·리의 대표 위치로 조회합니다. 특정 필지 위치가 아닙니다.</p>':"";
    if(!results.length){
      const road=core.isStreet(rawQuery);
      renderHint(road?
        "도로명·건물번호만으로는 정확한 지점을 판별할 수 없습니다. 동·읍·면·리 이름을 입력해 지역 대표 위치를 선택해 주세요.":
        "해당 지역을 찾지 못했습니다. 시·군·구와 동·리 이름을 함께 입력해 보세요. (예: 부천 소사구 옥길동)");
      return;
    }
    const top=results.slice(0,MAX_RESULTS);
    area.innerHTML=numericNote+'<div class="region-result-list" role="group" aria-label="지역 검색 결과">'+top.map(itemHtml).join("")+'</div>'+
      '<p class="region-search-note">선택한 행정구역의 대표 위치를 기준으로 날씨를 조회합니다.</p>';
    $("locationSearch")?.setAttribute("aria-expanded","true");
  }
  async function runSearch(force){
    const field=$("locationSearch"),raw=field?.value?.trim()||"",id=++revision;
    if(raw.length<2){results=[];renderHint("동·읍·면·리 또는 시·군·구 주소를 두 글자 이상 입력하세요. 예: 광명, 옥길동, 부천 소사구",false);return;}
    if(!index){
      renderHint("전국 읍·면·동 주소 목록을 준비하고 있습니다…");
      try{await getIndex();}catch(error){
        if(id!==revision)return;
        renderHint("전국 주소 자료를 불러오지 못했습니다. 잠시 후 다시 시도하거나 빠른 지역 선택을 사용해 주세요.");
        return;
      }
    }
    if(id!==revision)return;
    let nearby=null;
    try{nearby=JSON.parse(localStorage.getItem("weatherhannun_location")||"null");}catch(_){}
    const found=core.search(index,raw,{limit:MAX_RESULTS,
      biasLat:nearby?.lat,biasLon:nearby?.lon});
    renderResults(found,raw);
  }
  function select(id){
    const item=results[Number(id)],place=core.toLocation(item);
    if(!place)return;
    const dialog=$("locationDialog");
    if(dialog?.open)dialog.close();
    const input=$("locationSearch");if(input){input.value="";input.setAttribute("aria-expanded","false");}
    window.dispatchEvent(new CustomEvent("weatherhannun:change-location",{detail:place}));
  }
  function onSelectClick(event){
    const btn=event.target?.closest?.("[data-region-choice]");
    if(btn)select(btn.dataset.regionChoice);
  }
  function onKey(event){
    const input=$("locationSearch");
    if(event.key==="ArrowDown"&&results.length){
      const first=$("regionOption0");if(first){event.preventDefault();first.focus();}
    }
    if(event.key==="Escape"&&results.length){results=[];renderHint("검색창에 다른 지역명을 입력하세요.",false);}
  }
  function onResultKey(event){
    const el=event.target?.closest?.("[data-region-choice]");
    if(!el)return;
    const index=Number(el.dataset.regionChoice);
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      event.preventDefault();
      const i=Math.min(results.length-1,Math.max(0,index+(event.key==="ArrowDown"?1:-1)));
      $("regionOption"+i)?.focus();
    }else if(event.key==="Escape"){event.preventDefault();$("locationSearch")?.focus();}
  }
  function init(){
    const field=$("locationSearch"),form=$("searchForm"),resultsBox=$("searchResults"),dialog=$("locationDialog");
    if(!field||!form||!resultsBox)return;
    field.placeholder="지역명 검색 (예: 오이도, 옥길동)";
    field.setAttribute("role","combobox");
    field.setAttribute("aria-autocomplete","list");
    field.setAttribute("aria-controls","searchResults");
    field.setAttribute("aria-expanded","false");
    resultsBox.setAttribute("aria-label","전국 지역 검색 결과");
    resultsBox.setAttribute("role","listbox");
    form.addEventListener("submit",event=>{event.preventDefault();runSearch(true);});
    field.addEventListener("input",()=>runSearch(false));
    field.addEventListener("focus",()=>{if(!index)getIndex().catch(()=>{});if(field.value.trim().length>=2)runSearch(false);});
    field.addEventListener("keydown",onKey);
    resultsBox.addEventListener("click",onSelectClick);
    resultsBox.addEventListener("keydown",onResultKey);
    dialog?.addEventListener("close",()=>{revision++;results=[];field.value="";field.setAttribute("aria-expanded","false");setPanelVisible(false);});
    renderHint("지역명을 입력해 주세요.",false);
  }
  window.WeatherRegionSearch={search:runSearch};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
