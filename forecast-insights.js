"use strict";
/* Seven-day weather windows, farm guidance and opt-in foreground alerts.
 * This layer only consumes already fetched forecast output. It does not claim
 * real-time observation, certified field conditions or official warnings.
 */
(function () {
  const el = id => document.getElementById(id);
  const safe = input => String(input ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const number = (value,digits=0) => finite(value)?value.toFixed(digits):"—";
  const within = (value,low,high) => Math.max(low,Math.min(high,value));
  const prettyDate = date => date?date.slice(5,7)+"월 "+date.slice(8,10)+"일":"—";
  const prettyTime = date => date?prettyDate(date.slice(0,10))+" "+date.slice(11,16):"—";
  const formatHour = date => date?date.slice(11,13)+"시":"—";
  const TRACK_KEY="weatherhannun_alert_v1";
  const rules=window.WeatherAlertRules;
  let data=null;
  let period="48";
  let rangeStart="";
  let rangeEnd="";
  let prefs=rules?rules.defaults():{rain:false,frost:false,wind:false};
  let latestLocation=null;
  let notifyEnabled=false;
  try {
    const saved=JSON.parse(localStorage.getItem(TRACK_KEY)||"null");
    if(rules)prefs=rules.normalizePreferences(saved);
    else if(saved&&typeof saved==="object")prefs={rain:!!saved.rain,frost:!!saved.frost,wind:!!saved.wind};
  }catch(_){}
  function rows(){
    if(!data?.weather?.hourly?.time)return [];
    const w=data.weather;
    const h=w.hourly;
    const current=w.current?.time?.slice(0,13)||"";
    let start=h.time.findIndex(x=>x.slice(0,13)>=current);
    if(start<0)start=0;
    return h.time.slice(start,start+168).map((time,i)=>{
      const k=start+i;
      return {time,date:time.slice(0,10),temp:h.temperature_2m?.[k],rain:h.precipitation_probability?.[k],mm:h.precipitation?.[k],wind:h.wind_speed_10m?.[k],gust:h.wind_gusts_10m?.[k],humidity:h.relative_humidity_2m?.[k],code:h.weather_code?.[k],isDay:h.is_day?.[k]};
    });
  }
  function getRange(all){
    if(period==="custom"){
      return all.filter(h=>h.date>=rangeStart&&h.date<=rangeEnd);
    }
    return all.slice(0,Number(period));
  }
  function sky(code,isDay){return window.WeatherIcons?window.WeatherIcons.markup(code,isDay,"weather-glyph--insight"):'<span class="weather-glyph-fallback" aria-hidden="true">?</span>';}
  function weatherName(code){
    if(code===0)return "맑음";
    if(code===1||code===2)return "대체로 맑음";
    if(code===3)return "흐림";
    if(code===45||code===48)return "안개";
    if((code>=51&&code<=67)||(code>=80&&code<=82))return "비";
    if((code>=71&&code<=77)||code===85||code===86)return "눈";
    if(code>=95&&code<=99)return "뇌우";
    return "날씨 확인";
  }
  function isWet(row){return (finite(row.rain)&&row.rain>=50)||(finite(row.mm)&&row.mm>=.3);}
  function isClear(row){return row.isDay===1&&finite(row.code)&&row.code<=2&&row.code>=0&&finite(row.rain)&&row.rain<=20&&finite(row.mm)&&row.mm<.1;}
  function spans(all,predicate){
    const out=[];let active=null;
    all.forEach((row,i)=>{
      if(predicate(row)){
        if(!active){active={start:row.time,end:row.time,count:1,begin:i,prob:finite(row.rain)?row.rain:null,total:finite(row.mm)?row.mm:null};out.push(active);}
        else{
          active.end=row.time;active.count++;
          if(finite(row.rain))active.prob=finite(active.prob)?Math.max(active.prob,row.rain):row.rain;
          active.total=finite(active.total)&&finite(row.mm)?active.total+row.mm:null;
        }
      }else active=null;
    });
    return out;
  }
  function getCurrentWindow(){return getRange(rows());}
  function updateButtons(){
    document.querySelectorAll("[data-rain-period]").forEach(button=>{
      const current=button.dataset.rainPeriod===period;
      button.classList.toggle("active",current);
      button.setAttribute("aria-pressed",String(current));
    });
  }
  function rainSummary(){
    const hours=getCurrentWindow();
    const result=el("windowResults");
    const caption=el("windowCaption");
    const segments=el("rainEvents");
    const skyline=el("sunEvents");
    const dayGrid=el("forecastDayGrid");
    if(!result||!data||!hours.length){
      if(result)result.textContent="선택 범위에 예보가 없습니다. 날짜를 다시 선택해 주세요.";
      if(segments)segments.replaceChildren();
      if(skyline)skyline.replaceChildren();
      if(dayGrid)dayGrid.replaceChildren();
      return;
    }
    const wet=spans(hours,isWet);
    const clear=spans(hours,isClear).filter(s=>s.count>=2);
    const rainComplete=hours.every(h=>finite(h.rain)&&finite(h.mm));
    const clearComplete=hours.every(h=>(h.isDay===0||h.isDay===1)&&finite(h.code)&&finite(h.rain)&&finite(h.mm));
    const probabilities=hours.map(h=>h.rain).filter(finite);
    const maxProb=probabilities.length?Math.max(...probabilities):null;
    const estimated=hours.every(h=>finite(h.mm))?hours.reduce((sum,h)=>sum+h.mm,0):null;
    const p=hours[0].date===hours[hours.length-1].date?prettyDate(hours[0].date):prettyDate(hours[0].date)+" ~ "+prettyDate(hours[hours.length-1].date);
    caption.textContent=p+" · "+hours.length+"시간 예보 · 현 시점 모델 기준";
    if(wet.length){
      const wetStart=hours.find(h=>h.time===wet[0].start)||hours[0];
      result.innerHTML='<span class="insight-icon" aria-hidden="true">'+sky(wetStart.code,wetStart.isDay)+'</span><div><span class="insight-small">비 가능성이 높은 첫 시간대</span><strong>'+safe(prettyTime(wet[0].start))+' ~ '+safe(formatHour(wet[0].end))+'</strong><small>강수확률 최고 '+number(wet[0].prob)+'% · 예보된 시간별 강수량 합계 '+number(wet[0].total,1)+'mm</small></div>';
    }else if(rainComplete){
      result.innerHTML='<span class="insight-icon" aria-hidden="true">'+sky(hours[0].code,hours[0].isDay)+'</span><div><span class="insight-small">선택한 기간</span><strong>강수 가능성 높은 구간 없음</strong><small>최고 강수확률 '+number(maxProb)+'% · 예상 강수량 합계 '+number(estimated,1)+'mm · 비가 절대 오지 않는다는 뜻은 아닙니다</small></div>';
    }else{
      result.innerHTML='<span class="insight-icon" aria-hidden="true">'+sky(hours[0].code,hours[0].isDay)+'</span><div><span class="insight-small">선택한 기간</span><strong>강수 자료 일부 누락</strong><small>없는 값을 0으로 채우지 않습니다. 시간별 수치와 최신 예보를 다시 확인해 주세요.</small></div>';
    }
    function renderSegments(target,list,empty,style){
      target.innerHTML=list.length?list.slice(0,5).map((s,i)=>'<div class="forecast-span '+style+'"><div><b>'+safe(prettyTime(s.start))+' ~ '+safe(formatHour(s.end))+'</b><small>'+s.count+'시간 연속</small></div><strong>'+(style==="wet"?"최대 "+number(s.prob)+"%":"맑을 가능성")+'</strong></div>').join("")+(list.length>5?'<small class="muted-text">그 외 '+(list.length-5)+'개 구간이 더 있습니다.</small>':""):'<p class="muted-text">'+empty+'</p>';
    }
    renderSegments(segments,wet,rainComplete?"50% 이상 강수확률 또는 0.3mm 이상 강수 예보 구간이 없습니다.":"강수 자료 일부가 없어 신호 없음으로 판단하지 않습니다.","wet");
    renderSegments(skyline,clear,clearComplete?"주간에 2시간 이상 연속으로 맑음·구름 조금인 구간이 없습니다.":"하늘·강수 자료 일부가 없어 맑은 구간 없음으로 판단하지 않습니다.","clear");
    const grouped=new Map();
    hours.forEach(x=>{if(!grouped.has(x.date))grouped.set(x.date,[]);grouped.get(x.date).push(x);});
    dayGrid.innerHTML=Array.from(grouped.entries()).map(([date,rs])=>{
      const wetHours=rs.filter(isWet).length;
      const clearHours=rs.filter(isClear).length;
      const rainValues=rs.map(r=>r.rain).filter(finite);
      const pr=rainValues.length?Math.max(...rainValues):null;
      const total=rs.every(r=>finite(r.mm))?rs.reduce((sum,r)=>sum+r.mm,0):null;
      const complete=rs.every(r=>finite(r.rain)&&finite(r.mm));
      const pct=Math.round((wetHours/rs.length)*100);
      const bright=Math.round((clearHours/rs.length)*100);
      const title="모델 예보상 확인된 비 신호 "+wetHours+"시간, 확인된 맑은 낮 시간 "+clearHours+"시간"+(complete?"":" · 일부 자료 누락");
      return '<div class="forecast-day" title="'+safe(title)+'"><b>'+safe(prettyDate(date))+'</b><div class="forecast-day-bar"><span class="rain-share" style="width:'+pct+'%"></span><span class="sun-share" style="width:'+bright+'%"></span></div><span>☂ 최대 '+number(pr)+'% · '+number(total,1)+'mm</span><small>'+(complete?'비 신호 '+wetHours+'h · 낮 맑음 '+clearHours+'h':'확인값 기준 · 일부 자료 누락')+'</small></div>';
    }).join("");
  }
  function farm(){
    if(!data)return;
    const hours=rows().slice(0,48);
    if(!hours.length)return;
    const nights=hours.filter(h=>h.isDay===0&&finite(h.temp));
    const minNight=nights.length?Math.min(...nights.map(h=>h.temp)):null;
    const likelyCold=hours.filter(h=>finite(h.temp)&&h.temp<=3);
    const strongWind=hours.filter(h=>finite(h.gust)&&h.gust>=35);
    const hardRain=hours.filter(isWet);
    const temperatureComplete=hours.length===48&&hours.every(h=>finite(h.temp));
    const gustComplete=hours.length===48&&hours.every(h=>finite(h.gust));
    const rainComplete=hours.length===48&&hours.every(h=>finite(h.rain)&&finite(h.mm));
    const nightComplete=hours.some(h=>h.isDay===0)&&hours.every(h=>(h.isDay===0||h.isDay===1)&&(h.isDay!==0||finite(h.temp)));
    const rain48=hours.every(h=>finite(h.mm))?hours.reduce((a,h)=>a+h.mm,0):null;
    const nextRain=hardRain[0];
    const nextGust=strongWind[0];
    const firstCold=likelyCold[0];
    const frostLevel=firstCold&&firstCold.temp<=0?"high":firstCold?"mid":temperatureComplete?"good":"mid";
    const frostTitle=firstCold?(firstCold.temp<=0?"영하 기온 예보":"저온 가능성 주의"):temperatureComplete?"뚜렷한 저온 신호 없음":"기온 자료 일부 누락";
    const messages=[
      {icon:"❄️",title:"서리·냉해 주의",cls:frostLevel,value:frostTitle,detail:firstCold?prettyTime(firstCold.time)+" · 예보 기온 "+number(firstCold.temp)+"°C. 실제 서리 발생은 지표면·지형·바람에 따라 다릅니다.":temperatureComplete?"48시간 내 예보 기온 3°C 이하 시점 없음. 지표면 서리는 별도 확인.":"기온 자료가 완전하지 않아 저온 신호 없음으로 판단하지 않습니다."},
      {icon:"🌬️",title:"강풍·비산 주의",cls:nextGust?"mid":gustComplete?"good":"mid",value:nextGust?"돌풍 예보 확인":gustComplete?"뚜렷한 돌풍 위험 낮음":"돌풍 자료 일부 누락",detail:nextGust?prettyTime(nextGust.time)+" · 돌풍 "+number(nextGust.gust)+" km/h. 약제 비산과 시설물 점검.":gustComplete?"48시간 내 돌풍 35km/h 이상 예보 없음. 현장 풍향·풍속은 별도로 확인.":"돌풍 자료가 완전하지 않아 위험 없음으로 판단하지 않습니다."},
      {icon:"☂️",title:"강수·관수 참고",cls:nextRain?"mid":rainComplete?"good":"mid",value:finite(rain48)?"향후 48시간 "+number(rain48,1)+"mm":"강수량 합계 자료 부족",detail:nextRain?"강수 가능성 높은 첫 시각 "+prettyTime(nextRain.time)+". 관수량은 토양·작물 상태로 판단하세요.":rainComplete?"뚜렷한 비 신호가 없어도 토양수분과 관수시설 상태 확인 필요.":"강수 자료가 완전하지 않아 비 없음으로 판단하지 않습니다. 토양수분은 별도 확인하세요."},
      {icon:"🌡️",title:"야간 저온",cls:finite(minNight)&&minNight<=3?"mid":nightComplete?"good":"mid",value:finite(minNight)?number(minNight)+"°C":"정보 없음",detail:nightComplete?"향후 48시간 야간 최저 예보. 현장 지표면은 예보 기온과 다를 수 있습니다.":"야간 기온 자료가 부족해 최저값을 만들지 않습니다."}
    ];
    const target=el("farmSignals");
    if(target)target.innerHTML=messages.map(m=>'<article class="farm-signal '+m.cls+'"><span class="farm-icon" aria-hidden="true">'+m.icon+'</span><div><span class="farm-name">'+m.title+'</span><strong>'+safe(m.value)+'</strong><p>'+safe(m.detail)+'</p></div></article>').join("");
    const next=el("farmSummary");
    if(next)next.textContent=firstCold||nextGust||nextRain?"향후 48시간에 확인할 위험 신호가 있습니다. 작물·시설과 작업 시점을 점검해 주세요.":temperatureComplete&&gustComplete&&rainComplete?"향후 48시간의 저온·돌풍·강수를 고려해 작업 시점을 정하세요.":"일부 예보 자료가 없어 위험 없음으로 판단하지 않습니다. 최신 시간별 예보를 확인하세요.";
  }
  function noticeCopy(alert){
    const row=alert.row||{};
    if(alert.id==="rain")return {title:"강수 가능성 높음",body:prettyTime(alert.time)+" · "+(finite(row.rain)?"강수확률 "+number(row.rain)+"%":"시간당 강수량 "+number(row.mm,1)+"mm")};
    if(alert.id==="dry")return {title:"비 가능성 낮음",body:"향후 6시간 최고 강수확률 "+number(alert.maxRain)+"% · 예보상 비 가능성이 낮아요"};
    if(alert.id==="clear")return {title:"맑은 시간 이어짐",body:prettyTime(alert.time)+"부터 맑음·구름 조금 조건이 "+alert.hours+"시간 이상 이어져요"};
    if(alert.id==="frost")return {title:"저온·서리 가능성 확인",body:prettyTime(alert.time)+" · 기온 "+number(row.temp)+"°C"};
    return {title:"돌풍 위험 확인",body:prettyTime(alert.time)+" · 돌풍 "+number(row.gust)+"km/h"};
  }
  function pickNotices(){
    if(!rules)return [];
    return rules.pick(rows(),prefs).map(alert=>Object.assign(alert,noticeCopy(alert)));
  }
  function nativeBridge(){
    return window.WeatherHannunAndroid&&typeof window.WeatherHannunAndroid.saveAlertConfiguration==="function"?window.WeatherHannunAndroid:null;
  }
  function nativePermission(){
    try{return nativeBridge()?.notificationPermissionState?.()||"unknown";}catch(_){return "unknown";}
  }
  function syncWithAndroid(){
    const bridge=nativeBridge();
    if(!bridge||!latestLocation||!finite(Number(latestLocation.lat))||!finite(Number(latestLocation.lon)))return false;
    const payload={version:2,configured:!!prefs.configured,location:{name:String(latestLocation.name||"선택 지역").slice(0,75),lat:Number(latestLocation.lat),lon:Number(latestLocation.lon)},rules:{rain:!!prefs.rain,rainThreshold:prefs.rainThreshold,dry:!!prefs.dry,dryThreshold:prefs.dryThreshold,clear:!!prefs.clear,clearHours:prefs.clearHours,frost:!!prefs.frost,wind:!!prefs.wind},schedules:{morning:!!prefs.morning,morningTime:prefs.morningTime,evening:!!prefs.evening,eveningTime:prefs.eveningTime},quietHours:{enabled:!!prefs.quiet,start:prefs.quietStart,end:prefs.quietEnd}};
    try{bridge.saveAlertConfiguration(JSON.stringify(payload));return true;}catch(_){return false;}
  }
  function renderAlerts(){
    renderNotificationPreview();
    const root=el("alertList");if(!root||!data)return;
    const notices=pickNotices();
    root.innerHTML=notices.length?notices.map(a=>'<div class="notice-result"><b>'+safe(a.title)+'</b><span>'+safe(a.body)+'</span></div>').join(""):'<p class="muted-text">설정한 기준에서 가까운 경보 조건이 없거나 조건을 선택하지 않았습니다.</p>';
    if(el("foregroundNotice")){
      if(nativeBridge())el("foregroundNotice").textContent="Android 앱이 약 15분 주기로 확인합니다. 절전 상태에서는 알림이 늦어질 수 있습니다.";
      else el("foregroundNotice").textContent=("Notification" in window&&Notification.permission==="granted")?"브라우저 알림 사용 허용됨 · 앱 열림 상태에서만 점검":"웹에서는 앱이 열린 상태에서만 조건을 확인합니다.";
    }
  }
  function currentControl(id,fallback){const control=el(id);return control?control.value||fallback:fallback;}
  function checkedControl(id,fallback){const control=el(id);return control?control.checked:fallback;}
  function renderNotificationPreview(){
    const title=el("notificationPreviewTitle"),body=el("notificationPreviewBody"),schedule=el("notificationPreviewSchedule"),icon=el("notificationPreviewWeatherIcon");
    if(!title||!body||!schedule)return;
    const current=data?.weather?.current||{};
    const allRows=rows();
    const code=finite(current.weather_code)?current.weather_code:allRows[0]?.code;
    const isDay=finite(current.is_day)?current.is_day:allRows[0]?.isDay;
    const temp=finite(current.temperature_2m)?current.temperature_2m:allRows[0]?.temp;
    const feels=current.apparent_temperature;
    const daily=data?.weather?.daily||{};
    const high=Array.isArray(daily.temperature_2m_max)?daily.temperature_2m_max[0]:null;
    const low=Array.isArray(daily.temperature_2m_min)?daily.temperature_2m_min[0]:null;
    const next=allRows.slice(0,12);
    const threshold=Number(currentControl("rainThreshold",prefs.rainThreshold||50));
    const firstRain=next.find(row=>(finite(row.rain)&&row.rain>=threshold)||(finite(row.mm)&&row.mm>=1));
    const rainProbabilities=next.map(row=>row.rain).filter(finite);
    const maxRain=rainProbabilities.length?Math.max(...rainProbabilities):null;
    const completeRainEvidence=next.length===12&&next.every(row=>finite(row.rain)&&finite(row.mm));
    const location=String(latestLocation?.name||data?.loc?.name||"선택 지역");
    title.textContent=finite(temp)?location+" · "+number(temp)+"° · "+weatherName(code):location+" · 날씨 요약";
    const summary=[];
    if(finite(feels))summary.push("체감 "+number(feels)+"°");
    if(finite(high)||finite(low))summary.push("최고 "+number(high)+"° / 최저 "+number(low)+"°");
    if(firstRain)summary.push(formatHour(firstRain.time)+"부터 비 "+(finite(firstRain.rain)?number(firstRain.rain)+"%":number(firstRain.mm,1)+"mm/h")+" · 우산 챙겨요");
    else if(completeRainEvidence)summary.push("12시간 비 최고 "+number(maxRain)+"% · 우산은 지금 불필요");
    else if(next.length)summary.push("12시간 강수 자료 일부 누락 · 시간별 예보 확인");
    body.textContent=summary.join(" · ")||"체감·최고/최저·강수 시각과 우산 판단을 요약합니다.";
    const schedules=[];
    if(checkedControl("morningSummary",prefs.morning))schedules.push("오늘 준비 "+currentControl("morningTime",prefs.morningTime||"07:00"));
    if(checkedControl("eveningSummary",prefs.evening))schedules.push("내일 계획 "+currentControl("eveningTime",prefs.eveningTime||"19:00"));
    if(checkedControl("quietHours",prefs.quiet))schedules.push("방해금지 "+currentControl("quietStart",prefs.quietStart||"22:00")+"–"+currentControl("quietEnd",prefs.quietEnd||"06:00"));
    schedule.textContent=schedules.join(" · ")||"정기 요약 꺼짐 · 선택한 조건 변화만 알림";
    if(icon)icon.innerHTML=sky(code,isDay);
  }
  function saveAlertPreferences(){
    prefs=rules.normalizePreferences({version:2,configured:true,rain:el("watchRain").checked,rainThreshold:Number(el("rainThreshold").value),dry:el("watchDry").checked,dryThreshold:Number(el("dryThreshold").value),clear:el("watchClear").checked,clearHours:Number(el("clearHours").value),frost:el("watchFrost").checked,wind:el("watchWind").checked,morning:el("morningSummary").checked,morningTime:el("morningTime").value,evening:el("eveningSummary").checked,eveningTime:el("eveningTime").value,quiet:el("quietHours").checked,quietStart:el("quietStart").value,quietEnd:el("quietEnd").value});
    try{localStorage.setItem(TRACK_KEY,JSON.stringify(prefs));}catch(_){}
    renderAlerts();
    const synced=syncWithAndroid();
    const save=el("savedAlertStatus");if(save)save.textContent=synced?"조건을 Android 앱에 저장했습니다. 약 15분 주기로 확인합니다.":"조건을 이 브라우저에 저장했습니다. 웹에서는 앱을 열 때 확인합니다.";
    notifyIfAllowed();
  }
  function notifyIfAllowed(){
    if(nativeBridge()||!data||!("Notification" in window)||Notification.permission!=="granted"||document.visibilityState!=="visible")return;
    const hours=rows(),now=hours[0]?.time||"";
    const soon=pickNotices().filter(x=>x.time.slice(0,13)<=hours[Math.min(hours.length-1,3)]?.time?.slice(0,13));
    soon.forEach(a=>{
      const key="weatherhannun_shown_"+a.id;
      const signature=a.time.slice(0,13);
      try {
        if(sessionStorage.getItem(key)===signature)return;
        new Notification("날씨한눈 · "+a.title,{body:a.body,icon:"./icon.svg",tag:"weatherhannun-"+a.id});
        sessionStorage.setItem(key,signature);
      }catch(_){}
    });
  }
  function bind(){
    document.querySelectorAll("[data-rain-period]").forEach(button=>button.addEventListener("click",()=>{
      period=button.dataset.rainPeriod;
      const picker=document.querySelector(".hourly-date-picker");
      if(picker)picker.open=period==="custom";
      updateButtons();rainSummary();
    }));
    const start=el("rainDateStart"),end=el("rainDateEnd"),apply=el("applyRainDates");
    if(apply)apply.addEventListener("click",()=>{
      if(!start.value||!end.value||start.value>end.value){el("windowCaption").textContent="시작일은 종료일 이전이어야 합니다.";return;}
      rangeStart=start.value;rangeEnd=end.value;period="custom";updateButtons();rainSummary();
    });
    const save=el("saveWatch");if(save)save.addEventListener("click",saveAlertPreferences);
    const allow=el("allowNotify");if(allow)allow.addEventListener("click",async()=>{
      const bridge=nativeBridge();
      if(bridge){
        try{bridge.requestNotificationPermission();el("savedAlertStatus").textContent=nativePermission()==="granted"?"Android 알림이 허용되어 있습니다.":"Android 알림 권한 요청을 표시했습니다.";}catch(_){el("savedAlertStatus").textContent="Android 알림 권한을 요청하지 못했습니다.";}
        return;
      }
      if(!("Notification" in window)){el("savedAlertStatus").textContent="이 브라우저는 알림 API를 지원하지 않습니다.";return;}
      try{
        const permission=await Notification.requestPermission();
        el("savedAlertStatus").textContent=permission==="granted"?"브라우저 알림 권한을 허용했습니다. 앱이 열려 있을 때만 알림을 확인합니다.":"알림 권한이 허용되지 않았습니다.";
      }catch(e){el("savedAlertStatus").textContent="브라우저 알림 권한을 확인할 수 없습니다.";}
      renderAlerts();notifyIfAllowed();
    });
    [["watchRain","rain"],["watchDry","dry"],["watchClear","clear"],["watchFrost","frost"],["watchWind","wind"],["morningSummary","morning"],["eveningSummary","evening"],["quietHours","quiet"]].forEach(([id,key])=>{if(el(id))el(id).checked=!!prefs[key];});
    [["rainThreshold","rainThreshold"],["dryThreshold","dryThreshold"],["clearHours","clearHours"],["morningTime","morningTime"],["eveningTime","eveningTime"],["quietStart","quietStart"],["quietEnd","quietEnd"]].forEach(([id,key])=>{if(el(id))el(id).value=String(prefs[key]);});
    ["watchRain","watchDry","watchClear","watchFrost","watchWind","rainThreshold","dryThreshold","clearHours","morningSummary","morningTime","eveningSummary","eveningTime","quietHours","quietStart","quietEnd"].forEach(id=>{const control=el(id);if(control){control.addEventListener("change",renderNotificationPreview);control.addEventListener("input",renderNotificationPreview);}});
    if(nativeBridge()){allow.textContent="Android 알림 권한 허용";renderAlerts();}
    updateButtons();
    renderNotificationPreview();
  }
  window.addEventListener("weatherhannun:data",function(event){
    data=event.detail;
    latestLocation=event.detail?.loc||latestLocation;
    const hours=rows();
    const start=el("rainDateStart"),end=el("rainDateEnd");
    if(!hours.length)return;
    if(start){start.min=hours[0].date;start.max=hours[hours.length-1].date;if(!start.value||start.value<start.min||start.value>start.max)start.value=hours[0].date;}
    if(end){end.min=hours[0].date;end.max=hours[hours.length-1].date;if(!end.value||end.value<end.min||end.value>end.max)end.value=hours[Math.min(47,hours.length-1)].date;}
    rangeStart=start?.value||hours[0].date;rangeEnd=end?.value||hours[hours.length-1].date;
    rainSummary();farm();renderAlerts();syncWithAndroid();notifyIfAllowed();
  });
  window.WeatherHannunAlerts={syncWithAndroid,onAndroidPermissionChanged(granted){const save=el("savedAlertStatus");if(save)save.textContent=granted?"Android 알림 권한을 허용했습니다.":"알림 권한이 허용되지 않았습니다. Android 설정에서 다시 허용할 수 있습니다.";renderAlerts();}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();
