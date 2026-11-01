(function(){
 'use strict';
 const C=window.WeatherHourlyExplorerCore,$=id=>document.getElementById(id);if(!C)return;
 let latest=null,all=[],visible=[],period='24',selected=null,locationKey='',renderKey='';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=x=>window.WeatherIcons?.markup(x.code,x.isDay)||'';
 const condition=x=>window.WeatherIcons?.describe(x.code,x.isDay)?.name||'정보 없음';
 const dayLabel=time=>{const day=time.slice(0,10),first=all[0]?.time.slice(0,10);const delta=first?(Date.parse(day)-Date.parse(first))/86400000:-1;return (delta===0?'오늘 ':delta===1?'내일 ':'')+day.slice(5).replace('-','/');};
 const value=(x,unit,d=0)=>C.format(x,d)+(C.finite(x)?unit:'');
 function drawChart(){
  const width=Math.max(visible.length*80,80),temps=visible.map(x=>x.temp).filter(C.finite);
  if(!temps.length){$('hourlyChart').innerHTML='<p class="hourly-no-chart">기온 정보 없음 · 시간대별 다른 항목을 확인하세요.</p>';$('hourlyChart').style.width=width+'px';return;}
  const min=Math.min(...temps)-2,max=Math.max(...temps)+2;
  const y=x=>94-(x-min)/(max-min)*72;
  let paths=[],path=[];visible.forEach((x,i)=>{if(C.finite(x.temp))path.push((40+i*80)+','+y(x.temp));else if(path.length){paths.push(path);path=[];}});if(path.length)paths.push(path);
  const lines=paths.map(p=>'<polyline points="'+p.join(' ')+'"/>').join('');
  const dots=visible.map((x,i)=>C.finite(x.temp)?'<circle data-chart-hour="'+i+'" cx="'+(40+i*80)+'" cy="'+y(x.temp)+'" r="4"/>':'').join('');
  const targets=visible.map((x,i)=>'<rect data-chart-hour="'+i+'" x="'+i*80+'" y="0" width="80" height="120" class="hourly-chart-target"/>').join('');
  $('hourlyChart').style.width=width+'px';$('hourlyChart').innerHTML='<svg width="'+width+'" height="120" viewBox="0 0 '+width+' 120" role="img" aria-label="시간별 기온 변화. 아래 시간 버튼으로 같은 시점을 선택할 수 있습니다."><g class="hourly-chart-line">'+lines+'</g><g class="hourly-chart-dots">'+dots+'</g>'+targets+'<line id="hourlySelectedLine" x1="40" x2="40" y1="8" y2="112"/></svg>';
 }
 function detail(){
  const i=visible.findIndex(x=>x.time===selected),x=visible[i];if(!x){$('hourlyDetailRows').innerHTML='<p>선택 기간의 예보가 없습니다.</p>';return;}
  const wasOpen=$('hourlyExtra')?.open;
  const basics=[['기온',value(x.temp,'°')],['강수확률',value(x.rain,'%')],['강수량',value(x.mm,'mm',1)]];
  const extras=[['풍속',value(x.wind,'km/h')],['돌풍',value(x.gust,'km/h')],['습도',value(x.humidity,'%')],['체감온도',value(x.feels,'°')],['자외선',value(x.uv,'',1)]];
  $('hourlyDetailRows').innerHTML='<div class="selected-hour-head"><div><h3>'+esc(C.label(x.time))+'</h3><p>'+esc(condition(x))+'</p></div><span aria-hidden="true">'+icon(x)+'</span></div><dl class="selected-hour-values">'+basics.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl><details id="hourlyExtra"'+(wasOpen?' open':'')+'><summary>바람·습도 등 자세히</summary><dl class="selected-hour-extra">'+extras.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl></details>';
  document.querySelectorAll('[data-explorer-hour]').forEach(b=>{const active=Number(b.dataset.explorerHour)===i;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-chart-hour]').forEach(e=>e.classList.toggle('selected',Number(e.dataset.chartHour)===i));
  const line=$('hourlySelectedLine');if(line){line.setAttribute('x1',40+i*80);line.setAttribute('x2',40+i*80);}
 }
 function select(i,scroll){if(!visible[i])return;selected=visible[i].time;detail();if(scroll){const port=$('hourlyScroll');port.scrollTo({left:Math.max(0,i*80-port.clientWidth/2+40),behavior:'auto'});}}
 function table(){if(!$('hourlyAll')?.open)return;$('hourlyAllRows').innerHTML=visible.map((x,i)=>'<tr><th scope="row"><button type="button" data-table-hour="'+i+'">'+esc(C.label(x.time))+'</button></th><td>'+value(x.temp,'°')+'</td><td>'+value(x.rain,'%')+'</td><td>'+value(x.mm,'',1)+'</td><td>'+value(x.wind,'')+'</td><td>'+value(x.gust,'')+'</td></tr>').join('');}
 function render(reset){
  visible=C.range(all,period,$('rainDateStart')?.value,$('rainDateEnd')?.value);
  if(reset||!visible.some(x=>x.time===selected))selected=visible[0]?.time||null;
  $('hourlyItems').innerHTML=visible.map((x,i)=>{const boundary=i===0||x.time.slice(0,10)!==visible[i-1].time.slice(0,10);return '<button type="button" class="hour-item explorer-hour" data-explorer-hour="'+i+'" aria-pressed="false" aria-label="'+esc(C.label(x.time)+' '+condition(x)+' 기온 '+value(x.temp,'도')+' 강수확률 '+value(x.rain,'%'))+'"><span class="hour-date">'+(boundary?esc(dayLabel(x.time)):'&nbsp;')+'</span><span class="hour-time">'+(x===all[0]?'현재':x.time.slice(11,13)+'시')+'</span><span class="hour-icon" aria-hidden="true">'+icon(x)+'</span><strong class="hour-temp">'+value(x.temp,'°')+'</strong><span class="hour-rain">'+value(x.rain,'%')+'</span><span class="hour-mm">'+value(x.mm,'mm',1)+'</span></button>';}).join('');
  $('hourlyRangeStatus').textContent=visible.length?C.label(visible[0].time)+' ~ '+C.label(visible[visible.length-1].time)+' · '+visible.length+'시간':'선택 기간의 예보 정보 없음';
  $('hourlySourceStatus').textContent=$('updatedBadge')?.textContent||'예보 기준 시각 확인 중';
  drawChart();detail();table();
  if(reset)$('hourlyScroll').scrollLeft=0;
 }
 function bind(){
  $('hourlyItems').addEventListener('click',e=>{const b=e.target.closest('[data-explorer-hour]');if(b)select(Number(b.dataset.explorerHour),false);});
  $('hourlyItems').addEventListener('keydown',e=>{const b=e.target.closest('[data-explorer-hour]');if(!b)return;let i=Number(b.dataset.explorerHour);if(e.key==='ArrowRight')i++;else if(e.key==='ArrowLeft')i--;else if(e.key==='Home')i=0;else if(e.key==='End')i=visible.length-1;else return;e.preventDefault();i=Math.max(0,Math.min(visible.length-1,i));select(i,true);$('hourlyItems').querySelector('[data-explorer-hour="'+i+'"]').focus({preventScroll:true});});
  $('hourlyChart').addEventListener('click',e=>{const target=e.target.closest('[data-chart-hour]');if(target)select(Number(target.dataset.chartHour),false);});
  $('hourlyAll').addEventListener('toggle',table);
  $('hourlyAllRows').addEventListener('click',e=>{const b=e.target.closest('[data-table-hour]');if(b){select(Number(b.dataset.tableHour),true);$('hourlyDetailRows').scrollIntoView({block:'center',behavior:'smooth'});}});
  $('hourlyNow').addEventListener('click',()=>select(0,true));
  document.querySelectorAll('[data-rain-period]').forEach(b=>b.addEventListener('click',()=>{period=b.dataset.rainPeriod;render(true);}));
  $('applyRainDates').addEventListener('click',()=>{if($('rainDateStart').value&&$('rainDateStart').value<=$('rainDateEnd').value){period='custom';render(true);}});
 }
 window.addEventListener('weatherhannun:data',e=>{latest=e.detail;const key=latest.loc?.lat+','+latest.loc?.lon,stamp=key+'|'+latest.at+'|'+latest.weather?.current?.time;if(stamp===renderKey)return;const reset=locationKey!==key;locationKey=key;renderKey=stamp;all=C.rows(latest.weather,new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T'));render(reset);});
 window.addEventListener('weatherhannun:select-hour',e=>{const i=visible.findIndex(x=>x.time===e.detail?.time);if(i>=0)select(i,true);});
 window.addEventListener('weatherhannun:view',e=>{if(e.detail.view==='hourly'&&visible.length)select(Math.max(0,visible.findIndex(x=>x.time===selected)),true);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
