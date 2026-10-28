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
  let active=null,places=[],deleted=null,busy=false,editId=null,initialized=false,reverseVersion=0;
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const stored=(k)=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(_){return null;}};
  const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}};
  const introDone=()=>{try{return localStorage.getItem(INTRO)==="done";}catch(_){return false;}};
  function finishIntro(){try{localStorage.setItem(INTRO,"done");}catch(_){ }const dialog=$("weatherLocationWelcome");if(dialog?.open)dialog.close();}
  function status(message){if($("geoLocationStatus"))$("geoLocationStatus").textContent=message;if($("locationMessage"))$("locationMessage").textContent=message;}
  function persist(){if(!store(STORAGE,places)){status("브라우저 저장소에 접근할 수 없어 지역 변경이 유지되지 않을 수 있습니다.");return false;}return true;}
  function notifyPlaces(){if(typeof CustomEvent==="function")window.dispatchEvent(new CustomEvent("weatherhannun:places-changed",{detail:{count:places.length}}));}
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
    const activeSaved=places.some(p=>core.same(p,active));
    const activeLine=active?.address&&active.address!==active.name?active.address:
      active?.source==="gps"?"GPS로 선택한 지역":"현재 날씨의 기준 지역";
    const managedName=$("managedCurrentName");
    const managedAddress=$("managedCurrentAddress");
    const favoriteCount=$("favoriteCount");
    if(managedName)managedName.textContent=currentName();
    if(managedAddress)managedAddress.textContent=activeLine;
    if(favoriteCount)favoriteCount.textContent=places.length+" / "+core.MAX_SAVED;
    const holder=$("favoriteLocations");
    if(holder){
      holder.innerHTML=places.length?places.map((p,index)=>{
        const selected=core.same(active,p);
        return '<div class="location-place-row'+(selected?" is-active":"")+'"><button type="button" data-location-select="'+esc(p.id)+'" class="location-place-select" aria-label="'+esc(p.name)+' 날씨 보기"><span class="location-place-symbol material-symbols-outlined" aria-hidden="true">location_on</span><span class="location-place-text"><span class="location-place-name">'+esc(p.name)+'</span>'+(p.address&&p.address!==p.name?'<small class="location-place-address">'+esc(p.address)+'</small>':'')+'</span>'+(selected?'<span class="location-place-current">보는 중</span>':'')+'</button><span class="location-row-actions"><span class="location-order-buttons" role="group" aria-label="'+esc(p.name)+' 순서 변경"><button type="button" data-location-move="up" data-location-id="'+esc(p.id)+'" aria-label="'+esc(p.name)+' 위로 이동" title="위로 이동"'+(index===0?' disabled':'')+'><span class="material-symbols-outlined" aria-hidden="true">keyboard_arrow_up</span></button><button type="button" data-location-move="down" data-location-id="'+esc(p.id)+'" aria-label="'+esc(p.name)+' 아래로 이동" title="아래로 이동"'+(index===places.length-1?' disabled':'')+'><span class="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span></button></span><button type="button" class="location-edit-button" data-location-edit="'+esc(p.id)+'" aria-label="'+esc(p.name)+' 이름 변경" title="이름 변경"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button><button type="button" class="location-delete-button" data-location-delete="'+esc(p.id)+'" aria-label="'+esc(p.name)+' 저장 지역 삭제" title="삭제"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></span></div>';
      }).join(""):'<div class="location-empty"><span class="material-symbols-outlined" aria-hidden="true">bookmark_add</span><p>자주 보는 지역을 저장해 보세요.</p></div>';
    }
    const save=$("saveCurrentLocation");
    if(save){
      save.disabled=activeSaved||!active;
      save.textContent=activeSaved?"★ 저장됨":"☆ 내 지역에 저장";
    }
    const quick=$("locationQuickBar");
    if(quick){
      quick.hidden=false;
      const locationLine=active?.address?
        active.address+(active.regionCenter?" · 행정구역 대표 좌표":active.source==="gps"&&active.approximate?" · GPS 기준 추정주소":""):
        active?.source==="gps"?"행정주소 확인 중 · 좌표 약 "+Number(active.lat).toFixed(3)+", "+Number(active.lon).toFixed(3):"";
      const orderedPlaces=[...places].sort((a,b)=>Number(core.same(b,active))-Number(core.same(a,active)));
      const placeButtons=orderedPlaces.map(p=>{
        const selected=core.same(p,active);
        const detail=p.address&&p.address!==p.name?p.address+(p.regionCenter?" · 지역 대표 좌표":" · 추정주소"):p.name+" 날씨 보기";
        return '<button type="button" class="location-fast-place'+(selected?" active":"")+'" data-location-select="'+esc(p.id)+'" aria-pressed="'+String(selected)+'" aria-current="'+(selected?"location":"false")+'" title="'+esc(detail)+'"><span class="location-fast-check" aria-hidden="true">✓</span><span class="location-fast-name">'+esc(p.name)+'</span></button>';
      }).join("");
      quick.innerHTML='<div class="location-switcher-head"><span class="location-switcher-heading">등록 지역 <b>'+places.length+'</b></span><span class="location-current-label"><span aria-hidden="true">📍</span><span class="location-label-stack"><strong>'+esc(currentName())+'</strong>'+(locationLine?'<span class="location-address-line" title="'+esc(locationLine)+'">'+esc(locationLine)+'</span>':'')+'</span><small id="locationModeLabel">'+(active?.source==="gps"?"GPS 선택":"현재 선택")+'</small></span></div>'+
      '<div class="location-fast-items" role="group" aria-label="등록한 지역 선택">'+
      (placeButtons||'<span class="location-fast-empty">아직 등록한 지역이 없습니다.</span>')+
      (!activeSaved&&active?'<button type="button" class="location-fast-save" data-location-save-current>☆ 현재 지역 등록</button>':'')+
      '<button type="button" class="location-fast-gps" data-geo-quick>⌖ 현위치</button>'+
      '<button type="button" class="location-fast-compare" data-location-compare>⇄ 지역 비교</button>'+
      '<button type="button" class="location-fast-manage" data-location-manage aria-label="지역 추가 및 관리">+ 지역 추가·관리</button></div>';
    }
  }
  function choose(raw,source="manual",keepDialogOpen=false){
    const p=core.cleanPlace(raw);
    if(!p)return status("선택한 지역 정보를 확인할 수 없습니다.");
    finishIntro();
    reverseVersion++; // Invalidate address lookups for a location switched away from.
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
    places=outcome.items;persist();render();notifyPlaces();
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
    persist();render();notifyPlaces();
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
    deleted=null;persist();render();notifyPlaces();status("삭제한 지역을 복구했습니다.");
  }
  function moveSaved(id,direction){
    const outcome=core.move(places,id,direction);
    if(outcome.error)return;
    places=outcome.items;
    persist();render();notifyPlaces();
    const moved=places.find(place=>place.id===id);
    status((moved?.name||"저장 지역")+" 순서를 "+(direction==="up"?"위":"아래")+"로 옮겼습니다.");
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
    places=res.items;persist();notifyPlaces();
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
    if(target.hasAttribute("data-location-move"))return moveSaved(target.getAttribute("data-location-id"),target.getAttribute("data-location-move"));
    if(target.hasAttribute("data-location-delete"))return deleteSaved(target.getAttribute("data-location-delete"));
    if(target.hasAttribute("data-location-edit"))return editSaved(target.getAttribute("data-location-edit"));
    if(target.hasAttribute("data-location-save-current"))return saveCurrent();
    if(target.hasAttribute("data-geo-quick"))return requestCurrentPosition(true);
    if(target.hasAttribute("data-location-compare"))return document.querySelector('.desktop-nav [data-view="compare"]')?.click();
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
  async function resolveGPSAddress(position){
    const geocoder=window.WeatherReverseGeocoder;
    const requestedVersion=reverseVersion;
    if(!geocoder?.resolve){
      status("현재 위치는 확인했지만 주소 변환 기능이 연결되지 않았습니다.");
      return;
    }
    status("GPS 위치 확인 완료 · 현재 위치의 행정주소를 조회 중입니다…");
    const found=await geocoder.resolve(position.lat,position.lon);
    // Switching to another place while lookup was running must never overwrite it.
    if(requestedVersion!==reverseVersion || active?.source!=="gps" || !core.same(active,position))return;
    if(!found?.address){
      const coords=Number(position.lat).toFixed(3)+", "+Number(position.lon).toFixed(3);
      status("GPS 위치는 확인했습니다. 주소 조회가 지연되어 좌표("+coords+")로 표시합니다. 지역을 직접 검색해도 됩니다.");
      const line=$("locationQuickBar")?.querySelector(".location-address-line");
      if(line)line.textContent="주소 조회 실패 · 위도/경도 "+coords;
      return;
    }
    const next={...active,name:found.name||active.name,address:found.address,
      administrative:found.administrative||"",approximate:true,source:"gps"};
    // Existing user labels such as '집' are preserved, but old generic labels are refreshed.
    let listChanged=false;
    places=places.map(item=>{
      if(!core.same(item,next))return item;
      listChanged=true;
      return {...item,address:found.address,administrative:found.administrative||"",approximate:true,
        name:item.name==="내 현재 위치"?next.name:item.name};
    });
    if(listChanged){persist();notifyPlaces();}
    choose(next,"gps");
    status("현재 위치의 추정 주소: "+found.address+" · 지도 데이터 기준이므로 실제 주소와 차이가 있을 수 있습니다.");
  }
  function requestCurrentPosition(explicit=true){
    if(busy||!canUse())return Promise.resolve(false);
    const progressId=window.WeatherActionProgress?.begin("현재 위치를 확인하는 중…");
    setBusy(true);
    // Calling getCurrentPosition directly in this click handler preserves user activation.
    return new Promise(resolve=>{
      navigator.geolocation.getCurrentPosition(function(position){
        window.WeatherActionProgress?.end(progressId);
        setBusy(false);
        const la=position.coords?.latitude,lo=position.coords?.longitude;
        if(!Number.isFinite(la)||!Number.isFinite(lo)){status("좌표를 확인할 수 없습니다. 지역을 선택해 주세요.");return resolve(false);}
        // Weather does not require street-level precision: save approximate coordinates.
        const loc={name:"내 현재 위치",lat:Number(la.toFixed(3)),lon:Number(lo.toFixed(3)),source:"gps"};
        finishIntro();choose(loc,"gps");
        if($("locationDialog")?.open)$("locationDialog").close();
        status("GPS 위치를 저장했습니다. 주변 행정주소를 확인 중입니다…");
        // Weather loads immediately; address lookup is independent and asynchronous.
        resolveGPSAddress(loc).catch(()=>status("GPS 위치는 저장했지만 주변 주소를 확인하지 못했습니다."));
        resolve(true);
      },function(error){
        window.WeatherActionProgress?.end(progressId);
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
    if(saved?.source==="gps"&&!saved.address&&introDone()){
      // Upgrade old GPS selections that previously displayed only '내 현재 위치'.
      resolveGPSAddress(active).catch(()=>{});
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
    if(active.source!=="gps")reverseVersion++; // Cancel stale GPS address response.
    render();
  });
  window.WeatherLocationManager={
    requestCurrentPosition,
    getSavedPlaces:()=>places.map(place=>({...place})),
    getActiveLocation:()=>active?{...active}:null
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
