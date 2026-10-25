"use strict";
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var BASE = "https://api.open-meteo.com/v1/forecast";
  var AIR_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";
  var SEARCH_BASE = "https://geocoding-api.open-meteo.com/v1/search";
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
  var ACTIVITIES = {
    spray: { title: "농약 방제", icon: "🌿", hint: "바람·비·온도를 종합해 약제 비산 위험을 줄이는 데 참고하세요." },
    harvest: { title: "수확·농작업", icon: "🌾", hint: "비와 고온, 강풍을 피할 수 있는 시간대를 찾습니다." },
    walk: { title: "산책·외출", icon: "🚶", hint: "기온·비·자외선·바람을 고려합니다." },
    laundry: { title: "빨래", icon: "👕", hint: "비가 적고 습도가 낮은 낮 시간대를 우선합니다." },
    carwash: { title: "세차", icon: "🚗", hint: "당장뿐 아니라 다음 6시간의 강수 가능성도 확인합니다." }
  };
  var STATE = {
    loc: CITY_LIST[0], weather: null, air: null, activity: "walk", dataStatus: "loading",
    view: "today", hourly: [], fetchedAt: null, cityData: null,
    map: null, markers: [], loading: false, ticket: 0, mapBusy: false
  };
  var toastTimer;
  var searchTimer;
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
    if (!finite(code)) return {icon:"🌤️",name:"정보 없음"};
    if (code===0) return {icon:isDay===0?"🌙":"☀️",name:"맑음"};
    if (code===1) return {icon:isDay===0?"🌙":"🌤️",name:"대체로 맑음"};
    if (code===2) return {icon:"⛅",name:"구름 조금"};
    if (code===3) return {icon:"☁️",name:"흐림"};
    if (code===45||code===48) return {icon:"🌫️",name:"안개"};
    if (code>=51&&code<=57) return {icon:"🌦️",name:"이슬비"};
    if (code>=61&&code<=67) return {icon:"🌧️",name:"비"};
    if (code>=71&&code<=77) return {icon:"🌨️",name:"눈"};
    if (code>=80&&code<=82) return {icon:"🌧️",name:"소나기"};
    if (code>=85&&code<=86) return {icon:"❄️",name:"눈 소나기"};
    if (code>=95) return {icon:"⛈️",name:"뇌우"};
    return {icon:"🌤️",name:"날씨"};
  }
  function validLocation(loc) { return loc && typeof loc.name==="string" && loc.name.length<90 && finite(Number(loc.lat)) && finite(Number(loc.lon)) && Math.abs(Number(loc.lat))<=90 && Math.abs(Number(loc.lon))<=180; }
  function applyLocation(loc, updateUrl) {
    if (!validLocation(loc)) return;
    var changed=STATE.loc.lat!==Number(loc.lat)||STATE.loc.lon!==Number(loc.lon);
    STATE.loc = {name:String(loc.name).slice(0,45),lat:Number(loc.lat),lon:Number(loc.lon)};
    if(changed){STATE.weather=null;STATE.air=null;STATE.hourly=[];STATE.fetchedAt=null;text("currentTemp","--");text("weatherSummary","새 지역 예보 연결 중");}
    $("locationTitle").textContent=STATE.loc.name;
    $("heroLocation").textContent=STATE.loc.name;
    storeSet("weatherhannun_location",STATE.loc);
    if (updateUrl) {
      var url=new URL(location.href);
      url.searchParams.set("lat",String(STATE.loc.lat));
      url.searchParams.set("lon",String(STATE.loc.lon));
      url.searchParams.set("name",STATE.loc.name);
      history.replaceState(null,"",url.pathname+url.search);
    }
    loadWeather();
  }
  function forecastUrl(loc,short) {
    var url = new URL(BASE);
    url.searchParams.set("latitude",loc.lat);
    url.searchParams.set("longitude",loc.lon);
    url.searchParams.set("timezone","Asia/Seoul");
    if(short){
      url.searchParams.set("current","temperature_2m,weather_code,is_day");
    }else{
      url.searchParams.set("current","temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m");
      url.searchParams.set("hourly","temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index,is_day");
      url.searchParams.set("daily","weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max");
      url.searchParams.set("forecast_days","7");
    }
    return url.href;
  }
  function airUrl(loc) {
    var url=new URL(AIR_BASE);
    url.searchParams.set("latitude",loc.lat);
    url.searchParams.set("longitude",loc.lon);
    url.searchParams.set("current","pm10,pm2_5,us_aqi");
    url.searchParams.set("timezone","Asia/Seoul");
    return url.href;
  }
  async function getJson(url) {
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
    var ticket=++STATE.ticket;
    STATE.loading=true;
    $("updatedBadge").textContent="예보 갱신 중…";
    $("dataFooterStatus").textContent="예보 데이터 갱신 중";
    $("refreshButton").disabled=true;
    var loc=STATE.loc;
    var cache=storeGet("weatherhannun_last");
    if (!force && cache && cache.loc && cache.loc.lat===loc.lat && cache.loc.lon===loc.lon && cache.weather) {
      STATE.weather=cache.weather;STATE.air=cache.air||null;STATE.fetchedAt=cache.at||null;STATE.hourly=makeHours(STATE.weather);STATE.dataStatus="cached";renderAll();
    }
    try {
      var results=await Promise.allSettled([getJson(forecastUrl(loc,false)),getJson(airUrl(loc))]);
      if(ticket!==STATE.ticket)return;
      var weather=results[0].status==="fulfilled"?results[0].value:null;
      var air=results[1].status==="fulfilled"?results[1].value:null;
      if(!weather || !weather.current || !weather.daily || !weather.hourly) throw new Error("날씨 데이터를 불러오지 못했습니다.");
      STATE.weather=weather;
      STATE.air=air;
      STATE.dataStatus="live";
      STATE.fetchedAt=new Date().toISOString();
      STATE.hourly=makeHours(weather);
      storeSet("weatherhannun_last",{loc:loc,at:STATE.fetchedAt,weather:weather,air:air});
      storeSet("weatherhannun_fetch_meta",{at:STATE.fetchedAt,loc:loc.name,modelTime:weather.current.time,airTime:air&&air.current&&air.current.time,forecast:!!weather,air:!!air});
      renderAll();
      if(!air) toast("대기질 API 연결이 불안정합니다. 날씨는 정상 표시됩니다.");
    }catch(e) {
      if(ticket!==STATE.ticket)return;
      STATE.dataStatus=STATE.weather?"cached-error":"error";
      $("updatedBadge").textContent=STATE.weather?"저장된 예보 · 연결 실패":"데이터 연결 오류";
      $("dataFooterStatus").textContent=STATE.weather?"저장된 예보 · 갱신 실패":"예보 연결 실패";
      if(STATE.weather)renderAll();
      toast(e.message+" 네트워크 상태를 확인해 주세요.");
      if(!STATE.weather) $("weatherSummary").textContent="날씨 연결 실패";
    } finally {
      if(ticket===STATE.ticket){STATE.loading=false;$("refreshButton").disabled=false;}
    }
  }
  function text(id,value){$(id).textContent=value;}
  function renderAll() {
    if(!STATE.weather)return;
    var w=STATE.weather,c=w.current,d=w.daily;
    var now=weatherSymbol(c.weather_code,c.is_day);
    text("weatherIcon",now.icon);
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
    var nextRain=STATE.hourly.slice(0,12).find(function(x){return finite(x.rain)&&x.rain>=60;});
    var cold=STATE.hourly.slice(0,36).some(function(x){return finite(x.temp)&&x.temp<=3;});
    var note=nextRain?whenLabel(nextRain.time)+"경 비 올 가능성 "+num(nextRain.rain)+"%":cold?"48시간 이내 저온 구간이 있습니다. 작물 냉해와 결빙에 유의하세요.":"현재 예보에서 가까운 시간의 뚜렷한 강수 위험이 낮습니다.";
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
    window.dispatchEvent(new CustomEvent("weatherhannun:data",{detail:{weather:w,loc:STATE.loc,air:STATE.air,at:STATE.fetchedAt,status:STATE.dataStatus}}));
  }
  function renderHourly(){
    var h=STATE.hourly.slice(0,36),width=Math.max(36*76,h.length*76);
    var values=h.map(function(x){return x.temp;}).filter(finite);
    if(!values.length){$("hourlyChart").textContent="시간별 기온 정보 없음";return;}
    var low=Math.floor(Math.min.apply(null,values)-2),high=Math.ceil(Math.max.apply(null,values)+2);
    if(high===low)high+=1;
    var points=h.map(function(x,i){return (38+i*76)+","+(103-(x.temp-low)/(high-low)*83).toFixed(1);}).join(" ");
    var labels=h.map(function(x,i){return i%3===0?'<text x="'+(38+i*76)+'" y="'+(103-(x.temp-low)/(high-low)*83-11).toFixed(1)+'" fill="#ffdd97" font-size="12" text-anchor="middle">'+safe(num(x.temp))+'°</text>':"";}).join("");
    var dots=h.map(function(x,i){return i%3===0?'<circle cx="'+(38+i*76)+'" cy="'+(103-(x.temp-low)/(high-low)*83).toFixed(1)+'" r="3.4" fill="#ffda86"/>':"";}).join("");
    $("hourlyChart").innerHTML='<svg width="'+width+'" height="124" viewBox="0 0 '+width+' 124" role="img" aria-label="기온 변동 그래프"><defs><linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f7bd66" stop-opacity=".22"/><stop offset="100%" stop-color="#f7bd66" stop-opacity="0"/></linearGradient></defs><polygon points="'+points+' '+(38+(h.length-1)*76)+',121 38,121" fill="url(#lineFill)"/><polyline points="'+points+'" stroke="#ffcf78" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>'+dots+labels+'</svg>';
    $("hourlyItems").innerHTML=h.map(function(x,i){var icon=weatherSymbol(x.code,x.isDay).icon;return '<div class="hour-item '+(i===0?"now":"")+'"><span class="hour-time">'+(i===0?"지금":hourLabel(x.time))+'</span><span class="hour-icon" aria-hidden="true">'+icon+'</span><span class="hour-temp">'+num(x.temp)+'°</span><span class="hour-rain">☂ '+num(x.rain)+'%</span><span class="hour-wind">≋ '+num(x.wind)+' km/h</span></div>';}).join("");
  }
  function weekItem(i){
    var d=STATE.weather.daily,code=d.weather_code?.[i],day=dateLabel(d.time[i]);
    var icon=weatherSymbol(code,1).icon;
    return '<div class="week-item '+(i===0?"today":"")+'"><div class="day">'+safe(i===0?"오늘":day)+'</div><div class="ico" aria-hidden="true">'+icon+'</div><div class="range"><b>'+num(d.temperature_2m_max?.[i])+'°</b> <span>/ '+num(d.temperature_2m_min?.[i])+'°</span></div><div class="rain">☂ '+num(d.precipitation_probability_max?.[i])+'%</div></div>';
  }
  function renderWeek(){
    var d=STATE.weather.daily,len=Math.min(7,d.time.length);
    var markup=Array.from({length:len},function(_,i){return weekItem(i);}).join("");
    $("weekPreview").innerHTML=markup;
    $("weeklyCards").innerHTML=markup;
    var rainy=d.time.filter(function(_,i){return (d.precipitation_probability_max?.[i]||0)>=60;});
    var cold=d.time.filter(function(_,i){return finite(d.temperature_2m_min?.[i])&&d.temperature_2m_min[i]<=3;});
    var drop=Math.max.apply(null,d.temperature_2m_max.filter(finite))-Math.min.apply(null,d.temperature_2m_max.filter(finite));
    $("weeklyInsight").innerHTML='<div>☂ 강수확률 60% 이상인 날: <b>'+rainy.length+'일</b>. 일정은 직전 예보로 재확인하세요.</div><div>🌡 최저기온 3°C 이하 예보: <b>'+cold.length+'일</b>. 작물 냉해 여부는 현장 기온과 함께 확인하세요.</div><div>↕ 낮 최고기온의 주간 변동 폭: <b>'+num(drop)+'°C</b>.</div>';
  }
  function evaluate(activity,h,following){
    var score=100,reasons=[];
    var rain=finite(h.rain)?h.rain:0, mm=finite(h.mm)?h.mm:0, wind=finite(h.wind)?h.wind:0, gust=finite(h.gust)?h.gust:wind, humid=finite(h.humidity)?h.humidity:60, t=finite(h.temp)?h.temp:20, uv=finite(h.uv)?h.uv:0, daytime=h.isDay!==0;
    function penalty(n,label,detail){score-=n;reasons.push({label:label,detail:detail});}
    if(activity==="spray") {
      if(wind>=18)penalty(45,"강한 바람","평균풍속 "+num(wind)+" km/h — 비산 위험을 확인하세요.");
      else if(wind>=10)penalty(18,"바람 주의","평균풍속 "+num(wind)+" km/h — 현장 풍향 확인 필요.");
      if(gust>=25)penalty(28,"돌풍 위험","순간풍속 "+num(gust)+" km/h.");
      if(rain>=40||mm>0.2)penalty(42,"강수 위험","강수확률 "+num(rain)+"%, 예상강수 "+num(mm,1)+"mm.");
      else if(rain>=20)penalty(16,"강수 가능성","비 예보를 다시 확인하세요.");
      if(t>=30)penalty(19,"고온 주의","기온 "+num(t)+"°C — 약해 및 작업자 열스트레스 유의.");
      if(!daytime)penalty(42,"야간 작업","방제는 밝은 시간에 현장 안전과 표시사항을 확인하세요.");
    } else if(activity==="harvest") {
      if(rain>=45||mm>=0.4)penalty(44,"비에 의한 작업 위험","강수확률 "+num(rain)+"%.");
      else if(rain>=20)penalty(13,"약한 강수 가능성","당일 강수 예보를 살펴보세요.");
      if(wind>=30)penalty(23,"강풍 위험","풍속 "+num(wind)+" km/h.");
      if(t>=31)penalty(21,"온열 부담","예상 기온 "+num(t)+"°C.");
      if(humid>=90)penalty(11,"높은 습도","이슬·젖은 작물 여부를 확인하세요.");
      if(!daytime)penalty(14,"야간 안전","야간 농작업은 조명과 안전 장비 필수.");
    } else if(activity==="walk") {
      if(rain>=45||mm>=.4)penalty(40,"비 예보","강수확률 "+num(rain)+"%.");
      else if(rain>=20)penalty(13,"비 가능성","우산을 챙길 수 있습니다.");
      if(wind>=35)penalty(24,"바람 강함","풍속 "+num(wind)+" km/h.");
      if(t<4||t>32)penalty(33,"기온 부담","기온 "+num(t)+"°C.");
      else if(t<9||t>29)penalty(12,"체감 주의","기온 "+num(t)+"°C.");
      if(uv>=7)penalty(23,"자외선 강함","자외선 지수 "+num(uv,1)+" — 자외선 차단 권장.");
    } else if(activity==="laundry") {
      if(rain>=35||mm>=.3)penalty(54,"비 예보","강수확률 "+num(rain)+"%.");
      else if(rain>=15)penalty(22,"강수 가능성","빨래를 실내로 옮길 준비.");
      if(humid>80)penalty(28,"높은 습도","습도 "+num(humid)+"%로 건조에 불리.");
      else if(humid>65)penalty(12,"습도 보통","습도 "+num(humid)+"%.");
      if(!daytime)penalty(17,"햇빛 부족","야간에는 건조가 느릴 수 있습니다.");
      if(wind>=35)penalty(16,"강풍 주의","빨래 고정 필요.");
    } else if(activity==="carwash") {
      var future=Array.isArray(following)?following:[];
      var futureMax=Math.max(rain,...future.map(function(x){return finite(x.rain)?x.rain:0;}));
      if(futureMax>=45||mm>=.4)penalty(58,"세차 후 비 가능성","이후 6시간 최고 강수확률 "+num(futureMax)+"%.");
      else if(futureMax>=20)penalty(24,"강수 변동 위험","이후 6시간 최고 강수확률 "+num(futureMax)+"%.");
      if(wind>=32)penalty(17,"강풍 주의","풍속 "+num(wind)+" km/h.");
      if(t<=1)penalty(38,"결빙 위험","기온 "+num(t)+"°C — 물기 결빙 우려.");
      if(!daytime)penalty(18,"야간 세차","시야와 주변 안전을 위해 가급적 낮 시간을 선택하세요.");
    }
    if(reasons.length===0)reasons.push({label:"주요 기상 위험 낮음",detail:"선택한 활동에 대해 설정된 기상조건의 큰 위험이 없습니다."});
    return {score:clamp(Math.round(score),0,activity==="spray"?85:100),reasons:reasons};
  }
  function activityEvalAt(type,index){
    var h=STATE.hourly[index]||{};
    return evaluate(type,h,STATE.hourly.slice(index+1,index+7));
  }
  function bestActivity(type){
    var top=null;
    for(var i=0;i<Math.min(46,STATE.hourly.length-2);i++){
      var group=[i,i+1,i+2];
      var avg=Math.round(group.reduce(function(s,j){return s+activityEvalAt(type,j).score;},0)/3);
      if(!top||avg>top.score)top={score:avg,start:STATE.hourly[i].time,end:STATE.hourly[i+2].time};
    }
    return top;
  }
  function grade(score){return score>=80?"좋음":score>=60?"무난":score>=40?"주의":"비추천";}
  function scoreClass(score){return score>=80?"":score>=60?"warn":"bad";}
  function renderDecisions(){
    var rank=Object.keys(ACTIVITIES).map(function(k){return {key:k,info:ACTIVITIES[k],data:activityEvalAt(k,0),best:bestActivity(k)};}).sort(function(a,b){return b.data.score-a.data.score;});
    var top=rank.slice(0,3);
    text("decisionLead",top[0]&&top[0].data.score>=60?"오늘은 "+top[0].info.title+"에 비교적 유리한 날씨예요.":"현재 날씨는 활동을 신중하게 선택할 시간이에요.");
    $("quickActivity").innerHTML=top.map(function(x){return '<button type="button" class="quick-item" data-quick-activity="'+x.key+'"><div class="quick-icon">'+x.info.icon+'</div><div class="quick-main"><b>'+x.info.title+'</b><small>'+(x.best?"추천 "+whenLabel(x.best.start):"조건 확인 필요")+'</small></div><span class="quick-badge '+scoreClass(x.data.score)+'">'+grade(x.data.score)+' '+x.data.score+'</span></button>';}).join("");
  }
  function renderActivity(){
    var key=STATE.activity,info=ACTIVITIES[key],now=activityEvalAt(key,0),best=bestActivity(key);
    text("activityTitle",info.icon+" "+info.title);
    text("activityScore",now.score);
    text("activityGrade",grade(now.score));
    $("activityProgress").style.width=now.score+"%";
    text("activityDetail",info.hint+" 현재 조건 평가 "+grade(now.score)+".");
    text("activityBest",best?whenLabel(best.start)+" ~ "+hourLabel(best.end)+" ("+best.score+"점)":"적합 구간 확인 불가");
    $("activityReasons").innerHTML=now.reasons.map(function(r){return '<div class="reason-item"><span class="reason-icon" aria-hidden="true">✦</span><div><b>'+safe(r.label)+'</b><p>'+safe(r.detail)+'</p></div></div>';}).join("");
    $("activityHours").innerHTML=STATE.hourly.slice(0,24).map(function(x,i){var s=activityEvalAt(key,i).score,c=s>=80?"good":s>=50?"mid":"bad";return '<div class="suitability '+c+'"><span>'+safe(i===0?"지금":hourLabel(x.time))+'</span><b>'+s+'</b><span>'+grade(s)+'</span></div>';}).join("");
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
    if(!a){text("airGrade","대기질 제공 지연");text("airStatement","예측값을 가져오지 못했습니다. 새로고침 해보세요.");text("airMetrics","현재 이용할 수 있는 대기질 데이터가 없습니다.");return;}
    var values=[
      {name:"미세먼지 PM10",value:a.pm10,thresholds:[30,80,150]},
      {name:"초미세먼지 PM2.5",value:a.pm2_5,thresholds:[15,35,75]}
    ];
    var statuses=values.map(function(v){return airLevel(v.value,v.thresholds);});
    var worst=statuses.reduce(function(p,c){return c.rank>p.rank?c:p;},statuses[0]);
    var label=$("airGrade");label.className="air-grade "+worst.color;label.textContent=worst.grade;
    text("airStatement",worst.rank<=1?"대기질 예측이 비교적 양호한 편이에요.":"대기질 예측이 좋지 않습니다. 야외활동 전 공식 관측값도 확인하세요.");
    text("airTime","예측 기준 "+a.time.replace("T"," ")+" (KST) · 모델 추정치");
    $("airMetrics").innerHTML=values.map(function(v,i){var st=statuses[i];var percent=clamp((v.value||0)/(v.thresholds[2]*1.5)*100,1,100);return '<div><div class="air-row-head"><b>'+v.name+'</b><span>'+st.grade+' <strong>'+num(v.value,1)+'</strong></span></div><div class="air-bar"><div style="width:'+percent+'%"></div></div></div>';}).join("");
  }
  function setView(view){
    if(!["today","weekly","activity","air","map"].includes(view))return;
    if(view!=="map")setMapFocus(false);
    STATE.view=view;
    document.querySelectorAll(".screen").forEach(function(el){el.classList.toggle("active",el.id==="view-"+view);});
    document.querySelectorAll("[data-view]").forEach(function(el){var a=el.dataset.view===view;el.classList.toggle("active",a);if(el.classList.contains("nav-button"))el.setAttribute("aria-current",a?"page":"false");});
    window.scrollTo({top:0,behavior:"instant"});
    if(view==="map")showMap();
  }
  function setMapFocus(active){
    var shell=$("mapShell");shell.classList.toggle("focus-mode",!!active);
    $("mapFocus").setAttribute("aria-pressed",active?"true":"false");
    $("mapClose").hidden=!active;
    document.body.style.overflow=active?"hidden":"";
    if(STATE.map)setTimeout(function(){STATE.map.invalidateSize();},120);
  }
  function getMapElement() { return $("map"); }
  function initMap(){
    if(STATE.map)return true;
    if(!window.L){getMapElement().innerHTML='<div class="map-fallback">지도를 불러올 수 없습니다. 아래 도시별 카드에서는 날씨를 확인할 수 있습니다.</div>';return false;}
    getMapElement().innerHTML="";
    STATE.map=L.map("map",{zoomControl:true,scrollWheelZoom:false}).setView([36.1,127.8],7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:17,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(STATE.map);
    return true;
  }
  function renderCities(){
    if(!STATE.cityData)return;
    $("cityGrid").innerHTML=STATE.cityData.map(function(x,i){
      var sym=weatherSymbol(x.code,x.isDay);
      return '<button class="city-card" data-city="'+i+'"><div class="city-top"><span class="city-name">'+safe(x.name)+'</span><span aria-hidden="true">'+sym.icon+'</span></div><span class="city-temp">'+num(x.temp)+'°</span><span class="city-desc">'+sym.name+' · 지역 날씨 보기 ↗</span></button>';
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
      var content='<div><span>'+sym.icon+'</span> '+safe(city.name)+' <b>'+num(city.temp)+'°</b></div>';
      var marker=L.marker([city.lat,city.lon],{icon:L.divIcon({className:"weather-map-pin",html:content,iconSize:[105,43],iconAnchor:[53,42]})}).addTo(STATE.map);
      marker.bindPopup('<b>'+safe(city.name)+'</b><p>'+sym.name+' · '+num(city.temp)+'°</p><button class="map-open-city">이 지역 예보 보기 →</button>');
      marker.on("click",function(){if(window.innerWidth<710)setMapFocus(true);});
      marker.on("popupopen",function(){
        var pop=marker.getPopup().getElement(),b=pop&&pop.querySelector(".map-open-city");
        if(b)b.addEventListener("click",function(){chooseCity(i);},{once:true});
      });
      STATE.markers.push(marker);
    });
    STATE.map.invalidateSize();
  }
  async function showMap(){
    initMap();
    if(STATE.cityData){renderCities();updateMapMarkers();return;}
    if(STATE.mapBusy)return;
    STATE.mapBusy=true;
    text("mapUpdated","주요 도시 예보 조회 중");
    $("cityGrid").innerHTML='<div class="empty-state">전국 주요 도시의 현재 날씨를 가져오고 있습니다…</div>';
    var results=await Promise.allSettled(CITY_LIST.map(function(city){return getJson(forecastUrl(city,true));}));
    STATE.cityData=CITY_LIST.map(function(city,i){
      var v=results[i].status==="fulfilled"?results[i].value.current:null;
      return {name:city.name,lat:city.lat,lon:city.lon,temp:v?.temperature_2m,code:v?.weather_code,isDay:v?.is_day};
    });
    STATE.mapBusy=false;
    text("mapUpdated","도시별 모델 예보 · "+new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Seoul"})+" 갱신");
    renderCities();updateMapMarkers();
  }
  function searchDialogOpen(){
    $("locationDialog").showModal();
    $("locationSearch").focus();
  }
  function renderPresets(){
    $("presetCities").innerHTML=CITY_LIST.map(function(c,i){return '<button data-preset="'+i+'">'+safe(c.name)+'</button>';}).join("");
    document.querySelectorAll("[data-preset]").forEach(function(btn){btn.addEventListener("click",function(){var c=CITY_LIST[Number(btn.dataset.preset)];$("locationDialog").close();applyLocation(c,true);});});
  }
  async function searchCities(){
    var q=$("locationSearch").value.trim();
    if(q.length<2){text("searchResults","두 글자 이상 입력하세요.");return;}
    text("searchResults","지역 검색 중…");
    try{
      var url=new URL(SEARCH_BASE);url.searchParams.set("name",q);url.searchParams.set("count",20);url.searchParams.set("language","ko");url.searchParams.set("format","json");
      var d=await getJson(url.href);
      var results=(d.results||[]).filter(function(x){return x.country_code==="KR" && finite(x.latitude)&&finite(x.longitude);}).slice(0,10);
      if(!results.length){text("searchResults","한국 내 검색 결과가 없습니다. 영문 지명으로도 검색해 보세요.");return;}
      $("searchResults").innerHTML=results.map(function(x,i){return '<button data-search="'+i+'"><b>'+safe(x.name)+'</b> <small>'+safe(x.admin1||"대한민국")+' '+safe(x.admin2||"")+'</small></button>';}).join("");
      document.querySelectorAll("[data-search]").forEach(function(btn){btn.addEventListener("click",function(){
        var c=results[Number(btn.dataset.search)];
        $("locationDialog").close();applyLocation({name:c.name,lat:c.latitude,lon:c.longitude},true);
      });});
    }catch(e){text("searchResults","지역 검색에 실패했습니다. 잠시 후 다시 시도하세요.");}
  }
  function getGeo(){
    if(!navigator.geolocation){toast("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");return;}
    toast("현재 위치 사용 권한을 요청합니다.");
    navigator.geolocation.getCurrentPosition(function(pos){
      var la=pos.coords.latitude,lo=pos.coords.longitude;
      if(!finite(la)||!finite(lo))return;
      $("locationDialog").close();
      applyLocation({name:"현재 위치",lat:Number(la.toFixed(3)),lon:Number(lo.toFixed(3))},true);
    },function(err){toast(err.code===1?"위치 권한이 거부되었습니다. 지역 검색을 이용해 주세요.":"위치를 확인하지 못했습니다. 지역을 직접 선택해 주세요.");},{enableHighAccuracy:false,timeout:10000,maximumAge:180000});
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
    if(p.has("lat")&&p.has("lon"))l={name:p.get("name")||"선택 지역",lat:Number(p.get("lat")),lon:Number(p.get("lon"))};
    if(!validLocation(l))l=storeGet("weatherhannun_location");
    if(!validLocation(l))l=CITY_LIST[0];
    var remembered=storeGet("weatherhannun_activity_v1");
    if(typeof remembered==="string"&&ACTIVITIES[remembered])STATE.activity=remembered;
    document.querySelectorAll("[data-activity]").forEach(function(b){b.classList.toggle("active",b.dataset.activity===STATE.activity);});
    window.addEventListener("weatherhannun:change-location",function(ev){if(validLocation(ev.detail))applyLocation(ev.detail,true);});
    document.querySelectorAll("[data-view]").forEach(function(btn){btn.addEventListener("click",function(){setView(btn.dataset.view);});});
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
    $("locationButton").addEventListener("click",searchDialogOpen);
    $("dialogClose").addEventListener("click",function(){$("locationDialog").close();});
    $("searchForm").addEventListener("submit",function(e){e.preventDefault();searchCities();});
    $("locationSearch").addEventListener("input",function(){clearTimeout(searchTimer);searchTimer=setTimeout(searchCities,450);});
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
    if("serviceWorker" in navigator && location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(function(){});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();