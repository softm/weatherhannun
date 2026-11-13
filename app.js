"use strict";
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var PROVIDER = window.WeatherProviderCore;
  var MAX_SAVED_FORECAST_AGE_MS = 60 * 60 * 1000;
  var MAX_FUTURE_CLOCK_SKEW_MS = 10 * 60 * 1000;
  var CITY_LIST = [
    { name: "서산", lat: 36.7845, lon: 126.4503 },
    { name: "서울", lat: 37.5665, lon: 126.978 },
    { name: "인천", lat: 37.4563, lon: 126.7052 },
    { name: "부천", lat: 37.5034, lon: 126.766 },
    { name: "대전", lat: 36.3504, lon: 127.3845 },
    { name: "강릉", lat: 37.7519, lon: 128.8761 },
    { name: "대구", lat: 35.8714, lon: 128.6014 },
    { name: "광주", lat: 35.1595, lon: 126.8526 },
    { name: "부산", lat: 35.1796, lon: 129.0756 },
    { name: "제주", lat: 33.4996, lon: 126.5312 }
  ];
  var ACTIVITY_CORE=window.WeatherActivityCore;
  var INTERESTS=window.WeatherActivityInterests;
  var ACTIVITIES=ACTIVITY_CORE?ACTIVITY_CORE.DEFINITIONS:{};
  var STATE = {
    loc: CITY_LIST[0], weather: null, air: null, activity: "walk", dataStatus: "loading",
    view: "today", hourly: [], fetchedAt: null, cityData: null,
    map: null, tileLayer: null, mapObserver: null, markers: [], loading: false, ticket: 0, mapBusy: false, mapMetric:"temperature", activityFilter: "all", activityScope: "mine", activityPriority: ["walk","laundry","carwash"]
  };
  var toastTimer;
  function storeGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } }
  function storeSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }
  function finite(n) { return typeof n === "number" && Number.isFinite(n); }
  function num(n, dec) { return finite(n) ? n.toFixed(dec === undefined ? 0 : dec) : "--"; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function safe(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function localDate(text) { return new Date(text + (text.indexOf("T") >= 0 ? "+09:00" : "T12:00:00+09:00")); }
  function dateLabel(text) { return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",weekday:"short"}).format(localDate(text)); }
  function hourLabel(text) { return text.slice(11,13) + "시"; }
  function whenLabel(text) { return dateLabel(text.slice(0,10)) + " " + hourLabel(text); }
  function toast(message) { var el=$("toast"); el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.hidden=true;},4000); }
  function weatherSymbol(code,isDay) {
    if (window.WeatherIcons) {
      var visual=window.WeatherIcons.describe(code,isDay);
      return {icon:window.WeatherIcons.markup(code,isDay),name:visual.name,key:visual.key,family:visual.family};
    }
    return {icon:'<span class="weather-glyph-fallback" aria-hidden="true">?</span>',name:"날씨 정보 없음",key:"unknown",family:"unknown"};
  }
  function validLocation(loc) { return loc && typeof loc.name==="string" && loc.name.length<90 && finite(Number(loc.lat)) && finite(Number(loc.lon)) && Math.abs(Number(loc.lat))<=90 && Math.abs(Number(loc.lon))<=180; }
  function applyLocation(loc, updateUrl, temporary) {
    if(!validLocation(loc))return;
    var previous=STATE.loc,modeChanged=!!previous.temporary!==!!temporary,changed=Number(previous.lat)!==Number(loc.lat)||Number(previous.lon)!==Number(loc.lon);
    var source=loc.source==="gps"?"gps":"manual";
    STATE.loc={temporary:!!temporary,name:String(loc.name).trim().slice(0,75)||"선택 지역",lat:Number(loc.lat),lon:Number(loc.lon),source:source,
      address:typeof loc.address==="string"?loc.address.slice(0,170):"",
      administrative:typeof loc.administrative==="string"?loc.administrative.slice(0,145):"",
      approximate:loc.approximate===true,regionCenter:loc.regionCenter===true};
    if(changed||modeChanged){
      STATE.weather=null;STATE.air=null;STATE.hourly=[];STATE.fetchedAt=null;
      text("currentTemp","--");text("weatherSummary","새 지역 예보 연결 중");
    }
    $("locationTitle").textContent=STATE.loc.name;
    $("locationTitle").title=STATE.loc.address ? STATE.loc.address+(STATE.loc.regionCenter?" (지역 중심 기준 날씨)":STATE.loc.source==="gps"?" (GPS 주변 추정주소)":"") : STATE.loc.name;
    if($("settingsLocationName"))$("settingsLocationName").textContent=STATE.loc.name;
    if($("settingsLocationDetail"))$("settingsLocationDetail").textContent=STATE.loc.address||(
      STATE.loc.source==="gps"?"기기의 현재 위치 기준":STATE.loc.regionCenter?"행정구역 대표 위치 기준":"선택한 지역의 예보 기준"
    );
    $("heroLocation").textContent=STATE.loc.name;
    if(!temporary)storeSet("weatherhannun_location",STATE.loc);
    if($("temporaryLocationNotice"))$("temporaryLocationNotice").hidden=!temporary;
    if(updateUrl){
      // Only the explicit Share action may generate a URL with coordinates.
      // Selecting a saved/manual place must not silently publish lat/lon in browser history.
      var url=new URL(location.href);
      url.searchParams.delete("lat");
      url.searchParams.delete("lon");
      url.searchParams.delete("name");
      history.replaceState(null,"",url.pathname+url.search+url.hash);
    }
    window.dispatchEvent(new CustomEvent("weatherhannun:location-applied",{detail:STATE.loc}));
    if(changed||modeChanged||!STATE.weather)loadWeather();
    else renderAll();
  }
  function forecastUrl(loc,short) {
    return PROVIDER?PROVIDER.buildForecastUrl(loc):"";
  }
  function airUrl(loc) {
    return PROVIDER?PROVIDER.buildAirUrl(loc):"";
  }
  function freshForecastTimestamp(value, now) {
    var at=Date.parse(value||"");
    if(!Number.isFinite(at))return false;
    var age=(now||Date.now())-at;
    return age>=-MAX_FUTURE_CLOCK_SKEW_MS&&age<=MAX_SAVED_FORECAST_AGE_MS;
  }
  async function fetchUnifiedWeather(loc, timeoutMs) {
    if(!PROVIDER||!PROVIDER.buildForecastUrl)throw new Error("예보 공급자 설정을 불러오지 못했습니다.");
    var canonical=await getJson(PROVIDER.buildForecastUrl(loc),timeoutMs);
    var fetchedAt=canonical.source?.fetchedAt||null;
    if(canonical.stale===true||canonical.cache?.fallback===true||!freshForecastTimestamp(fetchedAt)) {
      throw new Error("최신 예보가 아직 준비되지 않았습니다.");
    }
    return {
      weather:PROVIDER.toLegacyForecast(canonical),
      air:PROVIDER.toLegacyAir(canonical),
      fallback:false,
      fetchedAt:fetchedAt,
      staticOfficial:true
    };
  }
  async function getJson(url, timeoutMs) {
    if(!url)throw new Error("데이터 공급자 설정을 불러오지 못했습니다.");
    var ctrl=new AbortController();
    var timeout=setTimeout(function(){ctrl.abort();},Math.max(3000,Number(timeoutMs)||13000));
    try {
      var res=await fetch(url,{signal:ctrl.signal});
      if (!res.ok) throw new Error("서버 응답 "+res.status);
      var data=await res.json();
      if(data.error) throw new Error(data.reason||"제공 데이터 오류");
      return data;
    } finally { clearTimeout(timeout); }
  }
  function weatherLoadMessage(error, hasSavedWeather) {
    var message=String(error&&error.message||"");
    if(hasSavedWeather) return "최신 예보 연결이 지연되고 있어 저장된 예보를 표시합니다.";
    if(/서버 응답 5\d\d|AbortError|aborted|Failed to fetch/i.test(message)) return "최신 예보 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
    return "날씨 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  function makeHours(w) {
    if (!w || !w.hourly || !Array.isArray(w.hourly.time)) return [];
    var h=w.hourly;
    var current=w.current&&w.current.time ? w.current.time.slice(0,13) : new Date().toISOString().slice(0,13);
    var index=h.time.findIndex(function(t){return t.slice(0,13)>=current;});
    if(index<0) index=0;
    return h.time.slice(index,index+168).map(function(time,i){
      var k=index+i;
      return {time:time,temp:h.temperature_2m?.[k],rain:h.precipitation_probability?.[k],mm:h.precipitation?.[k],code:h.weather_code?.[k],wind:h.wind_speed_10m?.[k],gust:h.wind_gusts_10m?.[k],humidity:h.relative_humidity_2m?.[k],uv:h.uv_index?.[k],isDay:h.is_day?.[k]};
    });
  }
  function locationDistanceKm(a,b) {
    if(!a||!b)return Infinity;
    var lat1=Number(a.lat),lon1=Number(a.lon),lat2=Number(b.lat),lon2=Number(b.lon);
    if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return Infinity;
    var rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
    var h=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }
  function usableWeatherCache(cache,loc) {
    if(!cache||!cache.loc||!PROVIDER||!PROVIDER.inspectForecastPayload(cache.weather).valid)return false;
    if(!freshForecastTimestamp(cache.at))return false;
    if(cache.weather?._weatherhannun?.stale===true||cache.weather?._weatherhannun?.cache?.fallback===true)return false;
    if(cache.loc.lat===loc.lat&&cache.loc.lon===loc.lon)return true;
    // GPS 좌표는 측정할 때마다 조금씩 달라질 수 있다. 같은 GPS 지역의 근거리 캐시는 즉시 재사용한다.
    return cache.loc.source==="gps"&&loc.source==="gps"&&locationDistanceKm(cache.loc,loc)<=5;
  }
  async function loadWeather(force) {
    var ticket=++STATE.ticket;
    STATE.loading=true;
    $("updatedBadge").textContent="예보 갱신 중…";
    $("dataFooterStatus").textContent="예보 데이터 갱신 중";
    $("refreshButton").disabled=true;
    var loc=STATE.loc;
    var cache=storeGet("weatherhannun_last");
    var cachedWeatherValid=usableWeatherCache(cache,loc);
    var cachedAirValid=cache&&cache.air&&PROVIDER&&PROVIDER.inspectAirPayload(cache.air).valid;
    var restoredCache=!force&&cachedWeatherValid;
    if (restoredCache) {
      STATE.weather=cache.weather;STATE.air=cachedAirValid?cache.air:null;STATE.fetchedAt=cache.at||null;STATE.hourly=makeHours(STATE.weather);STATE.dataStatus="cached";renderAll();
    }
    // 캐시 복원 시 첫 화면은 이미 준비됐다. 서버 갱신은 상단 전체 진행 UI 없이 뒤에서 처리한다.
    var progressId=restoredCache?null:window.WeatherActionProgress?.begin("날씨 정보를 불러오는 중…");
    try {
      var result=await fetchUnifiedWeather(loc,restoredCache?6500:12000);
      if(ticket!==STATE.ticket)return;
      var weather=result.weather;
      var airCandidate=result.air;
      var air=PROVIDER&&PROVIDER.inspectAirPayload(airCandidate).valid?airCandidate:null;
      var contract=PROVIDER&&PROVIDER.inspectForecastPayload(weather);
      if(!contract||!contract.valid) throw new Error("날씨 데이터 계약에 필요한 값이 없습니다: "+((contract&&contract.missingFields)||["공급자 모듈"]).join(", "));
      STATE.weather=weather;
      STATE.air=air;
      STATE.dataStatus=result.fallback?"fallback":"live";
      // 조회 버튼을 누른 시각이 아니라 공급자가 실제로 수집한 시각을 보존한다.
      // 그래야 오래된 서버 캐시를 방금 조회한 최신 예보처럼 표시하지 않는다.
      STATE.fetchedAt=result.fetchedAt||new Date().toISOString();
      STATE.hourly=makeHours(weather);
      if(!loc.temporary)storeSet("weatherhannun_last",{loc:loc,at:STATE.fetchedAt,weather:weather,air:air});
      if(!loc.temporary)storeSet("weatherhannun_fetch_meta",{at:STATE.fetchedAt,loc:loc.name,modelTime:weather.current.time,airTime:air&&air.current&&air.current.time,forecast:!!weather,air:!!air,contractVersion:PROVIDER&&PROVIDER.CONTRACT_VERSION,provider:weather._weatherhannun?.source?.provider||PROVIDER&&PROVIDER.PROVIDER.id,fallback:result.fallback});
      renderAll();
      window.dispatchEvent(new CustomEvent("weatherhannun:forecast-result",{detail:{ok:true}}));
      if(result.fallback)toast("저장된 예보를 표시합니다. 공식 자료를 다시 확인합니다.");
      if(!air) toast("대기질 API 연결이 불안정합니다. 날씨는 정상 표시됩니다.");
    }catch(e) {
      if(ticket!==STATE.ticket)return;
      STATE.dataStatus=STATE.weather?"cached-error":"error";
      $("updatedBadge").textContent=STATE.weather?"저장된 예보 · 연결 실패":"데이터 연결 오류";
      $("dataFooterStatus").textContent=STATE.weather?"저장된 예보 · 갱신 실패":"예보 연결 실패";
      if(STATE.weather)renderAll();
      window.dispatchEvent(new CustomEvent("weatherhannun:forecast-result",{detail:{ok:false}}));
      toast(weatherLoadMessage(e,!!STATE.weather));
      if(!STATE.weather) $("weatherSummary").textContent="날씨 연결 실패";
    } finally {
      if(ticket===STATE.ticket){STATE.loading=false;$("refreshButton").disabled=false;}
      window.WeatherActionProgress?.end(progressId);
    }
  }
  function text(id,value){$(id).textContent=value;}
  function renderAll() {
    if(!STATE.weather)return;
    var w=STATE.weather,c=w.current,d=w.daily;
    var now=weatherSymbol(c.weather_code,c.is_day);
    $("weatherIcon").innerHTML=now.icon;
    $("weatherIcon").dataset.weatherState=now.key||"fallback";
    text("currentTemp",num(c.temperature_2m));
    text("weatherSummary",now.name);
    text("feelsText","체감 "+num(c.apparent_temperature)+"°");
    text("maxTemp",num(d.temperature_2m_max?.[0])+"°");
    text("minTemp",num(d.temperature_2m_min?.[0])+"°");
    text("sunTimes","일출 "+(d.sunrise?.[0]||"").slice(11,16)+" · 일몰 "+(d.sunset?.[0]||"").slice(11,16));
    text("rainMetric",num(STATE.hourly[0]?.rain)+"%");
    text("windMetric",num(c.wind_speed_10m)+" km/h");
    text("humidityMetric",num(c.relative_humidity_2m)+"%");
    text("uvMetric",num(STATE.hourly[0]?.uv,1));
    var rainWindow=STATE.hourly.slice(0,12);
    var nextRain=rainWindow.find(function(x){return (finite(x.rain)&&x.rain>=50)||(finite(x.mm)&&x.mm>=.3);});
    var rainWindowComplete=rainWindow.length===12&&rainWindow.every(function(x){return finite(x.rain)&&finite(x.mm);});
    var cold=STATE.hourly.slice(0,36).some(function(x){return finite(x.temp)&&x.temp<=3;});
    var note=nextRain?whenLabel(nextRain.time)+"경 비 신호 "+(finite(nextRain.rain)&&nextRain.rain>=50?num(nextRain.rain)+"%":num(nextRain.mm,1)+"mm/h"):cold?"48시간 이내 저온 구간이 있습니다. 작물 냉해와 결빙에 유의하세요.":rainWindowComplete?"앞으로 12시간 뚜렷한 강수 신호가 낮습니다.":"시간별 예보를 확인해 주세요.";
    text("noticeStrip",note);
    var at=STATE.fetchedAt?new Date(STATE.fetchedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Seoul"}):"조회 시각 없음";
    var last=STATE.fetchedAt?Date.parse(STATE.fetchedAt):NaN;
    var old=Number.isFinite(last)&&Date.now()-last>180*60000;
    var label=old?"저장 예보 · 재조회 필요":STATE.dataStatus==="live"?"공식 예보 조회 "+at:STATE.dataStatus==="fallback"?"저장 예보 "+at:STATE.dataStatus==="cached-error"?"연결 오류 · 저장 예보":"저장된 예보 "+at;
    text("updatedBadge",label);
    var src=w._weatherhannun&&w._weatherhannun.source;
    text("modelTime","예보 유효시각 "+(c.time||"정보 없음").replace("T"," ")+(src&&src.issuedAt?" · 발표 "+String(src.issuedAt).replace("T"," "):""));
    text("dataFooterStatus",(STATE.dataStatus==="live"?(src&&src.attribution||"공통 날씨 API 조회 성공"):STATE.dataStatus==="fallback"?"저장 예보":STATE.dataStatus==="cached-error"?"API 연결 실패 · 저장 예보":old?"저장 예보 · 갱신 필요":"저장된 예보")+(STATE.air?" · AirKorea 대기질":" · 대기질 정보 없음"));
    renderHourly();
    renderWeek();
    renderDecisions();
    renderActivity();
    renderAir();
    window.dispatchEvent(new CustomEvent("weatherhannun:data",{detail:{weather:w,loc:STATE.loc,air:STATE.air,at:STATE.fetchedAt,status:STATE.dataStatus,source:PROVIDER?PROVIDER.sourceRecord({payload:w,fetchedAt:STATE.fetchedAt,cached:STATE.dataStatus!=="live",fallbackReason:STATE.dataStatus==="cached-error"?"network_error":""}):null}}));
  }
  function renderHourly(){
    var h=STATE.hourly.slice(0,9);
    var preview=$("todayHourlyPreview");
    if(preview)preview.innerHTML=h.slice(0,9).map(function(x,i){
      var symbol=weatherSymbol(x.code,x.isDay),label=i===0?"현재":hourLabel(x.time);
      return '<div class="today-hour-card '+(i===0?"now":"")+'" aria-label="'+safe(label+", "+symbol.name+", "+num(x.temp)+"도, 비 "+num(x.rain)+"퍼센트")+'"><span>'+label+'</span><b aria-hidden="true">'+symbol.icon+'</b><strong>'+num(x.temp)+'°</strong><small>☂ '+num(x.rain)+'%</small></div>';
    }).join("");
  }
  function weekItem(i){
    var d=STATE.weather.daily,code=d.weather_code?.[i],day=dateLabel(d.time[i]);
    var symbol=weatherSymbol(code,1),label=i===0?"오늘":day;
    return '<div class="week-item '+(i===0?"today":"")+'" aria-label="'+safe(label+", "+symbol.name+", 최고 "+num(d.temperature_2m_max?.[i])+"도, 최저 "+num(d.temperature_2m_min?.[i])+"도")+'"><div class="day">'+safe(label)+'</div><div class="ico" aria-hidden="true">'+symbol.icon+'</div><div class="range"><b>'+num(d.temperature_2m_max?.[i])+'°</b> <span>/ '+num(d.temperature_2m_min?.[i])+'°</span></div><div class="rain">☂ '+num(d.precipitation_probability_max?.[i])+'%</div></div>';
  }
  function renderWeek(){
    var d=STATE.weather.daily,len=Math.min(7,d.time.length);
    var rainProbabilities=Array.isArray(d.precipitation_probability_max)?d.precipitation_probability_max:[];
    var minimums=Array.isArray(d.temperature_2m_min)?d.temperature_2m_min:[];
    var maximums=Array.isArray(d.temperature_2m_max)?d.temperature_2m_max:[];
    var precipitationSums=Array.isArray(d.precipitation_sum)?d.precipitation_sum:[];
    var markup=Array.from({length:len},function(_,i){return weekItem(i);}).join("");
    $("weekPreview").innerHTML=markup;
    var rainy=d.time.filter(function(_,i){return finite(rainProbabilities[i])&&rainProbabilities[i]>=60;});
    var cold=d.time.filter(function(_,i){return finite(minimums[i])&&minimums[i]<=3;});
    var mins=minimums.slice(0,len).filter(finite),maxs=maximums.slice(0,len).filter(finite);
    var drop=maxs.length>=2?Math.max.apply(null,maxs)-Math.min.apply(null,maxs):null;
    var rangeMin=mins.length?Math.min.apply(null,mins):null,rangeMax=maxs.length?Math.max.apply(null,maxs):null;
    var rangeSpan=finite(rangeMin)&&finite(rangeMax)?Math.max(1,rangeMax-rangeMin):1;
    var completeWeeklyRain=len>0&&rainProbabilities.slice(0,len).length===len&&rainProbabilities.slice(0,len).every(finite);
    var completeWeeklyTemperature=len>0&&minimums.slice(0,len).length===len&&maximums.slice(0,len).length===len&&minimums.slice(0,len).every(finite)&&maximums.slice(0,len).every(finite);
    $("weeklyCards").innerHTML=Array.from({length:len},function(_,i){
      var low=d.temperature_2m_min?.[i],high=d.temperature_2m_max?.[i],rain=d.precipitation_probability_max?.[i],total=d.precipitation_sum?.[i],uv=d.uv_index_max?.[i];
      var left=finite(low)?Math.round((low-rangeMin)/rangeSpan*64):0;
      var width=finite(low)&&finite(high)?Math.max(12,Math.round((high-low)/rangeSpan*64)):30;
      var label=i===0?"오늘":i===1?"내일":dateLabel(d.time[i]);
      var symbol=weatherSymbol(d.weather_code?.[i],1),icon=symbol.icon;
      var weekday=localDate(d.time[i]).getDay(),previous=i>0?d.temperature_2m_max?.[i-1]:null,badge="",badgeClass="";
      if(finite(previous)&&finite(high)&&previous-high>=5){badge="급격한 기온 하락";badgeClass="cold";}
      else if(finite(low)&&low<=3){badge="저온 주의";badgeClass="cold";}
      else if(finite(rain)&&rain>=60){badge="비 대비";badgeClass="rain";}
      else if(weekday===0||weekday===6){badge="주말";badgeClass="weekend";}
      return '<article class="week-row"><button type="button" class="week-row-button" data-week-index="'+i+'" aria-expanded="false" aria-label="'+safe(label+", "+symbol.name+", 최저 "+num(low)+"도, 최고 "+num(high)+"도, 비 "+num(rain)+"퍼센트")+'"><span class="week-row-day"><b>'+safe(label)+'</b><small>☂ '+num(rain)+'%</small>'+(badge?'<em class="week-row-badge '+badgeClass+'">'+safe(badge)+'</em>':"")+'</span><span class="week-row-icon" aria-hidden="true">'+icon+'</span><span class="week-range-bar"><small>'+num(low)+'°</small><i><em style="left:'+left+'%;width:'+width+'%"></em></i><strong>'+num(high)+'°</strong></span><span class="material-symbols-outlined week-chevron" aria-hidden="true">expand_more</span></button><div class="week-row-detail" hidden><span>예상 강수량 <b>'+num(total,1)+'mm</b></span><span>자외선 최대 <b>'+num(uv,1)+'</b></span><span>일출 <b>'+safe((d.sunrise?.[i]||"").slice(11,16))+'</b></span><span>일몰 <b>'+safe((d.sunset?.[i]||"").slice(11,16))+'</b></span></div></article>';
    }).join("");
    var rainInsight=completeWeeklyRain?'강수확률 60% 이상 <b>'+rainy.length+'일</b>':'강수확률 자료 일부 누락';
    var coldInsight=completeWeeklyTemperature?'최저 3°C 이하 <b>'+cold.length+'일</b>':'최저기온 자료 일부 누락';
    $("weeklyInsight").innerHTML='<p>'+rainInsight+', '+coldInsight+'입니다.</p><small>주간 최고기온 변동 폭은 '+num(drop)+'°C입니다. 큰 변화가 있는 날 전후로 최신 예보를 확인하세요.</small>';
    if($("weekRangeLabel"))text("weekRangeLabel","최저 "+num(rangeMin)+"° ~ 최고 "+num(rangeMax)+"°");
    var precipitationRows=precipitationSums.slice(0,len);
    var rainTotal=precipitationRows.length===len&&precipitationRows.every(finite)?precipitationRows.reduce(function(sum,v){return sum+v;},0):null;
    if($("weeklyRainTotal"))text("weeklyRainTotal",num(rainTotal,1)+" mm");
    var weekend=[];
    d.time.slice(0,len).forEach(function(date,i){var day=localDate(date).getDay();if(day===0||day===6)weekend.push(i);});
    var weekendComplete=weekend.length>0&&weekend.every(function(i){return finite(rainProbabilities[i])&&finite(maximums[i])&&finite(minimums[i]);});
    var weekendScores=weekendComplete?weekend.map(function(i){
      var rainRisk=rainProbabilities[i]*.55;
      var high=maximums[i],low=minimums[i],tempRisk=(high>31?15:0)+(low<4?15:0);
      return clamp(Math.round(100-rainRisk-tempRisk),0,100);
    }):[];
    var weekendScore=weekendScores.length?Math.round(weekendScores.reduce(function(a,b){return a+b;},0)/weekendScores.length):null;
    if($("weekendScore"))text("weekendScore",(weekendScore===null?"--":weekendScore)+" / 100");
    if($("weekendScoreRing"))$("weekendScoreRing").style.setProperty("--score",weekendScore===null?0:weekendScore);
    if($("weeklyAlertTitle")&&$("weeklyAlertText")){
      if(cold.length){text("weeklyAlertTitle","저온 구간 미리 알림");text("weeklyAlertText",cold.length+"일은 최저 3°C 이하 예보입니다. 보온·결빙을 확인하세요.");}
      else if(rainy.length){text("weeklyAlertTitle","강수 일정 미리 알림");text("weeklyAlertText",rainy.length+"일은 강수확률이 높습니다. 야외 일정을 점검하세요.");}
      else if(completeWeeklyRain&&completeWeeklyTemperature){text("weeklyAlertTitle","이번 주 기온·강수 알림");text("weeklyAlertText","큰 위험 신호는 낮지만 전날 최신 예보를 다시 확인하세요.");}
      else{text("weeklyAlertTitle","주간 예보 자료 확인");text("weeklyAlertText","일부 기온·강수 자료가 없어 위험 없음으로 판단하지 않습니다.");}
    }
  }
  function evaluate(activity,h,following){
    return ACTIVITY_CORE?ACTIVITY_CORE.evaluate(activity,h,following):{available:false,score:null,reasons:[{label:"판단 모듈 없음",detail:"활동 판단 규칙을 불러오지 못했습니다."}]};
  }
  function activityEvalAt(type,index){
    var h=STATE.hourly[index]||{};
    return evaluate(type,h,STATE.hourly.slice(index+1,index+7));
  }
  function bestActivity(type){
    var top=null;
    for(var i=0;i<Math.min(46,STATE.hourly.length-2);i++){
      var group=[i,i+1,i+2];
      var scores=group.map(function(j){return activityEvalAt(type,j);});
      if(scores.some(function(result){return !result.available||!finite(result.score);}))continue;
      var avg=Math.round(scores.reduce(function(s,result){return s+result.score;},0)/scores.length);
      if(!top||avg>top.score)top={score:avg,index:i,start:STATE.hourly[i].time,end:STATE.hourly[i+2].time};
    }
    return top;
  }
  function grade(score){return !finite(score)?"자료 부족":score>=80?"좋음":score>=60?"무난":score>=40?"주의":"비추천";}
  function scoreClass(score){return !finite(score)?"unknown":score>=80?"":score>=60?"warn":"bad";}
  function activitySummary(type){
    var best=bestActivity(type),current=activityEvalAt(type,0);
    return {key:type,info:ACTIVITIES[type],current:current,best:best,data:best?activityEvalAt(type,best.index):current};
  }
  function renderDecisions(){
    var candidates=Object.keys(ACTIVITIES).map(activitySummary);
    var rank=INTERESTS.rank(candidates,STATE.activityPriority);
    var top=rank.slice(0,3);
    text("decisionLead",top[0]&&finite(top[0].data.score)&&top[0].data.score>=60?"선택한 "+top[0].info.title+"에 유리한 시간대가 있어요.":top.some(function(x){return finite(x.data.score);})?"오늘은 관심 활동에 적합한 시간이 적어요.":!top.length?"관심 활동을 선택하면 추천 시간을 알려드려요.":"필수 예보값이 부족해 활동 점수를 만들지 않습니다.");
    $("quickActivity").innerHTML=top.map(function(x){return '<button type="button" class="quick-item" data-quick-activity="'+x.key+'"><div class="quick-icon">'+x.info.icon+'</div><div class="quick-main"><b>'+x.info.title+'</b><small>'+(x.best?"추천 "+whenLabel(x.best.start):"필수 예보값 확인 필요")+'</small></div><span class="quick-badge '+scoreClass(x.data.score)+'">'+grade(x.data.score)+(finite(x.data.score)?" "+x.data.score:"")+'</span></button>';}).join("");
  }
  function renderActivityFeed(){
    var target=$("activityFeed");if(!target)return;
    var rank=INTERESTS.rank(Object.keys(ACTIVITIES).map(activitySummary),STATE.activityPriority,STATE.activityScope==="all");
    var shown=rank.filter(function(x){return STATE.activityFilter==="all"||x.info.category===STATE.activityFilter;});
    target.innerHTML=shown.map(function(x){
      var reason=x.data.reasons[0]||{detail:x.info.hint};
      var best=x.best?whenLabel(x.best.start)+" ~ "+hourLabel(x.best.end):"추천 구간 확인 필요";
      var bestIndex=x.best?STATE.hourly.findIndex(function(row){return row.time===x.best.start;}):0;
      var weather=STATE.hourly[Math.max(0,bestIndex)]||STATE.hourly[0]||{};
      var forecast=weatherSymbol(weather.code,weather.isDay);
      var scoreText=finite(x.data.score)?String(x.data.score):"--",scoreWidth=finite(x.data.score)?x.data.score:0;
      return '<button type="button" class="activity-feed-card stitch-card '+(x.key===STATE.activity?"selected":"")+'" data-activity-open="'+x.key+'" aria-label="'+safe(x.info.title+", "+grade(x.data.score)+(finite(x.data.score)?" "+x.data.score+"점":"")+", 추천 시간 날씨 "+forecast.name)+'"><span class="feed-icon" aria-hidden="true">'+x.info.icon+'</span><span class="feed-copy"><span><strong>'+safe(x.info.title)+'</strong><em class="feed-grade '+scoreClass(x.data.score)+'">'+grade(x.data.score)+'</em></span><small class="feed-best-time"><span aria-hidden="true">'+forecast.icon+'</span>추천 시간: '+safe(best)+' · '+safe(forecast.name)+'</small><span class="feed-metrics"><span>☂ '+num(weather.rain)+'%</span><span>≋ '+num(weather.wind)+'km/h</span><span>습도 '+num(weather.humidity)+'%</span></span><span class="feed-progress" aria-hidden="true"><i style="width:'+scoreWidth+'%"></i></span><p>'+safe(reason.detail)+'</p></span><span class="score-ring" style="--score:'+scoreWidth+'"><b>'+scoreText+'</b><small>'+(finite(x.data.score)?"점":"")+'</small></span><span class="material-symbols-outlined feed-arrow" aria-hidden="true">chevron_right</span></button>';
    }).join("")||'<div class="empty-state">표시할 관심 활동이 없습니다. 관심 활동 설정에서 선택하거나 전체 활동을 확인하세요.</div>';
    var lead=shown[0];
    if(!lead){text("activitySummaryText","표시할 활동이 없습니다");text("activitySummarySub","관심 활동이나 분류를 변경해 주세요.");text("activitySummaryScore","--");}
    if(lead){text("activitySummaryText",finite(lead.data.score)?(STATE.activityScope==="mine"?"선택한 ":"")+lead.info.title+(lead.data.score>=60?"에 유리한 시간대":" · 적합한 시간이 적어요"):"활동 판단 자료 부족");text("activitySummarySub",lead.best?"추천 "+whenLabel(lead.best.start):lead.info.hint);text("activitySummaryScore",finite(lead.data.score)?lead.data.score:"--");}
  }
  function renderActivity(){
    var key=STATE.activity,info=ACTIVITIES[key],now=activityEvalAt(key,0),best=bestActivity(key);
    text("activityTitle",info.icon+" "+info.title);
    text("activityScore",finite(now.score)?now.score:"--");
    text("activityGrade",grade(now.score));
    $("activityProgress").style.width=(finite(now.score)?now.score:0)+"%";
    text("activityDetail",info.hint+" 현재 조건 평가 "+grade(now.score)+".");
    text("activityBest",best?whenLabel(best.start)+" ~ "+hourLabel(best.end)+" ("+best.score+"점)":"적합 구간 확인 불가");
    $("activityReasons").innerHTML=now.reasons.map(function(r){return '<div class="reason-item"><span class="reason-icon" aria-hidden="true">✦</span><div><b>'+safe(r.label)+'</b><p>'+safe(r.detail)+'</p></div></div>';}).join("");
    $("activityHours").innerHTML=STATE.hourly.slice(0,24).map(function(x,i){var s=activityEvalAt(key,i).score,c=!finite(s)?"unknown":s>=80?"good":s>=50?"mid":"bad";return '<div class="suitability '+c+'"><span>'+safe(i===0?"지금":hourLabel(x.time))+'</span><b>'+(finite(s)?s:"--")+'</b><span>'+grade(s)+'</span></div>';}).join("");
    renderActivityFeed();
  }
  function airLevel(value,thresholds){
    if(!finite(value))return {grade:"정보 없음",color:"normal",rank:1};
    if(value<=thresholds[0])return {grade:"좋음",color:"good",rank:0};
    if(value<=thresholds[1])return {grade:"보통",color:"normal",rank:1};
    if(value<=thresholds[2])return {grade:"나쁨",color:"bad",rank:2};
    return {grade:"매우 나쁨",color:"very-bad",rank:3};
  }
  function renderAir(){
    var a=STATE.air&&STATE.air.current;
    if(!a){text("airGrade","대기질 제공 지연");text("airStatement","예측값을 가져오지 못했습니다. 새로고침 해보세요.");text("airMetrics","현재 이용할 수 있는 대기질 데이터가 없습니다.");if($("airSummaryGrade")){text("airSummaryGrade","예측 정보 지연");text("airSummarySource","대기질 연결 지연");text("airSummaryAdvice","공기질 정보를 다시 확인해 주세요.");}return;}
    var values=[
      {name:"미세먼지 PM10",value:a.pm10,thresholds:[30,80,150]},
      {name:"초미세먼지 PM2.5",value:a.pm2_5,thresholds:[15,35,75]}
    ];
    var statuses=values.map(function(v){return airLevel(v.value,v.thresholds);});
    var worst=statuses.reduce(function(p,c){return c.rank>p.rank?c:p;},statuses[0]);
    var label=$("airGrade");label.className="air-grade "+worst.color;label.textContent=worst.grade;
    if($("airSummaryGrade")){text("airSummarySource","모델 예측 · "+a.time.replace("T"," "));text("airSummaryGrade","공기 "+worst.grade);text("airPm10",num(a.pm10));text("airPm25",num(a.pm2_5));text("airSummaryAdvice",worst.rank<=1?"환기와 야외활동에 무난해요.":worst.rank===2?"민감군은 오래 머무는 야외활동을 줄이세요.":"외출 전 마스크를 준비하고 환기는 짧게 하세요.");$("airSummaryGrade").className="air-summary-grade "+worst.color;}
    text("airStatement",worst.rank<=1?"대기질 예측이 비교적 양호한 편이에요.":"대기질 예측이 좋지 않습니다. 야외활동 전 공식 관측값도 확인하세요.");
    text("airTime","예측 기준 "+a.time.replace("T"," ")+" (KST) · 모델 추정치");
    $("airMetrics").innerHTML=values.map(function(v,i){var st=statuses[i];var percent=finite(v.value)?clamp(v.value/(v.thresholds[2]*1.5)*100,1,100):0;return '<div><div class="air-row-head"><b>'+v.name+'</b><span>'+st.grade+' <strong>'+num(v.value,1)+'</strong></span></div><div class="air-bar"><div style="width:'+percent+'%"></div></div></div>';}).join("");
  }
  function setView(view){
    var openAlerts=view==="notifications";
    if(openAlerts)view="briefing";
    if(!["today","briefing","hourly","weekly","activity","air","map","compare","settings","notifications"].includes(view))return;
    if(view!=="map")setMapFocus(false);
    STATE.view=view;
    if($("temporaryLocationNotice"))$("temporaryLocationNotice").hidden=!STATE.loc.temporary||view!=="today";
    document.querySelectorAll(".screen").forEach(function(el){el.classList.toggle("active",el.id==="view-"+view);});
    document.querySelectorAll("[data-view]").forEach(function(el){var a=el.dataset.view===view;el.classList.toggle("active",a);if(el.classList.contains("nav-button")||el.closest(".mobile-nav"))el.setAttribute("aria-current",a?"page":"false");});
    window.scrollTo({top:0,behavior:"instant"});
    if(openAlerts)$("watchSettings")?.scrollIntoView({block:"start"});
    if(view==="map")showMap();
    window.dispatchEvent(new CustomEvent("weatherhannun:view",{detail:{
      view:view,
      data:STATE.weather?{weather:STATE.weather,loc:STATE.loc,air:STATE.air,at:STATE.fetchedAt,status:STATE.dataStatus,source:PROVIDER?PROVIDER.sourceRecord({payload:STATE.weather,fetchedAt:STATE.fetchedAt,cached:STATE.dataStatus!=="live"}):null}:null
    }}));
  }
  function setMapFocus(active){
    var shell=$("mapShell");shell.classList.toggle("focus-mode",!!active);
    $("mapFocus").setAttribute("aria-pressed",active?"true":"false");
    $("mapClose").hidden=!active;
    document.body.style.overflow=active?"hidden":"";
    refreshMapLayout(false);
  }
  function getMapElement() { return $("map"); }
  function refreshMapLayout(redrawTiles){
    if(!STATE.map)return;
    function resize(){
      if(!STATE.map||!getMapElement().isConnected)return;
      STATE.map.invalidateSize({animate:false,pan:false});
      if(redrawTiles&&STATE.tileLayer)STATE.tileLayer.redraw();
    }
    requestAnimationFrame(function(){requestAnimationFrame(resize);});
    setTimeout(resize,120);
    setTimeout(function(){if(redrawTiles&&STATE.tileLayer)STATE.tileLayer.redraw();resize();},360);
  }
  function initMap(){
    if(STATE.map)return true;
    if(!window.L){getMapElement().innerHTML='<div class="map-fallback">지도를 불러올 수 없습니다. 아래 도시별 카드에서는 날씨를 확인할 수 있습니다.</div>';return false;}
    getMapElement().innerHTML="";
    STATE.map=L.map("map",{zoomControl:true,scrollWheelZoom:false,preferCanvas:true}).setView([36.1,127.8],7);
    STATE.tileLayer=L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png",{maxZoom:17,keepBuffer:4,updateWhenIdle:false,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(STATE.map);
    if("ResizeObserver" in window){
      STATE.mapObserver=new ResizeObserver(function(){refreshMapLayout(false);});
      STATE.mapObserver.observe($("mapShell"));
    }
    window.addEventListener("resize",function(){refreshMapLayout(false);},{passive:true});
    refreshMapLayout(true);
    return true;
  }
  function renderCities(){
    if(!STATE.cityData)return;
    $("cityGrid").innerHTML=STATE.cityData.map(function(x,i){
      var sym=weatherSymbol(x.code,x.isDay);
      var alert=x.precipitation>0?"비 "+num(x.precipitation,1)+"mm":x.gust>=35?"돌풍 "+num(x.gust)+"km/h":"특이 신호 없음";
      return '<button class="city-card" data-city="'+i+'" aria-label="'+safe(x.name+", "+sym.name+", "+num(x.temp)+"도, "+alert+", 지역 예보 보기")+'"><div class="city-top"><span class="city-name">'+safe(x.name)+'</span><span aria-hidden="true">'+sym.icon+'</span></div><span class="city-temp">'+num(x.temp)+'°</span><span class="city-signal '+(x.precipitation>0?'rain':x.gust>=35?'wind':'calm')+'">'+safe(alert)+'</span><span class="city-desc">체감 '+num(x.apparent)+'° · 바람 '+num(x.wind)+'km/h</span></button>';
    }).join("");
    document.querySelectorAll(".city-card[data-city]").forEach(function(btn){btn.addEventListener("click",function(){chooseCity(Number(btn.dataset.city));});});
  }
  function renderNationalOverview(){
    var rows=(STATE.cityData||[]).filter(function(x){return finite(x.temp);});if(!rows.length)return;
    var hot=rows.reduce(function(a,b){return b.temp>a.temp?b:a;}),cold=rows.reduce(function(a,b){return b.temp<a.temp?b:a;});
    var rainy=rows.filter(function(x){return x.precipitation>0;}),windy=rows.filter(function(x){return x.gust>=35;});
    var headline=rainy.length||windy.length?(rainy.length?rainy.length+"곳에 비 신호":"강수 신호 없음")+(windy.length?" · "+windy.length+"곳 돌풍 주의":""):"전국 주요 도시, 뚜렷한 위험 신호 없음";
    text("nationalHeadline",headline);
    text("nationalSummary",hot.name+" "+num(hot.temp)+"°로 가장 높고 "+cold.name+" "+num(cold.temp)+"°로 가장 낮습니다. 도시 간 기온 차이는 "+num(hot.temp-cold.temp)+"°입니다.");
    $("nationalMetrics").innerHTML='<article><span>가장 따뜻</span><strong>'+safe(hot.name)+' '+num(hot.temp)+'°</strong></article><article><span>가장 서늘</span><strong>'+safe(cold.name)+' '+num(cold.temp)+'°</strong></article><article><span>강수 신호</span><strong>'+rainy.length+'곳</strong></article><article><span>돌풍 주의</span><strong>'+windy.length+'곳</strong></article>';
  }
  function mapMetricValue(city){
    if(STATE.mapMetric==="rain")return {value:num(city.precipitation,1)+"mm",tone:city.precipitation>0?"rain":"calm"};
    if(STATE.mapMetric==="wind")return {value:num(city.gust)+"km/h",tone:city.gust>=35?"wind":"calm"};
    return {value:num(city.temp)+"°",tone:"temperature"};
  }
  function selectMapMetric(metric){
    if(!["temperature","rain","wind"].includes(metric))return;STATE.mapMetric=metric;
    document.querySelectorAll("[data-map-metric]").forEach(function(button){var active=button.dataset.mapMetric===metric;button.classList.toggle("active",active);button.setAttribute("aria-pressed",active?"true":"false");});
    text("mapMetricTitle",metric==="rain"?"전국 강수 신호":metric==="wind"?"전국 돌풍 비교":"전국 기온 비교");
    text("mapHint",metric==="rain"?"현재 강수량을 비교합니다. 0mm는 현재 비 신호가 없다는 뜻입니다.":metric==="wind"?"돌풍 35km/h 이상 지역을 강조합니다.":"같은 시각의 기온 차이를 비교합니다.");
    updateMapMarkers();
  }
  function chooseCity(i){
    var city=STATE.cityData&&STATE.cityData[i];if(!city)return;
    setMapFocus(false);applyLocation(city,false,true);setView("today");toast(city.name+"의 날씨를 불러옵니다.");
  }
  function updateMapMarkers(){
    if(!STATE.cityData||!initMap())return;
    STATE.markers.forEach(function(m){STATE.map.removeLayer(m);});STATE.markers=[];
    STATE.cityData.forEach(function(city,i){
      var sym=weatherSymbol(city.code,city.isDay);
      var metric=mapMetricValue(city),accessible=city.name+", "+sym.name+", "+metric.value;
      var content='<div class="weather-pin-card metric-'+metric.tone+'"><span aria-hidden="true">'+sym.icon+'</span><em>'+safe(city.name)+'</em><b>'+metric.value+'</b></div>';
      var marker=L.marker([city.lat,city.lon],{title:accessible,alt:accessible,icon:L.divIcon({className:"weather-map-pin",html:content,iconSize:[126,45],iconAnchor:[63,44]})}).addTo(STATE.map);
      marker.bindPopup('<b>'+safe(city.name)+'</b><p>'+sym.name+' · '+num(city.temp)+'°</p><button class="map-open-city">이 지역 예보 보기 →</button>');
      marker.on("click",function(){if(window.innerWidth<710)setMapFocus(true);});
      marker.on("popupopen",function(){
        var pop=marker.getPopup().getElement(),b=pop&&pop.querySelector(".map-open-city");
        if(b)b.addEventListener("click",function(){chooseCity(i);},{once:true});
      });
      STATE.markers.push(marker);
    });
    refreshMapLayout(true);
  }
  async function showMap(){
    loadNationalWeather();
    initMap();
    refreshMapLayout(true);
    if(STATE.cityData){renderNationalOverview();renderCities();updateMapMarkers();return;}
    if(STATE.mapBusy)return;
    var progressId=window.WeatherActionProgress?.begin("전국 날씨를 불러오는 중…");
    STATE.mapBusy=true;
    text("mapUpdated","주요 도시 예보 조회 중");
    $("cityGrid").innerHTML='<div class="empty-state">전국 주요 도시의 현재 날씨를 가져오고 있습니다…</div>';
    try{
      var results=await Promise.allSettled(CITY_LIST.map(function(city){return fetchUnifiedWeather(city);}));
      STATE.cityData=CITY_LIST.map(function(city,i){
        var v=results[i].status==="fulfilled"?results[i].value.weather.current:null;
        return {name:city.name,lat:city.lat,lon:city.lon,temp:v?.temperature_2m,apparent:v?.apparent_temperature,precipitation:v?.precipitation,wind:v?.wind_speed_10m,gust:v?.wind_gusts_10m,code:v?.weather_code,isDay:v?.is_day};
      });
      text("mapUpdated","도시별 모델 예보 · "+new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Seoul"})+" 갱신");
      renderNationalOverview();renderCities();updateMapMarkers();
    }finally{
      STATE.mapBusy=false;
      window.WeatherActionProgress?.end(progressId);
    }
  }
  var nationalPayloads=null,nationalFetched=0,nationalFailed=false,nationalBusy=false,nationalDate=null,nationalPeriod="current",nationalDays=[];
  function renderNationalWeather(){
    var core=window.WeatherNationalCore;if(!core)return;
    nationalDays=core.dates();
    if(!nationalDays.includes(nationalDate))nationalDate=nationalDays[0];
    // KMA's short-term API does not promise seven days. Keep the seven-day
    // selector visible, but disable dates that have not been published.
    var issued=nationalFetched?core.forecastDates(nationalPayloads):[];
    if(issued.length&&nationalDate!==nationalDays[0]&&!issued.includes(nationalDate)){
      nationalDate=issued.filter(function(day){return nationalDays.includes(day);}).at(-1)||nationalDays[0];
      if(nationalPeriod==="current")nationalPeriod="morning";
    }
    $("nationalDates").innerHTML=nationalDays.map(function(day,i){
      var d=localDate(day),unavailable=issued.length>0&&i>0&&!issued.includes(day);
      return '<button type="button" data-national-date="'+day+'" aria-pressed="'+(day===nationalDate)+'"'+(unavailable?' disabled title="기상청 단기예보가 아직 발표되지 않았습니다."':'')+'><span>'+new Intl.DateTimeFormat('ko-KR',{weekday:'short',timeZone:'Asia/Seoul'}).format(d)+'</span><small>'+(i===0?'오늘':day.slice(5).replace('-','.'))+'</small></button>';
    }).join('');
    document.querySelectorAll('[data-national-period]').forEach(function(b){
      b.disabled=b.dataset.nationalPeriod==='current'&&nationalDate!==nationalDays[0];
      b.setAttribute('aria-pressed',String(b.dataset.nationalPeriod===nationalPeriod));
    });
    var missing=0,available=0;
    $("nationalPins").innerHTML=core.cities.map(function(city,i){
      var v=core.sample(nationalPayloads?.[i],nationalDate,nationalPeriod,nationalDays[0]);
      var valid=v&&finite(v.temperature_2m);
      if(valid)available++;else missing++;
      var sym=weatherSymbol(valid?v.weather_code:undefined,v?.is_day);
      return '<button type="button" class="national-city" data-national-city="'+i+'" style="left:'+city.x+'%;top:'+city.y+'%" aria-label="'+safe(city.name+' '+(valid?num(v.temperature_2m,1)+'도 '+sym.name:'선택 시각 예보 없음')+' 상세 날씨 임시 조회')+'"><span class="national-icon" aria-hidden="true">'+sym.icon+'</span><span>'+safe(city.name)+'</span><b>'+(valid?num(v.temperature_2m,1)+'°':'--')+'</b></button>';
    }).join('');
    var label=nationalDate+' · '+(nationalPeriod==='current'?'현재 시각':nationalPeriod==='morning'?'오전 9시':'오후 3시')+' 모델 예보';
    if(nationalFetched&&!available&&!nationalBusy){
      var clock=new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
      var target=nationalPeriod==='morning'?'09:00':nationalPeriod==='afternoon'?'15:00':null;
      label+=nationalDate===nationalDays[0]&&target&&clock>target?' · 지난 시각 예보는 제공되지 않습니다':' · 해당 시각 예보가 발표되지 않았습니다';
    }else if(missing)label+=' · '+missing+'곳 자료 없음';
    if(nationalFetched)label+=' · 조회 '+new Date(nationalFetched).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'});
    if(nationalFailed)label+=' · 일부 지역 갱신 실패';
    $("nationalTime").textContent=label;
  }
  async function loadNationalWeather(force){
    if(!window.WeatherNationalCore||nationalBusy)return;
    if(nationalPayloads&&!nationalFailed&&!force&&Date.now()-nationalFetched<15*60000){renderNationalWeather();return;}
    nationalBusy=true;$("nationalReload").disabled=true;
    var cities=window.WeatherNationalCore.cities;
    var previous=nationalPayloads?.slice()||Array(cities.length).fill(null);
    var next=previous.slice(),cursor=0,done=0,succeeded=0,failed=0;
    nationalPayloads=next;
    renderNationalWeather();$("nationalTime").textContent='전국 예보를 불러오는 중…';
    try{
      // Bound upstream concurrency and render completed cities immediately.
      await Promise.all(Array.from({length:Math.min(5,cities.length)},async function(){
        while(true){
          var i=cursor++;if(i>=cities.length)return;
          try{
            var response=await fetchUnifiedWeather(cities[i],13000);
            if(!Array.isArray(response.weather?.hourly?.time)||!response.weather.hourly.time.length)throw new Error('예보 시간 없음');
            next[i]=response.weather;succeeded++;
          }catch(error){failed++;}
          done++;renderNationalWeather();
          $("nationalTime").textContent='전국 예보 조회 중… '+done+'/'+cities.length+'곳';
        }
      }));
      if(!succeeded&&!next.some(Boolean))throw new Error('전국 예보 응답을 확인할 수 없습니다.');
      nationalPayloads=next;nationalFetched=Date.now();nationalFailed=failed>0;
    }catch(error){
      nationalFailed=true;
      $("nationalTime").textContent='전국 예보 연결 실패'+(next.some(Boolean)?' · 이전 조회 자료 표시':' · 다시 시도해 주세요');
      return;
    }finally{
      nationalBusy=false;$("nationalReload").disabled=false;
    }
    renderNationalWeather();
  }
  function searchDialogOpen(){
    $("locationDialog").showModal();
    $("locationSearch").focus();
  }
  function renderPresets(){
    $("presetCities").innerHTML=CITY_LIST.map(function(c,i){return '<button data-preset="'+i+'">'+safe(c.name)+'</button>';}).join("");
    document.querySelectorAll("[data-preset]").forEach(function(btn){btn.addEventListener("click",function(){var c=CITY_LIST[Number(btn.dataset.preset)];$("locationDialog").close();applyLocation(c,true);});});
  }
  function getGeo(){
    if(window.WeatherLocationManager?.requestCurrentPosition){
      window.WeatherLocationManager.requestCurrentPosition(true);
    }else{
      toast("위치 관리 기능을 불러오지 못했습니다. 다시 시작해 주세요.");
    }
  }
  function share(){
    var url=new URL(location.href);url.searchParams.set("lat",String(STATE.loc.lat));url.searchParams.set("lon",String(STATE.loc.lon));url.searchParams.set("name",STATE.loc.name);
    var data={title:"날씨한눈",text:STATE.loc.name+"의 날씨 확인",url:url.href};
    if(navigator.share){navigator.share(data).catch(function(){});}
    else if(navigator.clipboard){navigator.clipboard.writeText(url.href).then(function(){toast("지역 공유 링크를 복사했습니다.");}).catch(function(){toast("링크 복사에 실패했습니다.");});}
    else toast("주소창 URL을 복사해 주세요.");
  }
  function init() {
    text("todayDate",new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date()));
    var p=new URLSearchParams(location.search),l=null;
    if(p.has("lat")&&p.has("lon"))l={name:p.get("name")||"선택 지역",lat:Number(p.get("lat")),lon:Number(p.get("lon")),source:"manual"};
    if(!validLocation(l))l=storeGet("weatherhannun_location");
    if(!validLocation(l))l=CITY_LIST[0];
    var remembered=storeGet("weatherhannun_activity_v1");
    if(typeof remembered==="string"&&ACTIVITIES[remembered])STATE.activity=remembered;
    STATE.activityPriority=INTERESTS.normalize(storeGet("weatherhannun_activity_interests_v1"));
    document.querySelectorAll("[data-interest]").forEach(function(input){
      input.checked=STATE.activityPriority.includes(input.value);
      input.addEventListener("change",function(){
        STATE.activityPriority=INTERESTS.normalize(Array.from(document.querySelectorAll("[data-interest]:checked")).map(function(x){return x.value;}));
        storeSet("weatherhannun_activity_interests_v1",STATE.activityPriority);
        text("activityInterestsStatus","관심 활동 "+STATE.activityPriority.length+"개 선택 · 이 기기에 자동 저장됩니다.");
        if(STATE.weather){renderDecisions();renderActivityFeed();}
      });
    });
    document.querySelectorAll("[data-activity-scope]").forEach(function(btn){btn.addEventListener("click",function(){
      STATE.activityScope=btn.dataset.activityScope;
      document.querySelectorAll("[data-activity-scope]").forEach(function(b){b.classList.toggle("active",b===btn);b.setAttribute("aria-pressed",String(b===btn));});
      if(STATE.weather)renderActivityFeed();
    });});
    document.querySelectorAll("[data-activity]").forEach(function(b){b.classList.toggle("active",b.dataset.activity===STATE.activity);});
    window.addEventListener("weatherhannun:change-location",function(ev){
      if(validLocation(ev.detail))applyLocation(ev.detail,true);
    });
    document.querySelectorAll("[data-view]").forEach(function(btn){btn.addEventListener("click",function(){setView(btn.dataset.view);});});
    document.querySelectorAll("[data-scroll-target]").forEach(function(btn){btn.addEventListener("click",function(){var id=btn.dataset.scrollTarget;requestAnimationFrame(function(){var target=$(id);if(target)target.scrollIntoView({behavior:"smooth",block:"start"});});});});
    document.querySelectorAll("[data-activity]").forEach(function(btn){btn.addEventListener("click",function(){
      STATE.activity=btn.dataset.activity;
      storeSet("weatherhannun_activity_v1",STATE.activity);
      document.querySelectorAll("[data-activity]").forEach(function(b){b.classList.toggle("active",b.dataset.activity===STATE.activity);});
      if(STATE.weather)renderActivity();
    });});
    $("quickActivity").addEventListener("click",function(event){
      var target=event.target.closest("[data-quick-activity]");
      if(!target||!ACTIVITIES[target.dataset.quickActivity])return;
      STATE.activity=target.dataset.quickActivity;
      storeSet("weatherhannun_activity_v1",STATE.activity);
      document.querySelectorAll("[data-activity]").forEach(function(b){b.classList.toggle("active",b.dataset.activity===STATE.activity);});
      if(STATE.weather)renderActivity();
      setView("activity");
    });
    $("activityFeed").addEventListener("click",function(event){
      var target=event.target.closest("[data-activity-open]");
      if(!target||!ACTIVITIES[target.dataset.activityOpen])return;
      STATE.activity=target.dataset.activityOpen;
      storeSet("weatherhannun_activity_v1",STATE.activity);
      document.querySelectorAll("[data-activity]").forEach(function(b){b.classList.toggle("active",b.dataset.activity===STATE.activity);});
      renderActivity();
      $("activityDetailPanel").scrollIntoView({behavior:"smooth",block:"start"});
    });
    document.querySelectorAll("[data-activity-filter]").forEach(function(btn){btn.addEventListener("click",function(){
      STATE.activityFilter=btn.dataset.activityFilter;
      document.querySelectorAll("[data-activity-filter]").forEach(function(b){b.classList.toggle("active",b===btn);});
      if(STATE.weather)renderActivityFeed();
    });});
    $("weeklyCards").addEventListener("click",function(event){
      var button=event.target.closest("[data-week-index]");if(!button)return;
      var detail=button.nextElementSibling,open=button.getAttribute("aria-expanded")==="true";
      button.setAttribute("aria-expanded",String(!open));if(detail)detail.hidden=open;
    });
    $("locationButton").addEventListener("click",searchDialogOpen);
    $("settingsManageLocations").addEventListener("click",searchDialogOpen);
    $("settingsUseCurrentLocation").addEventListener("click",getGeo);
    $("dialogClose").addEventListener("click",function(){$("locationDialog").close();});
    $("geoButton").addEventListener("click",getGeo);
    $("refreshButton").addEventListener("click",function(){loadWeather(true);if(STATE.view==="map"){STATE.cityData=null;showMap();}});
    $("heroShare").addEventListener("click",share);
    $("mapTools").addEventListener("click",function(){var e=$("mapExtra"),open=e.hidden;e.hidden=!open;$("mapTools").setAttribute("aria-expanded",open?"true":"false");});
    $("mapCollapse").addEventListener("click",function(){$("mapExtra").hidden=true;$("mapTools").setAttribute("aria-expanded","false");});
    $("mapFocus").addEventListener("click",function(){setMapFocus(!$("mapShell").classList.contains("focus-mode"));});
    $("mapClose").addEventListener("click",function(){setMapFocus(false);});
    $("mapReset").addEventListener("click",function(){if(STATE.map)STATE.map.setView([36.1,127.8],7);});
    $("mapCurrent").addEventListener("click",getGeo);
    document.querySelectorAll("[data-map-metric]").forEach(function(button){button.addEventListener("click",function(){selectMapMetric(button.dataset.mapMetric);});});
    document.addEventListener("keydown",function(e){if(e.key==="Escape")setMapFocus(false);});
    $("nationalDates").addEventListener('click',function(e){var b=e.target.closest('[data-national-date]');if(!b)return;nationalDate=b.dataset.nationalDate;if(nationalDate!==nationalDays[0]&&nationalPeriod==='current')nationalPeriod='morning';renderNationalWeather();});
    document.querySelectorAll('[data-national-period]').forEach(function(b){b.addEventListener('click',function(){nationalPeriod=b.dataset.nationalPeriod;renderNationalWeather();});});
    $("nationalPins").addEventListener('click',function(e){var b=e.target.closest('[data-national-city]');if(!b)return;var city=window.WeatherNationalCore.cities[Number(b.dataset.nationalCity)];applyLocation(city,false,true);setView('today');toast(city.name+' 임시 조회 · 현위치는 변경하지 않습니다.');});
    $("nationalReload").addEventListener('click',function(){loadNationalWeather(true);});
    $("restoreLocation").addEventListener('click',function(){var saved=storeGet('weatherhannun_location');applyLocation(validLocation(saved)?saved:CITY_LIST[0],false);setView('today');});
    renderPresets();
    applyLocation(l,false);
    if("serviceWorker" in navigator && location.protocol==="https:")navigator.serviceWorker.register("./sw.js?v=43").catch(function(){});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
