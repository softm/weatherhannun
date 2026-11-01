(function(){
  'use strict';

  var latest=null,host=null,hideTimer=0;
  var KIND_LABELS={good:'무난',rain:'비',cold:'추위',heat:'더위',wind:'강풍'};

  function make(){
    if(host&&host.isConnected)return host;
    host=document.createElement('section');
    host.id='dayFlowBoard';
    host.className='day-flow-board stitch-card';
    host.setAttribute('aria-label','오늘 날씨 한눈 요약');
    host.innerHTML='<div class="day-flow-heading"><h2>오늘 한눈</h2><div class="day-flow-badges"><span class="day-flow-source" data-day-source title="관측소 실측이 아닌 모델 예보입니다.">모델 예보</span><span class="day-flow-confidence" data-day-confidence>판단 준비 중</span></div></div><ol class="day-flow-summary"><li><small>다음</small><strong data-day-change>분석 중</strong></li><li class="day-flow-action"><small>준비</small><strong data-day-action>계산 중</strong></li></ol><div class="day-flow-timeline-wrap"><div class="day-flow-timeline-stage"><div class="day-flow-scrub-popover" data-day-popover role="status" aria-live="polite" hidden><strong data-day-popover-time></strong><span data-day-popover-detail></span></div><div class="day-flow-timeline" data-day-timeline role="group" aria-label="앞으로 24시간 생활 날씨선. 누른 채 좌우로 움직여 시간별 날씨를 확인하세요."></div><div class="day-flow-now-marker" data-day-now-marker hidden><b data-day-now-label>현재</b></div></div><div class="day-flow-time-axis" data-day-axis aria-label="24시간 시각 눈금"></div><div class="day-flow-timeline-meta"><span data-day-range-label>현재 시각부터 24시간</span><span class="day-flow-scrub-hint">누른 채 좌우로 확인</span><div class="day-flow-legend"><span><i class="good"></i>무난</span><span><i class="rain"></i>비</span><span><i class="cold"></i>추위</span><span><i class="heat"></i>더위</span><span><i class="wind"></i>강풍</span></div></div></div>';
    var stitch=document.getElementById('stitch-live-dashboard'),fallback=document.querySelector('#view-today .today-layout');
    var slot=document.querySelector('[data-brief-day-flow]');
    if(slot){slot.append(host);host.classList.add('day-flow-integrated');host.querySelector('.day-flow-heading h2').textContent='핵심 요약 · 24시간';}
    else if(stitch)stitch.prepend(host);else if(fallback)fallback.prepend(host);
    return host;
  }

  function weatherLabel(item){
    var code=Number(item&&item.code),day=Number(item&&item.isDay)!==0;
    if(code===0)return day?'맑음':'맑은 밤';
    if(code===1)return day?'대체로 맑음':'구름 조금';
    if(code===2)return '구름 조금';
    if(code===3)return '흐림';
    if(code===45||code===48)return '안개';
    if(code>=51&&code<=57)return '이슬비';
    if(code>=61&&code<=67)return '비';
    if(code>=71&&code<=77)return '눈';
    if(code>=80&&code<=82)return '소나기';
    if(code>=85&&code<=86)return '눈 소나기';
    if(code>=95)return '뇌우';
    return KIND_LABELS[item&&item.kind]||'날씨';
  }

  function stamp(value,now){
    var date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    var hh=String(date.getHours()).padStart(2,'0'),mm=String(date.getMinutes()).padStart(2,'0');
    return now?'현재 '+hh+':'+mm:(date.getMonth()+1)+'/'+date.getDate()+' '+hh+'시';
  }

  function detailStamp(value){
    var date=new Date(value);
    if(Number.isNaN(date.getTime()))return '시간 미상';
    var days=['일','월','화','수','목','금','토'];
    return (date.getMonth()+1)+'월 '+date.getDate()+'일('+days[date.getDay()]+') '+String(date.getHours()).padStart(2,'0')+'시';
  }

  function value(number,suffix,fallback){return Number.isFinite(number)?Math.round(number)+suffix:fallback;}

  function timelineDetail(item){
    var parts=[weatherLabel(item),value(item.temp,'℃','기온 --'),value(item.rain,'%','비 --')];
    parts[2]='비 '+parts[2];
    if(Number.isFinite(item.mm)&&item.mm>=.1)parts.push('강수 '+item.mm.toFixed(1)+'mm');
    parts.push('바람 '+value(item.wind,'km/h','--'));
    if(Number.isFinite(item.gust)&&item.gust>=35)parts.push('돌풍 '+Math.round(item.gust)+'km/h');
    return parts.join(' · ');
  }

  function render(payload){
    var core=window.WeatherDayFlowCore;
    if(!core||!payload||!payload.weather)return;
    var board=make(),result=core.build(payload);
    board.querySelector('[data-day-change]').textContent=result.change;
    board.querySelector('[data-day-action]').textContent=result.action;
    var confidence=board.querySelector('[data-day-confidence]');
    confidence.textContent='판단 '+result.confidence.level;
    confidence.title=result.confidence.detail;
    board.querySelector('[data-day-source]').textContent='모델 예보';

    var line=board.querySelector('[data-day-timeline]'),axis=board.querySelector('[data-day-axis]'),marker=board.querySelector('[data-day-now-marker]'),popover=board.querySelector('[data-day-popover]');
    line.replaceChildren();axis.replaceChildren();marker.hidden=true;popover.hidden=true;
    clearTimeout(hideTimer);
    if(!result.timeline.length){line.textContent='시간별 예보 자료가 없습니다.';line.classList.add('empty');return;}
    line.classList.remove('empty');

    result.timeline.forEach(function(item,index){
      var segment=document.createElement('button'),previous=result.timeline[index-1],detail=timelineDetail(item);
      segment.type='button';
      segment.className='day-flow-segment '+item.kind+(index===0?' is-current-hour':'')+(previous&&previous.time.slice(0,10)!==item.time.slice(0,10)?' day-boundary':'');
      segment.dataset.index=String(index);
      segment.title=detailStamp(item.time)+' · '+detail;
      segment.setAttribute('aria-label',(index===0?'현재 시간대 · ':'')+segment.title);
      segment.setAttribute('aria-pressed','false');
      line.appendChild(segment);
    });

    var segments=Array.from(line.querySelectorAll('.day-flow-segment')),scrubbing=false,activeIndex=-1;
    function positionPopover(segment){
      var lineRect=line.getBoundingClientRect(),keyRect=segment.getBoundingClientRect(),popRect=popover.getBoundingClientRect();
      var center=keyRect.left-lineRect.left+keyRect.width/2,half=popRect.width/2+4;
      popover.style.left=Math.max(half,Math.min(lineRect.width-half,center))+'px';
    }
    function select(index,focus){
      index=Math.max(0,Math.min(segments.length-1,index));
      if(index===activeIndex&&!popover.hidden)return;
      segments.forEach(function(segment,i){var selected=i===index;segment.classList.toggle('is-selected',selected);segment.setAttribute('aria-pressed',selected?'true':'false');});
      activeIndex=index;
      var item=result.timeline[index],segment=segments[index];
      popover.className='day-flow-scrub-popover '+item.kind;
      popover.querySelector('[data-day-popover-time]').textContent=detailStamp(item.time);
      popover.querySelector('[data-day-popover-detail]').textContent=timelineDetail(item);
      popover.hidden=false;
      positionPopover(segment);
      if(focus)segment.focus({preventScroll:true});
      clearTimeout(hideTimer);
    }
    function indexAt(clientX){
      var rect=line.getBoundingClientRect(),ratio=(clientX-rect.left)/Math.max(1,rect.width);
      return Math.max(0,Math.min(segments.length-1,Math.floor(ratio*segments.length)));
    }
    function hideLater(){clearTimeout(hideTimer);hideTimer=setTimeout(function(){if(!scrubbing)popover.hidden=true;},2800);}

    line.onpointerdown=function(event){
      var segment=event.target.closest('.day-flow-segment');
      if(!segment)return;
      scrubbing=true;line.classList.add('is-scrubbing');line.setPointerCapture(event.pointerId);
      select(Number(segment.dataset.index));
      event.preventDefault();
    };
    line.onpointermove=function(event){if(scrubbing)select(indexAt(event.clientX));};
    line.onpointerup=line.onpointercancel=function(event){
      if(!scrubbing)return;
      scrubbing=false;line.classList.remove('is-scrubbing');
      if(line.hasPointerCapture(event.pointerId))line.releasePointerCapture(event.pointerId);
      hideLater();
    };
    line.onpointerover=function(event){if(event.pointerType==='mouse'&&!scrubbing){var segment=event.target.closest('.day-flow-segment');if(segment)select(Number(segment.dataset.index));}};
    line.onpointerleave=function(event){if(event.pointerType==='mouse'&&!scrubbing)hideLater();};
    line.onclick=function(event){var segment=event.target.closest('.day-flow-segment');if(segment){select(Number(segment.dataset.index),true);hideLater();}};
    line.onfocusin=function(event){var segment=event.target.closest('.day-flow-segment');if(segment)select(Number(segment.dataset.index));};
    line.onfocusout=hideLater;
    line.onkeydown=function(event){
      var segment=event.target.closest('.day-flow-segment');if(!segment)return;
      var index=Number(segment.dataset.index),next=index;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=index+1;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=index-1;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=segments.length-1;
      else return;
      event.preventDefault();select(next,true);
    };

    var first=new Date(result.timeline[0].time),last=new Date(result.timeline[result.timeline.length-1].time);last.setHours(last.getHours()+1);
    [6,12,18,24].forEach(function(offset){var source=offset===24?last:new Date(result.timeline[Math.min(offset,result.timeline.length-1)].time),label=document.createElement('span');label.className='day-flow-time-label';label.style.left=(offset/24*100)+'%';label.textContent=stamp(source,false);axis.appendChild(label);});
    var current=new Date(result.currentTime),span=last.getTime()-first.getTime();
    if(!Number.isNaN(current.getTime())&&span>0){var percent=Math.max(0,Math.min(100,(current.getTime()-first.getTime())/span*100));marker.style.left=percent+'%';marker.querySelector('[data-day-now-label]').textContent=stamp(current,true);marker.hidden=false;board.querySelector('[data-day-range-label]').textContent=stamp(current,true)+'부터 24시간';}
  }

  window.addEventListener('weatherhannun:data',function(event){latest=event.detail;render(latest);});
  window.addEventListener('weatherhannun:stitch-ready',function(){if(host&&host.isConnected)host.remove();host=null;if(latest)render(latest);});
})();
