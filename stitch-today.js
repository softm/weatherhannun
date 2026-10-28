/* Stitch TODAY screen 0f4b26a4c2f74835b4e76fbb6d3c57c7.
 * Preserve source visual structure; hydrate all dynamic values from app.js.
 * No mock weather, users, real-time observations, or nonfunctional controls.
 */
(function(){
 'use strict';
 var latest=null, view=null, nodes=null;
 var fmt=(v,d=0)=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?'--':Number(v).toFixed(d).replace(/\.0+$/,'');
 var cell=(a,i)=>Array.isArray(a)?a[i]:undefined;
 var short=t=>t&&t.includes('T')?t.slice(11,16):'--:--';
 var clock=t=>t?new Date(t).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}):'--:--';
 var leaf=(parent,text)=>Array.from(parent.querySelectorAll('span,div,p,b,strong')).find(e=>!e.children.length&&e.textContent.replace(/\s+/g,' ').trim()===text)||null;
 var put=(node,value)=>{if(node)node.textContent=value};
 function condition(code,day){
  if(window.WeatherIcons)return window.WeatherIcons.describe(code,day);
  return {name:'날씨 정보 없음',key:'unknown'};
 }
 function hours(w){
  var h=w.hourly||{}, ts=h.time||[],n=w.current?.time||'';
  var start=ts.findIndex(t=>t.slice(0,13)>=n.slice(0,13));if(start<0)start=0;
  return ts.slice(start,start+24).map((time,k)=>{
   var i=k+start;
   return {time,temp:cell(h.temperature_2m,i),rain:cell(h.precipitation_probability,i),
    mm:cell(h.precipitation,i),wind:cell(h.wind_speed_10m,i),gust:cell(h.wind_gusts_10m,i),
    humid:cell(h.relative_humidity_2m,i),uv:cell(h.uv_index,i),day:cell(h.is_day,i),code:cell(h.weather_code,i)};
  });
 }
 function activityRow(h){
  return {time:h?.time,temp:h?.temp,rain:h?.rain,mm:h?.mm,wind:h?.wind,gust:h?.gust,
   humidity:h?.humid,uv:h?.uv,isDay:h?.day,code:h?.code};
 }
 function score(kind,h,following){
  var core=window.WeatherActivityCore;
  if(!core)return null;
  var result=core.evaluate(kind,activityRow(h),(following||[]).map(activityRow));
  return result.available&&Number.isFinite(result.score)?result.score:null;
 }
 function best(kind,hours){
  var win=null;
  for(var i=0;i<Math.min(22,hours.length-2);i++){
   var nums=[0,1,2].map(offset=>score(kind,hours[i+offset],hours.slice(i+offset+1,i+offset+7)));
   if(nums.some(x=>x===null))continue;
   var s=Math.round(nums.reduce((a,b)=>a+b,0)/3);
   if(!win||s>win.score)win={score:s,from:hours[i].time,to:hours[i+2].time};
  }
  return win;
 }
 function go(tab){
  (document.querySelector('.desktop-nav [data-view="'+tab+'"]')||document.querySelector('.mobile-nav [data-view="'+tab+'"]')||document.querySelector('[data-view="'+tab+'"]'))?.click();
 }
 function activity(kind){
  document.querySelector('[data-activity="'+kind+'"]')?.click();
  go('activity');
 }
 function decorateNav(){
  var map={today:'wb_sunny',hourly:'schedule',weekly:'calendar_month',activity:'directions_run',map:'map'};
  document.querySelectorAll('.mobile-nav button[data-view]').forEach(b=>{
   var icon=b.querySelector('.stitch-tab-icon');
   if(icon&&map[b.dataset.view])icon.innerHTML='<span class="material-symbols-outlined" aria-hidden="true">'+map[b.dataset.view]+'</span>';
  });
 }
 function favourite(){
  var actions=document.querySelector('.top-actions');
  if(!actions||document.getElementById('stitchFavourite'))return;
  var button=document.getElementById('favoriteButton')||document.createElement('button');
  button.id='stitchFavourite';button.type='button';button.className='stitch-favourite-button';button.textContent='☆';
  function sync(){
   var saved=document.getElementById('saveCurrentLocation')?.disabled;
   button.classList.toggle('saved',!!saved);button.textContent=saved?'★':'☆';
   button.title=saved?'저장된 지역 관리':'이 지역 관심지역 추가';
   button.setAttribute('aria-label',button.title);
  }
  button.onclick=()=>{
   var save=document.getElementById('saveCurrentLocation');
   if(save&&!save.disabled)save.click();
   else document.getElementById('locationButton')?.click();
   setTimeout(sync,20);
  };
  if(!button.parentNode)actions.insertBefore(button,document.getElementById('refreshButton'));
  var save=document.getElementById('saveCurrentLocation');
  if(save)new MutationObserver(sync).observe(save,{attributes:true,childList:true,subtree:true});
  sync();
 }
 function setup(section){
  var [hero,air,brief,actions,hour,metrics,notice]=section;
  var cards=[...actions.querySelectorAll('article')];
  nodes={
   hero,air,brief,actions,hour,metrics,notice,cards,
   weatherVisual:hero.querySelector('[data-weather-visual]'),
   temperature:hero.querySelector('[data-official-temp]')||leaf(hero,'22'),sky:leaf(hero,'대체로 맑음'),feels:leaf(hero,'체감 23.5°'),
   high:leaf(hero,'최고 25°'),low:leaf(hero,'최저 14°'),updated:leaf(hero,'조회 중'),
   source:hero.querySelector('[data-official-source]')||leaf(hero,'기상 모델 예보 연결'),airText:air.querySelector('[data-official-air-grade]'),
   briefName:leaf(brief,'삼청동 기상브리핑'),briefMessage:brief.querySelector('p'),
   actionPlace:leaf(actions,'삼청동 기준'),
   hourlyBanner:leaf(hour,'강수 예보 확인 중'),
   sunset:leaf(metrics,'오후 7시 28분 (19:28)'),daylight:leaf(metrics,'9시간 47분'),
   community:leaf(notice,'내 관심 기상 조건을 설정하여 알림을 확인하세요.'),
   track:document.getElementById('stitchHourlyTrack'),
   matrix:metrics.querySelector('.grid.grid-cols-2')
  };
  if(nodes.weatherVisual&&window.WeatherIcons)window.WeatherIcons.render(nodes.weatherVisual,null,1,'weather-glyph--hero');
  // Turn non-live original demo numbers into placeholders before displaying.
  [nodes.temperature,nodes.high,nodes.low,nodes.feels,nodes.updated].forEach(n=>put(n,'--'));
  put(nodes.airText,'대기질 예측을 불러오는 중…');
  put(nodes.briefMessage,'현재 지역의 기상 예보를 분석 중입니다.');
  if(nodes.matrix)[...nodes.matrix.children].forEach(card=>{
   put(card.querySelector('.font-tabular-metric'),'--');
   put(card.querySelector('p'),'예보 연결 중…');
  });
  cards.forEach((card,i)=>{
   var key=['walk','laundry','harvest'][i];
   card.setAttribute('role','button');card.tabIndex=0;card.classList.add('stitch-action-card');
   card.setAttribute('aria-label',['산책 추천 상세 보기','빨래 추천 상세 보기','농작업 추천 상세 보기'][i]);
   card.addEventListener('click',()=>activity(key));
   card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activity(key);}});
   card.querySelector('button')?.addEventListener('click',e=>{e.stopPropagation();activity(key);});
   put(card.querySelector('p'),'추천 시간 분석 중…');
  });
  var noteSource=document.createElement('p');
  noteSource.className='stitch-source-note';noteSource.textContent='Open-Meteo 모델 예보 · 관측소 실측 아님';
  hero.insertAdjacentElement('afterend',noteSource);
  hour.querySelector('h2')?.addEventListener('click',()=>go('hourly'));
  if(notice){
   notice.tabIndex=0;notice.setAttribute('role','button');notice.style.cursor='pointer';
   var alerts=()=>{go('settings');setTimeout(()=>document.querySelector('.watch-settings')?.scrollIntoView({behavior:'smooth',block:'center'}),80);};
   notice.addEventListener('click',alerts);
   notice.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();alerts();}});
  }
 }
 function airGrade(v,arr){if(v===null||v===undefined||!Number.isFinite(+v))return '정보 없음';
  return v<=arr[0]?'좋음':v<=arr[1]?'보통':v<=arr[2]?'나쁨':'매우 나쁨';
 }
 function render(data){
  if(!nodes||!data?.weather?.current)return;
  var w=data.weather,c=w.current,d=w.daily||{},h=hours(w),now=h[0]||{},
      current=condition(c.weather_code,c.is_day),loc=data.loc?.name||'현재 지역';
  put(nodes.temperature,fmt(c.temperature_2m));
  put(nodes.sky,current.name);
  put(nodes.feels,'체감 '+fmt(c.apparent_temperature,1)+'°');
  put(nodes.high,'최고 '+fmt(cell(d.temperature_2m_max,0))+'°');
  put(nodes.low,'최저 '+fmt(cell(d.temperature_2m_min,0))+'°');
  put(nodes.updated,(data.status==='live'?'조회 ':'저장 ')+clock(data.at));
  put(nodes.source,data.status==='cached-error'?'연결 실패 · 저장된 예보':'기상 모델 예보 연결');
  nodes.source?.classList.toggle('stitch-state-error',data.status==='cached-error');
  if(nodes.weatherVisual&&window.WeatherIcons)window.WeatherIcons.render(nodes.weatherVisual,c.weather_code,c.is_day,'weather-glyph--hero');
  var air=data.air?.current||{},pm=airGrade(air.pm10,[30,80,150]),fine=airGrade(air.pm2_5,[15,35,75]);
  put(nodes.airText,pm==='정보 없음'?'대기질 예측 정보 없음':pm.includes('나쁨')||fine.includes('나쁨')?'대기질 주의 · 활동 전 확인':'대기질 모델 예측 · 실외 활동 참고');
  // Retain original colored 2-chip presentation while replacing fictional values.
  var chips=[...nodes.air.querySelectorAll('div')].filter(x=>x.childElementCount<=1&&/^(미세|초미세)\s/.test(x.textContent.trim()));
  chips.slice(-2).forEach((el,i)=>{el.textContent=(i?'초미세 ':'미세 ')+(i?fine:pm)+' '+fmt(i?air.pm2_5:air.pm10)+'㎍/㎥';el.title='Open-Meteo 대기질 모델 예측값';});
  put(nodes.briefName,loc+' 기상브리핑');
  // The Stitch prototype has amber/emerald emphasis, but a textContent
  // update used to erase all inline colors. Render weather-backed semantic
  // highlights as safe text nodes and marks instead of unescaped HTML.
  var summary=document.getElementById('briefingText')?.textContent;
  var fallback=current.name+' · 시간별 예보를 확인해 주세요.';
  var sentence=summary||fallback;
  var briefing=window.WeatherHannunBriefingCore?.analyse(data);
  var highlighter=window.WeatherBriefingHighlights;
  nodes.briefMessage?.classList.add('stitch-caster-briefing');
  if(highlighter&&nodes.briefMessage){
    highlighter.render(nodes.briefMessage,sentence,{where:loc,events:briefing?.events||[]});
  }else put(nodes.briefMessage,sentence);
  put(nodes.actionPlace,loc+' 기준');
  var rainWindow=h.slice(0,12),rainComplete=rainWindow.length===12&&rainWindow.every(x=>Number.isFinite(x.rain)&&Number.isFinite(x.mm));
  var next=rainWindow.find(x=>Number.isFinite(x.rain)&&x.rain>=50||Number.isFinite(x.mm)&&x.mm>=.3);
  put(nodes.hourlyBanner,next?short(next.time)+' 비 신호 '+(Number.isFinite(next.rain)&&next.rain>=50?fmt(next.rain)+'%':fmt(next.mm,1)+'mm/h'):rainComplete?'12시간 뚜렷한 강수 신호 낮음':'강수 자료 일부 누락');
  var kinds=['walk','laundry','harvest'],windows=kinds.map(k=>best(k,h));
  nodes.cards.forEach((card,i)=>{
   var bestTime=windows[i];
   var message=i===2?'풍속 '+fmt(c.wind_speed_10m)+' km/h · 비 '+fmt(now.rain)+'% · 현장 확인':
    bestTime?short(bestTime.from)+' ~ '+short(bestTime.to)+' ('+bestTime.score+'점)':'적합한 시간 확인 필요';
   put(card.querySelector('p'),message);
   var chip=[...card.querySelectorAll('span')].find(s=>s.childElementCount===0&&/^(--점|92점)$/.test(s.textContent.trim()));
   if(chip&&bestTime)put(chip,fmt(bestTime.score)+'점');
  });
  if(nodes.track){
   nodes.track.replaceChildren();
   h.slice(0,12).forEach((item,i)=>{
    var cond=condition(item.code,item.day);
    var b=document.createElement('button');b.type='button';
    b.className='stitch-hour-cell flex flex-col items-center justify-between min-w-[72px] h-32 py-space-sm rounded-xl shrink-0 shadow-sm '+(i?'bg-white border border-slate-200/80 text-slate-800':'stitch-hour-current bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-blue-500/20');
    b.setAttribute('aria-label',(i?short(item.time):'현재 '+short(item.time))+' '+cond.name+', 기온 '+fmt(item.temp)+'도, 비 '+fmt(item.rain)+'퍼센트 상세');
    if(!i)b.setAttribute('aria-current','time');
    var hour=document.createElement('span');hour.className='font-label-sm text-label-sm font-semibold';hour.textContent=i?' '+item.time.slice(11,13)+'시':'현재';
    var ic=document.createElement('span');ic.className='stitch-hour-weather';ic.setAttribute('aria-hidden','true');
    ic.innerHTML=window.WeatherIcons?window.WeatherIcons.markup(item.code,item.day,'weather-glyph--tile'):'<span class="weather-glyph-fallback" aria-hidden="true">?</span>';
    var num=document.createElement('div');num.className='flex flex-col items-center';
    var temp=document.createElement('span');temp.className='font-tabular-metric text-tabular-metric font-bold';temp.textContent=fmt(item.temp)+'°';
    var rain=document.createElement('span');rain.className='font-label-sm text-label-sm mt-0.5';rain.textContent='비 '+fmt(item.rain)+'%';
    num.append(temp,rain);b.append(hour,ic,num);
    b.addEventListener('click',()=>{
     nodes.track.querySelectorAll('.stitch-hour-selected').forEach(x=>x.classList.remove('stitch-hour-selected'));
     b.classList.add('stitch-hour-selected');
     var txt=nodes.hour.querySelector('.stitch-hour-context')||document.createElement('p');
     txt.className='stitch-hour-context';txt.textContent=short(item.time)+' · '+cond.name+' '+fmt(item.temp)+'°C · 비 '+fmt(item.rain)+'% · 바람 '+fmt(item.wind)+'km/h';
     nodes.hour.appendChild(txt);
    });
    nodes.track.appendChild(b);
   });
  }
  var values=[
   [fmt(now.rain)+'%',next?'다음 비 신호 '+short(next.time)+' ('+(Number.isFinite(next.rain)&&next.rain>=50?fmt(next.rain)+'%':fmt(next.mm,1)+'mm/h')+')':rainComplete?'12시간 내 뚜렷한 강수 신호 낮음':'강수 자료 일부 누락'],
   [fmt(c.relative_humidity_2m)+'%','상대습도 (기상 모델)'],
   [Number.isFinite(c.wind_speed_10m)?fmt(c.wind_speed_10m/3.6,1)+' m/s':'-- m/s','풍속 '+fmt(c.wind_speed_10m)+'km/h · 돌풍 '+fmt(now.gust)+'km/h'],
   [fmt(now.uv)+' UV',+now.uv>=6?'자외선 차단 권장':'자외선 예보 지수']
  ];
  [...nodes.matrix?.children||[]].forEach((card,i)=>{
   put(card.querySelector('.font-tabular-metric'),values[i][0]);
   put(card.querySelector('p'),values[i][1]);
  });
  var sunset=cell(d.sunset,0)||'';
  put(nodes.sunset,sunset?short(sunset)+' (KST)':'정보 없음');
  var nowMinutes=(c.time||'').slice(11,16).split(':').map(Number),
      endMinutes=sunset.slice(11,16).split(':').map(Number);
  if(sunset&&nowMinutes.length===2&&endMinutes.length===2){
   var diff=Math.max(0,endMinutes[0]*60+endMinutes[1]-nowMinutes[0]*60-nowMinutes[1]);
   put(nodes.daylight,Math.floor(diff/60)+'시간 '+(diff%60)+'분');
  }else put(nodes.daylight,'정보 없음');
  put(nodes.community,'강수·저온·돌풍 알림 조건 설정 · 앱이 열려 있는 동안 알림');
 }
 function init(){
  var oldView=document.getElementById('view-today');if(!oldView)return;
  decorateNav();favourite();
  fetch('./stitch-today.template.html?v=39').then(r=>{if(!r.ok)throw Error('Stitch template '+r.status);return r.text();}).then(html=>{
   var host=document.createElement('div');host.id='stitch-live-dashboard';host.innerHTML=html;
   var group=[...host.firstElementChild.children].filter(x=>x.tagName==='SECTION');
   if(group.length!==7)throw Error('Stitch 원본 섹션 변경: '+group.length);
   var old=document.createElement('div');old.id='stitchLegacyToday';
   while(oldView.firstChild)old.appendChild(oldView.firstChild);
   oldView.append(host,old);view=host;setup(group);
   document.documentElement.dataset.stitchLive='true';
   window.dispatchEvent(new CustomEvent('weatherhannun:stitch-ready'));
   if(latest)render(latest);
  }).catch(err=>{console.error('Stitch today fallback to existing dashboard',err);});
 }
 window.addEventListener('weatherhannun:data',e=>{latest=e.detail;if(view)render(latest);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
