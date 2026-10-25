/* 날씨한눈: first-use geolocation and saved place management.
   Geolocation permission only on explicit user action; granted permission
   can refresh automatically on future visits if GPS was last selected.
   Coordinates are rounded to ~100 m and stored on this device only.
*/
(function(){
  "use strict";
  const core=window.WeatherLocationCore;
  if(!core)return;
  const $=id=>document.getElementById(id);
  const STORAGE="weatherhannun_places_v2";
  const LEGACY="weatherhannun_favorite_locations_v1";
  const INTRO="weatherhannun_geo_intro_v1";
  const ACTIVE="weatherhannun_location";
  const DEFAULT={name:"서산",lat:36.7845,lon:126.4503,source:"manual"};
  let active=null,places=[],deleted=null,busy=false,editId=null,initialized=false;
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const stored=(k)=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(_){return null;}};
  const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}};
  const introDone=()=>{try{return localStorage.getItem(INTRO)==="done";}catch(_){return false;}};
  function finishIntro(){try{localStorage.setItem(INTRO,"done");}catch(_){ }const dialog=$("weatherLocationWelcome");if(dialog?.open)dialog.close();}
  function status(message){if($("geoLocationStatus"))$("geoLocationStatus").textContent=message;if($("locationMessage"))$("locationMessage").textContent=message;}
  function persist(){if(!store(STORAGE,places)){status("브라우저 저장소에 접근할 수 없어 지역 변경이 유지되지 않을 수 있습니다.");return false;}return true;}
  function loadPlaces(){
    const current=stored(STORAGE);
    if(Array.isArray(current)){places=core.collection(current);return;}
    const legacy=stored(LEGACY);
    places=core.collection(legacy);
    if(store(STORAGE,places)){try{localStorage.removeItem(LEGACY);}catch(_){}}
  }
  function currentName(){return active?.name||"선택 지역";}
  function updateHeader(){
    const badge=$("locationModeLabel");
    if(badge)badge.textContent=active?.source==="gps"?"GPS로 선택됨":"선택 지역 저장됨";
  }
  function render(){
    if(!initialized)return;
    updateHeader();
    const holder=$("favoriteLocations");
    if(holder){
      holder.innerHTML=places.length?places.map(p=>{
        const selected=core.same(active,p);
        return '<div class="location-place-row'+(selected?" is-active":"")+'"><button type="button" data-location-select="'+esc(p.id)+'" class="location-place-select" aria-label="'+esc(p.name)+' 날씨 보기"><span class="location-place-symbol">📍</span><span class="location-place-name">'+esc(p.name)+'</span>'+(selected?'<span class="location-place-current">보는 중</span>':'')+'</button><button type="button" class="location-edit-button" data-location-edit="'+esc(p.id)+'" aria-label="'+esc(p.name)+' 이름 변경" title="이름 변경">수정</button><button type="button" class="location-delete-button" data-location-delete="'+esc(p.id)+'" aria-label="'+esc(p.name)+' 저장 지역 삭제" title="삭제">삭제</button></div>';
      }).join(""):'<p class="muted-text location-empty">저장된 지역이 없습니다. 위에서 지역을 검색하거나 현재 위치를 선택한 뒤 저장할 수 있습니다.</p>';
    }
    const save=$("saveCurrentLocation");
    if(save){
      const saved=places.some(p=>core.same(p,active));
      save.disabled=saved||!active;
      save.textContent=saved?"★ 이미 저장됨":"☆ 이 지역 저장";
    }
    const quick=$("locationQuickBar");
    if(quick){
      quick.hidden=false;
      quick.innerHTML='<span class="location-current-label">📍 <strong>'+esc(currentName())+'</strong> <small id="locationModeLabel">'+(active?.source==="gps"?"GPS로 선택됨":"선택 지역 저장됨")+'</small></span>'+
      '<div class="location-fast-items"><button type="button" class="location-fast-gps" data-geo-quick>⌖ 현위치</button>'+
      places.map(p=>'<button type="button" class="location-fast-place'+(core.same(p,active)?" active":"")+'" data-location-select="'+esc(p.id)+'" aria-pressed="'+String(core.same(p,active))+'">'+esc(p.name)+'</button>').join("")+
      '<button type="button" class="location-fast-manage" data-location-manage aria-label="지역 관리 및 추가">+ 지역관리</button></div>';
    }
  }
  function choose(raw,source="manual",keepDialogOpen=false){
    const p=core.cleanPlace(raw);
    if(!p)return status("선택한 지역 정보를 확인할 수 없습니다.");
    finishIntro();
    const loc={...p,source};
    active=loc;render();
    const chooser=$("locationDialog");
    if(chooser?.open&&!keepDialogOpen)chooser.close();
    window.dispatchEvent(new CustomEvent("weatherhannun:change-location",{detail:loc}));
    status(loc.name+" 날씨로 변경했습니다.");
  }
  function saveCurrent(){
    if(!active)return status("먼저 지역을 선택해 주세요.");
    const outcome=core.add(places,active);
    if(outcome.error==="exists")return status("이미 저장한 지역입니다. 이름 변경은 '수정'을 이용하세요.");
    if(outcome.error==="full")return status("최대 "+core.MAX_SAVED+"곳까지 저장할 수 있습니다. 사용하지 않는 지역을 삭제해 주세요.");
    if(outcome.error)return status("지역을 저장할 수 없습니다.");
    places=outcome.items;persist();render();
    status("★ "+active.name+" 지역을 저장했습니다. 이름은 '수정'으로 바꿀 수 있습니다.");
  }
  function chooseSaved(id){
    const p=places.find(p=>p.id===id);if(!p)return;
    // A saved GPS snapshot is a fixed location, not an automatic GPS tracking preference.
    choose({...p,source:"manual"},"manual");
  }
  function deleteSaved(id){
    const removed=core.remove(places,id);
    if(!removed.removed)return;
    places=removed.items;
    deleted={entry:removed.removed,index:removed.index};
    persist();render();
    if(core.same(active,removed.removed)){
      const fallback=core.afterDelete(active,removed.removed,places,DEFAULT);
      choose(fallback,"manual",true);
    }
    const info=$("favoriteMessage");
    if(info)info.innerHTML=esc(removed.removed.name)+' 지역을 삭제했습니다. <button type="button" id="undoLocationDelete" class="location-undo">실행 취소</button>';
    const undo=$("undoLocationDelete");
    if(undo)undo.addEventListener("click",undoDelete,{once:true});
  }
  function undoDelete(){
    if(!deleted)return;
    const updated=core.add(places,deleted.entry);
    if(updated.error){status("지역을 복구할 수 없습니다.");return;}
    updated.items.splice(updated.items.length-1,1);
    updated.items.splice(Math.min(deleted.index,updated.items.length),0,deleted.entry);
    places=core.collection(updated.items);
    deleted=null;persist();render();status("삭제한 지역을 복구했습니다.");
  }
  function editSaved(id){
    const p=places.find(p=>p.id===id);if(!p)return;
    editId=id;
    const input=$("editLocationName");if(input)input.value=p.name;
    const d=$("renameLocationDialog");if(d?.showModal){d.showModal();input?.focus();input?.select();}
  }
  function commitEdit(event){
    event.preventDefault();
    const input=$("editLocationName"),name=input?.value||"";
    const res=core.rename(places,editId,name);
    if(res.error){$("renameError").textContent="지역 이름을 1자 이상 입력해 주세요.";input?.focus();return;}
    places=res.items;persist();
    const modified=places.find(x=>x.id===editId);
    if(modified&&core.same(active,modified)){
      active={...active,name:modified.name};
      window.dispatchEvent(new CustomEvent("weatherhannun:change-location",{detail:{...active,source:active?.source||"manual"}}));
    }
    if($("renameLocationDialog")?.open)$("renameLocationDialog").close();
    editId=null;render();status("지역 이름을 변경했습니다.");
  }
  function onPlaceClick(event){
    const target=event.target.closest("button");
    if(!target)return;
    if(target.hasAttribute("data-location-select"))return chooseSaved(target.getAttribute("data-location-select"));
    if(target.hasAttribute("data-location-delete"))return deleteSaved(target.getAttribute("data-location-delete"));
    if(target.hasAttribute("data-location-edit"))return editSaved(target.getAttribute("data-location-edit"));
    if(target.hasAttribute("data-geo-quick"))return requestCurrentPosition(true);
    if(target.hasAttribute("data-location-manage"))return $("locationButton")?.click();
  }
  function setBusy(value){
    busy=value;
    [$("geoButton"),$("welcomeUseLocation"),...document.querySelectorAll("[data-geo-quick]")].forEach(b=>{if(b)b.disabled=value;});
    if(value)status("기기의 현재 위치를 확인하고 있습니다…");
  }
  function canUse(){
    if(!navigator.geolocation){status("이 기기에서는 위치 조회를 지원하지 않습니다. 지역 검색을 이용해 주세요.");return false;}
    if(!window.isSecureContext){status("위치 조회는 HTTPS 보안 연결이 필요합니다. 지역 검색을 이용해 주세요.");return false;}
    return true;
  }
  function requestCurrentPosition(explicit=true){
    if(busy||!canUse())return Promise.resolve(false);
    setBusy(true);
    // Calling getCurrentPosition directly in this click handler preserves user activation.
    return new Promise(resolve=>{
      navigator.geolocation.getCurrentPosition(function(position){
        setBusy(false);
        const la=position.coords?.latitude,lo=position.coords?.longitude;
        if(!Number.isFinite(la)||!Number.isFinite(lo)){status("좌표를 확인할 수 없습니다. 지역을 선택해 주세요.");return resolve(false);}
        // Weather does not require street-level precision: save approximate coordinates.
        const loc={name:"내 현재 위치",lat:Number(la.toFixed(3)),lon:Number(lo.toFixed(3)),source:"gps"};
        finishIntro();choose(loc,"gps");
        if($("locationDialog")?.open)$("locationDialog").close();
        status("현재 위치로 날씨를 표시합니다. 이 위치는 기기에 자동 저장됩니다.");
        resolve(true);
      },function(error){
        setBusy(false);
        const code=error?.code;
        const description=code===1?"위치 권한이 거부되었습니다. 브라우저의 사이트 설정에서 위치 권한을 허용하거나 지역을 직접 선택해 주세요.":
          code===3?"위치 확인 시간이 초과되었습니다. 다시 시도하거나 지역을 검색해 주세요.":
          "위치 정보를 가져오지 못했습니다. GPS·네트워크를 확인하거나 지역을 검색해 주세요.";
        status(description);
        if(explicit&&$("weatherLocationWelcome")?.open) $("welcomeHelp").textContent=description;
        resolve(false);
      },{enableHighAccuracy:false,timeout:12000,maximumAge:180000});
    });
  }
  async function initialPermissionFlow(){
    const param=new URLSearchParams(location.search);
    const fromSharedLink=param.has("lat")&&param.has("lon");
    if(fromSharedLink)return; // Don't override an explicit shared region.
    const saved=stored(ACTIVE);
    let permission="prompt";
    if(navigator.permissions?.query){
      try{
        const result=await navigator.permissions.query({name:"geolocation"});
        permission=result.state;
      }catch(_){}
    }
    if(permission==="granted"){
      // User selected a static saved region: do not override it.
      if(!saved||saved.source==="gps")requestCurrentPosition(false);
      return;
    }
    if(permission==="denied"){
      // Never nag on every visit. Allow a manual retry from quick actions.
      if(!introDone())showWelcome("기기 위치 권한이 차단되어 있습니다. 브라우저 설정에서 위치를 허용하거나 지역을 검색하세요.");
      return;
    }
    if(!introDone())showWelcome("");
  }
  function showWelcome(help){
    const dialog=$("weatherLocationWelcome");
    if(!dialog||dialog.open)return;
    if($("welcomeHelp"))$("welcomeHelp").textContent=help||"허용하면 현재 위치 기준으로 날씨가 표시됩니다. 위치 권한은 언제든 변경할 수 있습니다.";
    dialog.showModal?.();
  }
  function init(){
    if(initialized)return;
    initialized=true;
    active=core.cleanPlace(stored(ACTIVE))||DEFAULT;
    const previous=stored(ACTIVE);
    if(previous?.source==="gps")active.source="gps";
    loadPlaces();
    $("favoriteLocations")?.addEventListener("click",onPlaceClick);
    $("locationQuickBar")?.addEventListener("click",onPlaceClick);
    $("saveCurrentLocation")?.addEventListener("click",saveCurrent);
    $("renameLocationForm")?.addEventListener("submit",commitEdit);
    $("renameClose")?.addEventListener("click",()=>{$("renameLocationDialog")?.close();editId=null;});
    $("weatherLocationWelcome")?.addEventListener("close",finishIntro);
    $("welcomeUseLocation")?.addEventListener("click",()=>requestCurrentPosition(true));
    $("welcomeChooseRegion")?.addEventListener("click",()=>{
      finishIntro();
      $("locationButton")?.click();
    });
    $("welcomeLater")?.addEventListener("click",()=>{
      finishIntro();
      status("언제든 '⌖ 현위치' 또는 '지역관리'에서 위치를 바꿀 수 있습니다.");
    });
    render();
    initialPermissionFlow();
  }
  window.addEventListener("weatherhannun:location-applied",ev=>{
    const p=core.cleanPlace(ev.detail);
    if(!p)return;
    active={...p,source:ev.detail?.source==="gps"?"gps":"manual"};
    render();
  });
  window.WeatherLocationManager={requestCurrentPosition};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();