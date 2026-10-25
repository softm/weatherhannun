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
  let data=null;
  let period="48";
  let rangeStart="";
  let rangeEnd="";
  let prefs={rain:false,frost:false,wind:false};
  let notifyEnabled=false;
  try {
    const saved=JSON.parse(localStorage.getItem(TRACK_KEY)||"null");
    if(saved&&typeof saved==="object")prefs={rain:!!saved.rain,frost:!!saved.frost,wind:!!saved.wind};
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
  function sky(code){if(code===0)return "☀️";if(code===1)return "🌤️";if(code===2)return "⛅";if(code===3)return "☁️";if(code>=61&&code<=82)return "🌧️";if(code>=95)return "⛈️";if(code>=71&&code<=86)return "🌨️";return "🌤️";}
  function isWet(row){return (finite(row.rain)&&row.rain>=50)||(finite(row.mm)&&row.mm>=.3);}
  function isClear(row){return row.isDay===1&&row.code<=2&&row.code>=0&&(row.rain??100)<=20&&(row.mm??100)<.1;}
  function spans(all,predicate){
    const out=[];let active=null;
    all.forEach((row,i)=>{
      if(predicate(row)){
        if(!active){active={start:row.time,end:row.time,count:1,begin:i,prob:row.rain??null,total:finite(row.mm)?row.mm:0};out.push(active);}
        else{active.end=row.time;active.count++;active.prob=Math.max(active.prob??0,row.rain??0);active.total+=finite(row.mm)?row.mm:0;}
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
    const maxProb=Math.max(0,...hours.map(h=>finite(h.rain)?h.rain:0));
    const estimated=hours.reduce((sum,h)=>sum+(finite(h.mm)?h.mm:0),0);
    const p=hours[0].date===hours[hours.length-1].date?prettyDate(hours[0].date):prettyDate(hours[0].date)+" ~ "+prettyDate(hours[hours.length-1].date);
    caption.textContent=p+" · "+hours.length+"시간 예보 · 현 시점 모델 기준";
    if(wet.length){
      result.innerHTML='<span class="insight-icon">☂</span><div><span class="insight-small">비 가능성이 높은 첫 시간대</span><strong>'+safe(prettyTime(wet[0].start))+' ~ '+safe(formatHour(wet[0].end))+'</strong><small>강수확률 최고 '+number(wet[0].prob)+'% · 예보된 시간별 강수량 합계 '+number(wet[0].total,1)+'mm</small></div>';
    }else{
      result.innerHTML='<span class="insight-icon">🌤️</span><div><span class="insight-small">선택한 기간</span><strong>강수 가능성 높은 구간 없음</strong><small>최고 강수확률 '+number(maxProb)+'% · 예상 강수량 합계 '+number(estimated,1)+'mm · 비가 절대 오지 않는다는 뜻은 아닙니다</small></div>';
    }
    function renderSegments(target,list,empty,style){
      target.innerHTML=list.length?list.slice(0,5).map((s,i)=>'<div class="forecast-span '+style+'"><div><b>'+safe(prettyTime(s.start))+' ~ '+safe(formatHour(s.end))+'</b><small>'+s.count+'시간 연속</small></div><strong>'+(style==="wet"?"최대 "+number(s.prob)+"%":"맑을 가능성")+'</strong></div>').join("")+(list.length>5?'<small class="muted-text">그 외 '+(list.length-5)+'개 구간이 더 있습니다.</small>':""):'<p class="muted-text">'+empty+'</p>';
    }
    renderSegments(segments,wet,"50% 이상 강수확률 또는 0.3mm 이상 강수 예보 구간이 없습니다.","wet");
    renderSegments(skyline,clear,"주간에 2시간 이상 연속으로 맑음·구름 조금인 구간이 없습니다.","clear");
    const grouped=new Map();
    hours.forEach(x=>{if(!grouped.has(x.date))grouped.set(x.date,[]);grouped.get(x.date).push(x);});
    dayGrid.innerHTML=Array.from(grouped.entries()).map(([date,rs])=>{
      const wetHours=rs.filter(isWet).length;
      const clearHours=rs.filter(isClear).length;
      const pr=Math.max(0,...rs.map(r=>r.rain??0));
      const total=rs.reduce((sum,r)=>sum+(r.mm||0),0);
      const pct=Math.round((wetHours/rs.length)*100);
      const bright=Math.round((clearHours/rs.length)*100);
      const title="모델 예보상 비 가능성이 높은 시간 "+wetHours+"시간, 맑은 낮 시간 "+clearHours+"시간";
      return '<div class="forecast-day" title="'+safe(title)+'"><b>'+safe(prettyDate(date))+'</b><div class="forecast-day-bar"><span class="rain-share" style="width:'+pct+'%"></span><span class="sun-share" style="width:'+bright+'%"></span></div><span>☂ 최대 '+number(pr)+'% · '+number(total,1)+'mm</span><small>비 가능성 '+wetHours+'h · 낮 맑음 '+clearHours+'h</small></div>';
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
    const rain48=hours.reduce((a,h)=>a+(finite(h.mm)?h.mm:0),0);
    const nextRain=hardRain[0];
    const nextGust=strongWind[0];
    const firstCold=likelyCold[0];
    const frostLevel=firstCold&&firstCold.temp<=0?"high":firstCold?"mid":"good";
    const frostTitle=firstCold?(firstCold.temp<=0?"영하 기온 예보":"저온 가능성 주의"):"뚜렷한 저온 신호 없음";
    const messages=[
      {icon:"❄️",title:"서리·냉해 주의",cls:frostLevel,value:frostTitle,detail:firstCold?prettyTime(firstCold.time)+" · 예보 기온 "+number(firstCold.temp)+"°C. 실제 서리 발생은 지표면·지형·바람에 따라 다릅니다.":"48시간 내 예보 기온 3°C 이하 시점 없음. 지표면 서리는 별도 확인."},
      {icon:"🌬️",title:"강풍·비산 주의",cls:nextGust?"mid":"good",value:nextGust?"돌풍 예보 확인":"뚜렷한 돌풍 위험 낮음",detail:nextGust?prettyTime(nextGust.time)+" · 돌풍 "+number(nextGust.gust)+" km/h. 약제 비산과 시설물 점검.":"48시간 내 돌풍 35km/h 이상 예보 없음. 현장 풍향·풍속은 별도로 확인."},
      {icon:"☂️",title:"강수·관수 참고",cls:nextRain?"mid":"good",value:"향후 48시간 "+number(rain48,1)+"mm",detail:nextRain?"강수 가능성 높은 첫 시각 "+prettyTime(nextRain.time)+". 관수량은 토양·작물 상태로 판단하세요.":"뚜렷한 비 신호가 없어도 토양수분과 관수시설 상태 확인 필요."},
      {icon:"🌡️",title:"야간 저온",cls:finite(minNight)&&minNight<=3?"mid":"good",value:finite(minNight)?number(minNight)+"°C":"정보 없음",detail:"향후 48시간 야간 최저 예보. 현장 지표면은 예보 기온과 다를 수 있습니다."}
    ];
    const target=el("farmSignals");
    if(target)target.innerHTML=messages.map(m=>'<article class="farm-signal '+m.cls+'"><span class="farm-icon" aria-hidden="true">'+m.icon+'</span><div><span class="farm-name">'+m.title+'</span><strong>'+safe(m.value)+'</strong><p>'+safe(m.detail)+'</p></div></article>').join("");
    const next=el("farmSummary");
    if(next)next.textContent=firstCold?"향후 48시간에 저온 구간이 있습니다. 작물과 시설을 확인해 주세요.":"향후 48시간의 저온·돌풍·강수를 고려해 작업 시점을 정하세요.";
  }
  function pickNotices(){
    const hours=rows(),alerts=[];
    const rain=hours.slice(0,12).find(h=>(h.rain??0)>=65||(h.mm??0)>=1);
    const frost=hours.slice(0,48).find(h=>finite(h.temp)&&h.temp<=2);
    const wind=hours.slice(0,24).find(h=>finite(h.gust)&&h.gust>=35);
    if(prefs.rain&&rain)alerts.push({id:"rain",time:rain.time,title:"강수 가능성 높음",body:prettyTime(rain.time)+" · 강수확률 "+number(rain.rain)+"%"});
    if(prefs.frost&&frost)alerts.push({id:"frost",time:frost.time,title:"저온·서리 가능성 확인",body:prettyTime(frost.time)+" · 기온 "+number(frost.temp)+"°C"});
    if(prefs.wind&&wind)alerts.push({id:"wind",time:wind.time,title:"돌풍 위험 확인",body:prettyTime(wind.time)+" · 돌풍 "+number(wind.gust)+"km/h"});
    return alerts;
  }
  function renderAlerts(){
    const root=el("alertList");if(!root||!data)return;
    const notices=pickNotices();
    root.innerHTML=notices.length?notices.map(a=>'<div class="notice-result"><b>'+safe(a.title)+'</b><span>'+safe(a.body)+'</span></div>').join(""):'<p class="muted-text">설정한 기준에서 가까운 경보 조건이 없거나 조건을 선택하지 않았습니다.</p>';
    if(el("foregroundNotice"))el("foregroundNotice").textContent=("Notification" in window&&Notification.permission==="granted")?"브라우저 알림 사용 허용됨 · 앱 열림 상태에서만 점검":"브라우저 알림 미허용 · 앱 내 알림 조건만 확인";
  }
  function saveAlertPreferences(){
    prefs={rain:el("watchRain").checked,frost:el("watchFrost").checked,wind:el("watchWind").checked};
    try{localStorage.setItem(TRACK_KEY,JSON.stringify(prefs));}catch(_){}
    renderAlerts();
    const save=el("savedAlertStatus");if(save)save.textContent="이 브라우저에 조건이 저장되었습니다. 알림은 앱 접속 시 확인됩니다.";
    notifyIfAllowed();
  }
  function notifyIfAllowed(){
    if(!data||!("Notification" in window)||Notification.permission!=="granted"||document.visibilityState!=="visible")return;
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
      if(!("Notification" in window)){el("savedAlertStatus").textContent="이 브라우저는 알림 API를 지원하지 않습니다.";return;}
      try{
        const permission=await Notification.requestPermission();
        el("savedAlertStatus").textContent=permission==="granted"?"브라우저 알림 권한을 허용했습니다. 앱이 열려 있을 때만 알림을 확인합니다.":"알림 권한이 허용되지 않았습니다.";
      }catch(e){el("savedAlertStatus").textContent="브라우저 알림 권한을 확인할 수 없습니다.";}
      renderAlerts();notifyIfAllowed();
    });
    Object.keys(prefs).forEach(k=>{const box=el("watch"+k.charAt(0).toUpperCase()+k.slice(1));if(box)box.checked=prefs[k];});
    updateButtons();
  }
  window.addEventListener("weatherhannun:data",function(event){
    data=event.detail;
    const hours=rows();
    const start=el("rainDateStart"),end=el("rainDateEnd");
    if(!hours.length)return;
    if(start){start.min=hours[0].date;start.max=hours[hours.length-1].date;if(!start.value||start.value<start.min||start.value>start.max)start.value=hours[0].date;}
    if(end){end.min=hours[0].date;end.max=hours[hours.length-1].date;if(!end.value||end.value<end.min||end.value>end.max)end.value=hours[Math.min(47,hours.length-1)].date;}
    rangeStart=start?.value||hours[0].date;rangeEnd=end?.value||hours[hours.length-1].date;
    rainSummary();farm();renderAlerts();notifyIfAllowed();
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();
