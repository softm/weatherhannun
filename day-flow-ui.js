(function(){
  'use strict';var latest=null,host=null;
  function make(){
    if(host&&host.isConnected)return host;
    host=document.createElement('section');host.id='dayFlowBoard';host.className='day-flow-board stitch-card';host.setAttribute('aria-label','오늘 날씨 한눈 요약');
    host.innerHTML='<div class="day-flow-heading"><h2>오늘 한눈</h2><div class="day-flow-badges"><span class="day-flow-source" data-day-source title="관측소 실측이 아닌 모델 예보입니다.">모델 예보</span><span class="day-flow-confidence" data-day-confidence>판단 준비 중</span></div></div><ol class="day-flow-summary"><li><small>지금</small><strong data-day-now>불러오는 중</strong></li><li><small>다음</small><strong data-day-change>분석 중</strong></li><li class="day-flow-action"><small>준비</small><strong data-day-action>계산 중</strong></li></ol><div class="day-flow-timeline-wrap"><div class="day-flow-timeline-stage"><div class="day-flow-timeline" data-day-timeline aria-label="앞으로 24시간 생활 날씨선"></div><div class="day-flow-now-marker" data-day-now-marker hidden><b data-day-now-label>현재</b></div></div><div class="day-flow-time-axis" data-day-axis aria-label="24시간 시각 눈금"></div><div class="day-flow-timeline-meta"><span data-day-range-label>현재 시각부터 24시간</span><div class="day-flow-legend"><span><i class="good"></i>무난</span><span><i class="rain"></i>비</span><span><i class="cold"></i>추위</span><span><i class="heat"></i>더위</span><span><i class="wind"></i>강풍</span></div></div></div>';
    var stitch=document.getElementById('stitch-live-dashboard'),fallback=document.querySelector('#view-today .today-layout');if(stitch)stitch.prepend(host);else if(fallback)fallback.prepend(host);return host;
  }
  function render(payload){
    var core=window.WeatherDayFlowCore;if(!core||!payload||!payload.weather)return;var board=make(),result=core.build(payload);
    board.querySelector('[data-day-now]').textContent=result.now;board.querySelector('[data-day-change]').textContent=result.change;board.querySelector('[data-day-action]').textContent=result.action;
    var confidence=board.querySelector('[data-day-confidence]');confidence.textContent='판단 '+result.confidence.level;confidence.title=result.confidence.detail;
    board.querySelector('[data-day-source]').textContent='모델 예보';
    var line=board.querySelector('[data-day-timeline]');line.replaceChildren();
    var axis=board.querySelector('[data-day-axis]'),marker=board.querySelector('[data-day-now-marker]');axis.replaceChildren();marker.hidden=true;
    if(!result.timeline.length){line.textContent='시간별 예보 자료가 없습니다.';line.classList.add('empty');return;}line.classList.remove('empty');
    result.timeline.forEach(function(item,index){var segment=document.createElement('span'),previous=result.timeline[index-1];segment.className='day-flow-segment '+item.kind+(index===0?' is-current-hour':'')+(previous&&previous.time.slice(0,10)!==item.time.slice(0,10)?' day-boundary':'');segment.title=item.label+' · '+(Number.isFinite(item.temp)?item.temp+'℃':'기온 없음')+' · 비 '+(Number.isFinite(item.rain)?item.rain+'%':'자료 없음');segment.setAttribute('aria-label',(index===0?'현재 시간대 · ':'')+segment.title);line.appendChild(segment);});
    function stamp(value,now){var date=new Date(value);if(Number.isNaN(date.getTime()))return '';var hh=String(date.getHours()).padStart(2,'0'),mm=String(date.getMinutes()).padStart(2,'0');return now?'현재 '+hh+':'+mm:(date.getMonth()+1)+'/'+date.getDate()+' '+hh+'시';}
    var first=new Date(result.timeline[0].time),last=new Date(result.timeline[result.timeline.length-1].time);last.setHours(last.getHours()+1);
    [6,12,18,24].forEach(function(offset){var source=offset===24?last:new Date(result.timeline[Math.min(offset,result.timeline.length-1)].time),label=document.createElement('span');label.className='day-flow-time-label';label.style.left=(offset/24*100)+'%';label.textContent=stamp(source,false);axis.appendChild(label);});
    var current=new Date(result.currentTime),span=last.getTime()-first.getTime();if(!Number.isNaN(current.getTime())&&span>0){var percent=Math.max(0,Math.min(100,(current.getTime()-first.getTime())/span*100));marker.style.left=percent+'%';marker.querySelector('[data-day-now-label]').textContent=stamp(current,true);marker.hidden=false;board.querySelector('[data-day-range-label]').textContent=stamp(current,true)+'부터 24시간';}
  }
  window.addEventListener('weatherhannun:data',function(event){latest=event.detail;render(latest);});window.addEventListener('weatherhannun:stitch-ready',function(){host=null;if(latest)render(latest);});
})();
