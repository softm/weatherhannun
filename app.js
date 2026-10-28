"use strict";
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var PROVIDER = window.WeatherProviderCore;
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
  var PLUS_PERSONALIZATION=window.WeatherHannunPlusPersonalization;
  var ACTIVITIES=ACTIVITY_CORE?ACTIVITY_CORE.DEFINITIONS:{};
  var STATE = {
    loc: CITY_LIST[0], weather: null, air: null, activity: "walk", dataStatus: "loading",
    view: "today", hourly: [], fetchedAt: null, cityData: null,
    map: null, tileLayer: null, mapObserver: null, markers: [], loading: false, ticket: 0, mapBusy: false, activityFilter: "all", activityPriority: []
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
  function applyLocation(loc, updateUrl) {
    if(!validLocation(loc))return;
    var previous=STATE.loc,changed=Number(previous.lat)!==Number(loc.lat)||Number(previous.lon)!==Number(loc.lon);
    var source=loc.source==="gps"?"gps":"manual";
    STATE.loc={name:String(loc.name).trim().slice(0,75)||"선택 지역",lat:Number(loc.lat),lon:Number(loc.lon),source:source,
      address:typeof loc.address==="string"?loc.address.slice(0,170):"",
      administrative:typeof loc.administrative==="string"?loc.administrative.slice(0,145):"",
      approximate:loc.approximate===true,regionCenter:loc.regionCenter===true};
    if(changed){
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
    storeSet("weatherhannun_location",STATE.loc);
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
    if(changed||!STATE.weather)loadWeather();
    else renderAll();
  }
  function forecastUrl(loc,short) {
    return PROVIDER?PROVIDER.buildForecastUrl(loc,{short:!!short}):"";
  }
  function airUrl(loc) {
    return PROVIDER?PROVIDER.buildAirUrl(loc):"";
  }
  async function getJson(url) {
    if(!url)throw new Error("데이터 공급자 설정을 불러오지 못했습니다.");
    var ctrl=new AbortController();
    var timeout=setTimeout(function(){ctrl.abort();},13000);
    try {
      var res=await fetch(url,{signal:ctrl.signal});
      if (!res.ok) throw new Error("서버 응답 "+res.status);
      var data=await res.json();
      if(data.error) throw new Error(data.reason||"제공 데이터 오류");
      return data;
    } finally { clearTimeout(timeout); }
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
  async function loadWeather(force) {
    var progressId=window.WeatherActionProgress?.begin("날씨 정보를 불러오는 중…");
    var ticket=++STATE.ticket;
    STATE.loading=true;
    $("updatedBadge").textContent="예보 갱신 중…";
    $("dataFooterStatus").textContent="예보 데이터 갱신 중";
    $("refreshButton").disabled=true;
    var loc=STATE.loc;
    var cache=storeGet("weatherhannun_last");
    var cachedWeatherValid=cache&&PROVIDER&&PROVIDER.inspectForecastPayload(cache.weather).valid;
    var cachedAirValid=cache&&cache.air&&PROVIDER&&PROVIDER.inspectAirPayload(cache.air).valid;
    if (!force && cache && cache.loc && cache.loc.lat===loc.lat && cache.loc.lon===loc.lon && cachedWeatherValid) {
      STATE.weather=cache.weather;STATE.air=cachedAirValid?cache.air:null;STATE.fetchedAt=cache.at||null;STATE.hourly=makeHours(STATE.weather);STATE.dataStatus="cached";renderAll();
    }
    try {
      var results=await Promise.allSettled([getJson(forecastUrl(loc,false)),getJson(airUrl(loc))]);
      if(ticket!==STATE.ticket)return;
      var weather=results[0].status==="fulfilled"?results[0].value:null;
      var airCandidate=results[1].status==="fulfilled"?results[1].value:null;
      var air=PROVIDER&&PROVIDER.inspectAirPayload(airCandidate).valid?airCandidate:null;
      var contract=PROVIDER&&PROVIDER.inspectForecastPayload(weather);
      if(!contract||!contract.valid) throw new Error("날씨 데이터 계약에 필요한 값이 없습니다: "+((contract&&contract.missingFields)||["공급자 모듈"]).join(", "));
      STATE.weather=weather;
      STATE.air=air;
      STATE.dataStatus="live";
      STATE.fetchedAt=new Date().toISOString();
      STATE.hourly=makeHours(weather);
      storeSet("weatherhannun_last",{loc:loc,at:STATE.fetchedAt,weather:weather,air:air});
      storeSet("weatherhannun_fetch_meta",{at:STATE.fetchedAt,loc:loc.name,modelTime:weather.current.time,airTime:air&&air.current&&air.current.time,forecast:!!weather,air:!!air,contractVersion:PROVIDER&&PROVIDER.CONTRACT_VERSION,provider:PROVIDER&&PROVIDER.PROVIDER.id});
      renderAll();
      window.dispatchEvent(new CustomEvent("weatherhannun:forecast-result",{detail:{ok:true}}));
      if(!air) toast("대기질 API 연결이 불안정합니다. 날씨는 정상 표시됩니다.");
    }catch(e) {
      if(ticket!==STATE.ticket)return;
      STATE.dataStatus=STATE.weather?"cached-error":"error";
      $("updatedBadge").textContent=STATE.weather?"저장된 예보 · 연결 실패":"데이터 연결 오류";
      $("dataFooterStatus").textContent=STATE.weather?"저장된 예보 · 갱신 실패":"예보 연결 실패";
      if(STATE.weather)renderAll();
      window.dispatchEvent(new CustomEvent("weatherhannun:forecast-result",{detail:{ok:false}}));
      toast(e.message+" 네트워크 상태를 확인해 주세요.");
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
    var note=nextRain?whenLabel(nextRain.time)+"경 비 신호 "+(finite(nextRain.rain)&&nextRain.rain>=50?num(nextRain.rain)+"%":num(nextRain.mm,1)+"mm/h"):cold?"48시간 이내 저온 구간이 있습니다. 작물 냉해와 결빙에 유의하세요.":rainWindowComplete?"현재 모델 예보에서 12시간 내 뚜렷한 강수 신호가 낮습니다.":"강수 자료 일부가 없어 시간별 예보를 확인해 주세요.";
    text("noticeStrip",note);
    var at=STATE.fetchedAt?new Date(STATE.fetchedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Seoul"}):"조회 시각 없음";
    var last=STATE.fetchedAt?Date.parse(STATE.fetchedAt):NaN;
    var old=Number.isFinite(last)&&Date.now()-last>180*60000;
    var label=old?"오래된 저장 예보 · 재조회 필요":STATE.dataStatus==="live"?"API 조회 "+at:STATE.dataStatus==="cached-error"?"연결 오류 · 저장 예보":"저장된 예보 "+at;
    text("updatedBadge",label);
    text("modelTime","예보 유효시각 "+(c.time||"정보 없음").replace("T"," ")+" (KST) · 모델 산출시각 별도 미제공");
    text("dataFooterStatus",(STATE.dataStatus==="live"?"모델 예보 조회 성공":STATE.dataStatus==="cached-error"?"API 연결 실패 · 저장 예보":old?"오래된 저장 예보":"저장된 모델 예보")+(STATE.air?" · 대기질 예측 조회":" · 대기질 정보 없음"));
    renderHourly();
    renderWeek();
    renderDecisions();
    renderActivity();
    renderAir();
    window.dispatchEvent(new CustomEvent("weatherhannun:data",{detail:{weather:w,loc:STATE.loc,air:STATE.air,at:STATE.fetchedAt,status:STATE.dataStatus,source:PROVIDER?PROVIDER.sourceRecord({payload:w,fetchedAt:STATE.fetchedAt,cached:STATE.dataStatus!=="live",fallbackReason:STATE.dataStatus==="cached-error"?"network_error":""}):null}}));
  }
  function renderHourly(){
    var h=STATE.hourly.slice(0,36),width=Math.max(36*76,h.length*76);
    var values=h.map(function(x){return x.temp;}).filter(finite);
    if(!values.length){$("hourlyChart").textContent="시간별 기온 정보 없음";return;}
    var low=Math.floor(Math.min.apply(null,values)-2),high=Math.ceil(Math.max.apply(null,values)+2);
    if(high===low)high+=1;
    var coordinates=h.map(function(x,i){return finite(x.temp)?{x:38+i*76,y:103-(x.temp-low)/(high-low)*83}:null;});
    var segments=[],segment=[];
    coordinates.forEach(function(point){if(point)segment.push(point);else if(segment.length){segments.push(segment);segment=[];}});
    if(segment.length)segments.push(segment);
    var pointText=function(point){return point.x+","+point.y.toFixed(1);};
    var lines=segments.filter(function(items){return items.length>1;}).map(function(items){return '<polyline points="'+items.map(pointText).join(" ")+'" stroke="#ffcf78" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';}).join("");
    var fill=coordinates.every(Boolean)&&coordinates.length?'<polygon points="'+coordinates.map(pointText).join(" ")+' '+coordinates[coordinates.length-1].x+',121 38,121" fill="url(#lineFill)"/>':"";
    var labels=h.map(function(x,i){var point=coordinates[i];return point&&i%3===0?'<text x="'+point.x+'" y="'+(point.y-11).toFixed(1)+'" fill="#ffdd97" font-size="12" text-anchor="middle">'+safe(num(x.temp))+'°</text>':"";}).join("");
    var dots=h.map(function(_,i){var point=coordinates[i];return point&&i%3===0?'<circle cx="'+point.x+'" cy="'+point.y.toFixed(1)+'" r="3.4" fill="#ffda86"/>':"";}).join("");
    $("hourlyChart").innerHTML='<svg width="'+width+'" height="124" viewBox="0 0 '+width+' 124" role="img" aria-label="기온 변동 그래프"><defs><linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f7bd66" stop-opacity=".22"/><stop offset="100%" stop-color="#f7bd66" stop-opacity="0"/></linearGradient></defs>'+fill+lines+dots+labels+'</svg>';
    $("hourlyItems").innerHTML=h.map(function(x,i){var symbol=weatherSymbol(x.code,x.isDay),label=i===0?"현재":hourLabel(x.time);return '<div class="hour-item '+(i===0?"now":"")+'" data-hour-index="'+i+'" aria-label="'+safe(label+", "+symbol.name+", "+num(x.temp)+"도, 비 "+num(x.rain)+"퍼센트, 풍속 "+num(x.wind)+"킬로미터, 돌풍 "+num(x.gust)+"킬로미터")+'"><span class="hour-time">'+label+'</span><span class="hour-icon" aria-hidden="true">'+symbol.icon+'</span><span class="hour-temp">'+num(x.temp)+'°</span><span class="hour-rain">☂ '+num(x.rain)+'%</span><span class="hour-wind">풍 '+num(x.wind)+'</span><span class="hour-gust">돌 '+num(x.gust)+' km/h</span></div>';}).join("");
    var detail=$("hourlyDetailRows");
    if(detail){
      var windows=[];
      for(var start=0;start<Math.min(24,h.length);start+=3){
        var rows=h.slice(start,start+3),temps=rows.map(function(x){return x.temp;}).filter(finite),winds=rows.map(function(x){return x.wind;}).filter(finite),gusts=rows.map(function(x){return x.gust;}).filter(finite),rains=rows.map(function(x){return x.rain;}).filter(finite);
        if(!rows.length)continue;
        var avgTemp=temps.length===rows.length?temps.reduce(function(a,b){return a+b;},0)/temps.length:null;
        var maxWind=winds.length===rows.length?Math.max.apply(null,winds):null,maxGust=gusts.length===rows.length?Math.max.apply(null,gusts):null,maxRain=rains.length===rows.length?Math.max.apply(null,rains):null;
        windows.push({index:start,first:rows[0],last:rows[rows.length-1],temp:avgTemp,wind:maxWind,gust:maxGust,rain:maxRain});
      }
      detail.innerHTML=windows.map(function(x,i){
        var symbol=weatherSymbol(x.first.code,x.first.isDay),label=i===0?"지금부터":hourLabel(x.first.time)+"–"+hourLabel(x.last.time);
        return '<button type="button" class="hourly-detail-row" data-hour-window="'+x.index+'" aria-label="'+safe(label+", "+symbol.name+", 평균 "+num(x.temp)+"도, 비 "+num(x.rain)+"퍼센트, 풍속 "+num(x.wind)+"킬로미터, 돌풍 "+num(x.gust)+"킬로미터")+'"><span class="hourly-detail-icon" aria-hidden="true">'+symbol.icon+'</span><span class="hourly-detail-main"><b>'+safe(label)+'</b><small>'+safe(dateLabel(x.first.time.slice(0,10)))+' · '+safe(symbol.name)+'</small></span><span class="hourly-detail-metrics"><span><small>기온</small><b>'+num(x.temp)+'°</b></span><span><small>비</small><b>'+num(x.rain)+'%</b></span><span><small>풍속</small><b>'+num(x.wind)+'km/h</b></span><span><small>돌풍</small><b>'+num(x.gust)+'km/h</b></span></span><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>';
      }).join("");
    }
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
    var rank=PLUS_PERSONALIZATION?PLUS_PERSONALIZATION.order(candidates,STATE.activityPriority):candidates.sort(function(a,b){return (finite(b.data.score)?b.data.score:-1)-(finite(a.data.score)?a.data.score:-1);});
    var top=rank.slice(0,3);
    text("decisionLead",top[0]&&finite(top[0].data.score)&&top[0].data.score>=60?"오늘은 "+top[0].info.title+"에 유리한 시간대가 있어요.":top.some(function(x){return finite(x.data.score);})?"활동별 추천 시간과 위험 근거를 확인하세요.":"필수 예보값이 부족해 활동 점수를 만들지 않습니다.");
    $("quickActivity").innerHTML=top.map(function(x){return '<button type="button" class="quick-item" data-quick-activity="'+x.key+'"><div class="quick-icon">'+x.info.icon+'</div><div class="quick-main"><b>'+x.info.title+'</b><small>'+(x.best?"추천 "+whenLabel(x.best.start):"필수 예보값 확인 필요")+'</small></div><span class="quick-badge '+scoreClass(x.data.score)+'">'+grade(x.data.score)+(finite(x.data.score)?" "+x.data.score:"")+'</span></button>';}).join("");
  }
  function renderActivityFeed(){
    var target=$("activityFeed");if(!target)return;
    var rank=Object.keys(ACTIVITIES).map(activitySummary).sort(function(a,b){return (finite(b.data.score)?b.data.score:-1)-(finite(a.data.score)?a.data.score:-1);});
    var shown=rank.filter(function(x){return STATE.activityFilter==="all"||x.info.category===STATE.activityFilter;});
    target.innerHTML=shown.map(function(x){
      var reason=x.data.reasons[0]||{detail:x.info.hint};
      var best=x.best?whenLabel(x.best.start)+" ~ "+hourLabel(x.best.end):"추천 구간 확인 필요";
      var bestIndex=x.best?STATE.hourly.findIndex(function(row){return row.time===x.best.start;}):0;
      var weather=STATE.hourly[Math.max(0,bestIndex)]||STATE.hourly[0]||{};
      var forecast=weatherSymbol(weather.code,weather.isDay);
      var scoreText=finite(x.data.score)?String(x.data.score):"--",scoreWidth=finite(x.data.score)?x.data.score:0;
      return '<button type="button" class="activity-feed-card stitch-card '+(x.key===STATE.activity?"selected":"")+'" data-activity-open="'+x.key+'" aria-label="'+safe(x.info.title+", "+grade(x.data.score)+(finite(x.data.score)?" "+x.data.score+"점":"")+", 추천 시간 날씨 "+forecast.name)+'"><span class="feed-icon" aria-hidden="true">'+x.info.icon+'</span><span class="feed-copy"><span><strong>'+safe(x.info.title)+'</strong><em class="feed-grade '+scoreClass(x.data.score)+'">'+grade(x.data.score)+'</em></span><small class="feed-best-time"><span aria-hidden="true">'+forecast.icon+'</span>추천 시간: '+safe(best)+' · '+safe(forecast.name)+'</small><span class="feed-metrics"><span>☂ '+num(weather.rain)+'%</span><span>≋ '+num(weather.wind)+'km/h</span><span>습도 '+num(weather.humidity)+'%</span></span><span class="feed-progress" aria-hidden="true"><i style="width:'+scoreWidth+'%"></i></span><p>'+safe(reason.detail)+'</p></span><span class="score-ring" style="--score:'+scoreWidth+'"><b>'+scoreText+'</b><small>'+(finite(x.data.score)?"점":"")+'</small></span><span class="material-symbols-outlined feed-arrow" aria-hidden="true">chevron_right</span></button>';
    }).join("")||'<div class="empty-state">이 분류에 표시할 활동이 없습니다.</div>';
    var lead=shown[0]||rank[0];
    if(lead){text("activitySummaryText",finite(lead.data.score)?lead.info.title+"에 가장 좋은 조건":"활동 판단 자료 부족");text("activitySummarySub",lead.best?"추천 "+whenLabel(lead.best.start):lead.info.hint);text("activitySummaryScore",finite(lead.data.score)?lead.data.score:"--");}
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
    if(!a){text("airGrade","대기질 제공 지연");text("airStatement","예측값을 가져오지 못했습니다. 새로고침 해보세요.");text("airMetrics","현재 이용할 수 있는 대기질 데이터가 없습니다.");if($("airSummaryGrade"))text("airSummaryGrade","예측 정보 지연");return;}
    var values=[
      {name:"미세먼지 PM10",value:a.pm10,thresholds:[30,80,150]},
      {name:"초미세먼지 PM2.5",value:a.pm2_5,thresholds:[15,35,75]}
    ];
    var statuses=values.map(function(v){return airLevel(v.value,v.thresholds);});
    var worst=statuses.reduce(function(p,c){return c.rank>p.rank?c:p;},statuses[0]);
    var label=$("airGrade");label.className="air-grade "+worst.color;label.textContent=worst.grade;
    if($("airSummaryGrade")){text("airSummaryGrade","공기 "+worst.grade);text("airPm10",num(a.pm10));text("airPm25",num(a.pm2_5));$("airSummaryGrade").className="air-summary-grade "+worst.color;}
    text("airStatement",worst.rank<=1?"대기질 예측이 비교적 양호한 편이에요.":"대기질 예측이 좋지 않습니다. 야외활동 전 공식 관측값도 확인하세요.");
    text("airTime","예측 기준 "+a.time.replace("T"," ")+" (KST) · 모델 추정치");
    $("airMetrics").innerHTML=values.map(function(v,i){var st=statuses[i];var percent=finite(v.value)?clamp(v.value/(v.thresholds[2]*1.5)*100,1,100):0;return '<div><div class="air-row-head"><b>'+v.name+'</b><span>'+st.grade+' <strong>'+num(v.value,1)+'</strong></span></div><div class="air-bar"><div style="width:'+percent+'%"></div></div></div>';}).join("");
  }
  function setView(view){
    if(!["today","hourly","weekly","activity","air","map","compare","settings"].includes(view))return;
    if(view!=="map")setMapFocus(false);
    STATE.view=view;
    document.querySelectorAll(".screen").forEach(function(el){el.classList.toggle("active",el.id==="view-"+view);});
    document.querySelectorAll("[data-view]").forEach(function(el){var a=el.dataset.view===view;el.classList.toggle("active",a);if(el.classList.contains("nav-button"))el.setAttribute("aria-current",a?"page":"false");});
    window.scrollTo({top:0,behavior:"instant"});
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
      return '<button class="city-card" data-city="'+i+'" aria-label="'+safe(x.name+", "+sym.name+", "+num(x.temp)+"도, 지역 예보 보기")+'"><div class="city-top"><span class="city-name">'+safe(x.name)+'</span><span aria-hidden="true">'+sym.icon+'</span></div><span class="city-temp">'+num(x.temp)+'°</span><span class="city-desc">'+sym.name+' · 지역 날씨 보기 ↗</span></button>';
    }).join("");
    document.querySelectorAll(".city-card[data-city]").forEach(function(btn){btn.addEventListener("click",function(){chooseCity(Number(btn.dataset.city));});});
  }
  function chooseCity(i){
    var city=STATE.cityData&&STATE.cityData[i];if(!city)return;
    setMapFocus(false);applyLocation(city,true);setView("today");toast(city.name+"의 날씨를 불러옵니다.");
  }
  function updateMapMarkers(){
    if(!STATE.cityData||!initMap())return;
    STATE.markers.forEach(function(m){STATE.map.removeLayer(m);});STATE.markers=[];
    STATE.cityData.forEach(function(city,i){
      var sym=weatherSymbol(city.code,city.isDay);
      var accessible=city.name+", "+sym.name+", "+num(city.temp)+"도";
      var content='<div class="weather-pin-card"><span aria-hidden="true">'+sym.icon+'</span> '+safe(city.name)+' <b>'+num(city.temp)+'°</b></div>';
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
    initMap();
    refreshMapLayout(true);
    if(STATE.cityData){renderCities();updateMapMarkers();return;}
    if(STATE.mapBusy)return;
    var progressId=window.WeatherActionProgress?.begin("전국 날씨를 불러오는 중…");
    STATE.mapBusy=true;
    text("mapUpdated","주요 도시 예보 조회 중");
    $("cityGrid").innerHTML='<div class="empty-state">전국 주요 도시의 현재 날씨를 가져오고 있습니다…</div>';
    try{
      var results=await Promise.allSettled(CITY_LIST.map(function(city){return getJson(forecastUrl(city,true));}));
      STATE.cityData=CITY_LIST.map(function(city,i){
        var v=results[i].status==="fulfilled"?results[i].value.current:null;
        return {name:city.name,lat:city.lat,lon:city.lon,temp:v?.temperature_2m,code:v?.weather_code,isDay:v?.is_day};
      });
      text("mapUpdated","도시별 모델 예보 · "+new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Seoul"})+" 갱신");
      renderCities();updateMapMarkers();
    }finally{
      STATE.mapBusy=false;
      window.WeatherActionProgress?.end(progressId);
    }
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
    if(window.WeatherHannunPlusPreferences?.currentPriority)STATE.activityPriority=window.WeatherHannunPlusPreferences.currentPriority();
    document.querySelectorAll("[data-activity]").forEach(function(b){b.classList.toggle("active",b.dataset.activity===STATE.activity);});
    window.addEventListener("weatherhannun:change-location",function(ev){
      if(validLocation(ev.detail))applyLocation(ev.detail,true);
    });
    window.addEventListener("weatherhannun:activity-priority",function(ev){
      STATE.activityPriority=PLUS_PERSONALIZATION?PLUS_PERSONALIZATION.normalizePriority(ev.detail?.activities):[];
      if(STATE.weather)renderDecisions();
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
    $("hourlyDetailRows").addEventListener("click",function(event){
      var button=event.target.closest("[data-hour-window]");if(!button)return;
      var index=Number(button.dataset.hourWindow),scroll=$("hourlyScroll");
      document.querySelectorAll(".hourly-detail-row").forEach(function(row){row.classList.toggle("selected",row===button);});
      document.querySelectorAll(".hour-item[data-hour-index]").forEach(function(item){item.classList.toggle("selected",Number(item.dataset.hourIndex)>=index&&Number(item.dataset.hourIndex)<index+3);});
      if(scroll)scroll.scrollTo({left:Math.max(0,index*76-20),behavior:"smooth"});
      $("hourlyChart").scrollIntoView({behavior:"smooth",block:"center"});
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
    document.addEventListener("keydown",function(e){if(e.key==="Escape")setMapFocus(false);});
    renderPresets();
    applyLocation(l,false);
    if("serviceWorker" in navigator && location.protocol==="https:")navigator.serviceWorker.register("./sw.js?v=34").catch(function(){});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
