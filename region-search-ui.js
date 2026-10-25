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
  function renderHint(text){
    const target=$("searchResults");
    if(!target)return;
    target.innerHTML='<div class="region-search-hint">'+safe(text)+'</div>';
    $("locationSearch")?.setAttribute("aria-expanded","false");
  }
  function showSource(){
    const label=$("regionSearchSource");
    if(label)label.innerHTML='전국 법정동·읍·면·리 (2026.02 기준) · <a href="https://github.com/swuhalee/korea-regions-with-coords" target="_blank" rel="noopener noreferrer">데이터 출처</a> · 지역 대표 좌표';
  }
  function getIndex(){
    if(index)return Promise.resolve(index);
    if(loadPromise)return loadPromise;
    loading=true;
    const controller=new AbortController();
    const tid=setTimeout(()=>controller.abort(),15000);
    loadPromise=fetch(DATA,{signal:controller.signal,cache:"force-cache"}).then(resp=>{
      if(!resp.ok)throw new Error("지역 목록을 가져올 수 없습니다 ("+resp.status+")");
      return resp.json();
    }).then(data=>{
      index=core.load(data);
      showSource();
      return index;
    }).finally(()=>{clearTimeout(tid);loading=false;});
    return loadPromise.catch(err=>{loadPromise=null;throw err;});
  }
  function itemHtml(entry,i,query){
    const kind=entry.label;
    const address=entry.full;
    const last=entry.name;
    const suffix=entry.kind==="ri"?"리 단위":entry.kind==="dong"?"법정동":entry.kind==="eup"||entry.kind==="myeon"?"읍·면":"행정구역";
    const qualified=entry.short;
    return '<button class="region-result" type="button" role="option" id="regionOption'+i+'" aria-selected="false" data-region-choice="'+i+'">'+
      '<span class="region-result-icon" aria-hidden="true">⌖</span>'+
      '<span class="region-result-body"><b>'+safe(qualified)+'</b><span>'+safe(address)+'</span><small>지역 대표 좌표 · '+safe(suffix)+'</small></span>'+
      '<span class="region-result-kind">'+safe(kind)+'</span></button>';
  }
  function renderResults(entries,rawQuery){
    results=entries||[];
    const area=$("searchResults");
    if(!area)return;
    const ignoredLot=core.removeLot(rawQuery)!==core.clean(rawQuery);
    const numericNote=ignoredLot?'<p class="region-search-note">지번 숫자는 적용하지 않고 동·리의 대표 위치로 조회합니다. 특정 필지 위치가 아닙니다.</p>':"";
    if(!results.length){
      const road=core.isStreet(rawQuery);
      renderHint(road?
        "도로명·건물번호만으로는 정확한 지점을 판별할 수 없습니다. 동·읍·면·리 이름을 입력해 지역 대표 위치를 선택해 주세요.":
        "해당 지역을 찾지 못했습니다. 시·군·구와 동·리 이름을 함께 입력해 보세요. (예: 부천 소사구 옥길동)");
      return;
    }
    const top=results.slice(0,MAX_RESULTS);
    area.innerHTML='<p class="region-search-count">지역 검색 결과 '+results.length+'개 · 시·군·구까지 확인해 선택하세요.</p>'+
      numericNote+'<div class="region-result-list" role="group" aria-label="지역 검색 결과">'+top.map(itemHtml).join("")+'</div>'+
      '<p class="region-search-note">행정구역의 중심 좌표로 예보를 조회합니다. 도로명주소·건물·필지의 실제 위치와 다를 수 있습니다.</p>';
    $("locationSearch")?.setAttribute("aria-expanded","true");
  }
  async function runSearch(force){
    const field=$("locationSearch"),raw=field?.value?.trim()||"",id=++revision;
    if(raw.length<2){results=[];renderHint("동·읍·면·리 또는 시·군·구를 두 글자 이상 입력하세요. 예: 옥길동, 서산 대산읍 화곡리");return;}
    if(!index){
      renderHint("전국 읍·면·동 주소 목록을 준비하고 있습니다…");
      try{await getIndex();}catch(error){
        if(id!==revision)return;
        renderHint("전국 주소 자료를 불러오지 못했습니다. 잠시 후 다시 시도하거나 빠른 지역 선택을 사용해 주세요.");
        return;
      }
    }
    if(id!==revision)return;
    const found=core.search(index,raw,{limit:MAX_RESULTS});
    renderResults(found,raw);
  }
  function select(id){
    const item=results[Number(id)],place=core.toLocation(item);
    if(!place)return;
    const dialog=$("locationDialog");
    if(dialog?.open)dialog.close();
    const input=$("locationSearch");if(input){input.value=item.full;input.setAttribute("aria-expanded","false");}
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
    if(event.key==="Escape"&&results.length){results=[];renderHint("검색창에 다른 지역명을 입력하세요.");}
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
    field.placeholder="예: 옥길동, 부천 소사구, 서산 대산읍 화곡리";
    field.setAttribute("role","combobox");
    field.setAttribute("aria-autocomplete","list");
    field.setAttribute("aria-controls","searchResults");
    field.setAttribute("aria-expanded","false");
    resultsBox.setAttribute("aria-label","전국 지역 검색 결과");
    resultsBox.setAttribute("role","listbox");
    showSource();
    form.addEventListener("submit",event=>{event.preventDefault();runSearch(true);});
    field.addEventListener("input",()=>runSearch(false));
    field.addEventListener("focus",()=>{if(!index)getIndex().catch(()=>{});if(field.value.trim().length>=2)runSearch(false);});
    field.addEventListener("keydown",onKey);
    resultsBox.addEventListener("click",onSelectClick);
    resultsBox.addEventListener("keydown",onResultKey);
    dialog?.addEventListener("close",()=>{revision++;results=[];});
    renderHint("동·읍·면·리 또는 시·군·구를 입력하세요. 예: 옥길동, 역삼동, 서산 화곡리");
  }
  window.WeatherRegionSearch={search:runSearch};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();