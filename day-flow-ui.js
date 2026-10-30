(function(){
  'use strict';var latest=null,host=null;
  function make(){
    if(host&&host.isConnected)return host;
    host=document.createElement('section');host.id='dayFlowBoard';host.className='day-flow-board stitch-card';host.setAttribute('aria-label','오늘 날씨 한눈 요약');
    host.innerHTML='<div class="day-flow-heading"><h2>오늘 한눈</h2><div class="day-flow-badges"><span class="day-flow-source" data-day-source title="관측소 실측이 아닌 모델 예보입니다.">모델 예보</span><span class="day-flow-confidence" data-day-confidence>판단 준비 중</span></div></div><ol class="day-flow-summary"><li><small>지금</small><strong data-day-now>불러오는 중</strong></li><li><small>다음</small><strong data-day-change>분석 중</strong></li><li class="day-flow-action"><small>준비</small><strong data-day-action>계산 중</strong></li></ol><div class="day-flow-timeline-wrap"><div class="day-flow-timeline" data-day-timeline aria-label="앞으로 24시간 생활 날씨선"></div><div class="day-flow-timeline-meta"><span>지금부터 24시간</span><div class="day-flow-legend"><span><i class="good"></i>무난</span><span><i class="rain"></i>비</span><span><i class="cold"></i>추위</span><span><i class="heat"></i>더위</span><span><i class="wind"></i>강풍</span></div></div></div>';
    var stitch=document.getElementById('stitch-live-dashboard'),fallback=document.querySelector('#view-today .today-layout');if(stitch)stitch.prepend(host);else if(fallback)fallback.prepend(host);return host;
  }
  function render(payload){
    var core=window.WeatherDayFlowCore;if(!core||!payload||!payload.weather)return;var board=make(),result=core.build(payload);
    board.querySelector('[data-day-now]').textContent=result.now;board.querySelector('[data-day-change]').textContent=result.change;board.querySelector('[data-day-action]').textContent=result.action;
    var confidence=board.querySelector('[data-day-confidence]');confidence.textContent='판단 '+result.confidence.level;confidence.title=result.confidence.detail;
    board.querySelector('[data-day-source]').textContent='모델 예보';
    var line=board.querySelector('[data-day-timeline]');line.replaceChildren();
    if(!result.timeline.length){line.textContent='시간별 예보 자료가 없습니다.';line.classList.add('empty');return;}line.classList.remove('empty');
    result.timeline.forEach(function(item,index){var segment=document.createElement('span');segment.className='day-flow-segment '+item.kind;segment.title=item.label+' · '+(Number.isFinite(item.temp)?item.temp+'℃':'기온 없음')+' · 비 '+(Number.isFinite(item.rain)?item.rain+'%':'자료 없음');segment.setAttribute('aria-label',segment.title);if(index%6===0)segment.dataset.hour=item.label;line.appendChild(segment);});
  }
  window.addEventListener('weatherhannun:data',function(event){latest=event.detail;render(latest);});window.addEventListener('weatherhannun:stitch-ready',function(){host=null;if(latest)render(latest);});
})();
