/* 모델 예보를 3문장 생활 요약과 24시간 흐름으로 변환하는 순수 계산 모듈. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WeatherDayFlowCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function finite(v){return typeof v==='number'&&Number.isFinite(v);}
  function number(v,d){return finite(v)?v.toFixed(d||0).replace(/\.0+$/,''):'--';}
  function cell(a,i){return Array.isArray(a)?a[i]:undefined;}
  function hour(t){return typeof t==='string'&&t.includes('T')?t.slice(11,13)+'시':'시간 미상';}
  function validTime(value){var date=value instanceof Date?value:new Date(value);return Number.isNaN(date.getTime())?null:date;}
  function rows(weather,limit,referenceTime){
    var h=weather&&weather.hourly||{},times=h.time||[],reference=validTime(referenceTime)||new Date(),hourStart=new Date(reference.getTime());
    hourStart.setMinutes(0,0,0);
    var start=times.findIndex(function(t){var date=validTime(t);return date&&date.getTime()>=hourStart.getTime();});
    if(start<0){var last=validTime(times[times.length-1]);if(last&&last.getTime()<hourStart.getTime())return [];start=0;}
    return times.slice(start,start+(limit||24)).map(function(time,offset){var i=start+offset;return {time:time,temp:cell(h.temperature_2m,i),rain:cell(h.precipitation_probability,i),mm:cell(h.precipitation,i),wind:cell(h.wind_speed_10m,i),gust:cell(h.wind_gusts_10m,i),code:cell(h.weather_code,i),isDay:cell(h.is_day,i)};});
  }
  function kind(row){
    if((finite(row.rain)&&row.rain>=50)||(finite(row.mm)&&row.mm>=.3))return 'rain';
    if((finite(row.gust)&&row.gust>=35)||(finite(row.wind)&&row.wind>=25))return 'wind';
    if(finite(row.temp)&&row.temp<=3)return 'cold';
    if(finite(row.temp)&&row.temp>=30)return 'heat';
    return 'good';
  }
  function nextChange(items){var initial=items.length?kind(items[0]):'';for(var i=1;i<items.length;i++)if(kind(items[i])!==initial)return {row:items[i],to:kind(items[i])};return null;}
  function action(items,current){
    var firstRain=items.slice(0,12).find(function(row){return kind(row)==='rain';}),parts=[];
    if(finite(current&&current.apparent_temperature)&&current.apparent_temperature<=5)parts.push('따뜻한 겉옷');
    else if(finite(current&&current.apparent_temperature)&&current.apparent_temperature>=28)parts.push('가벼운 옷차림');else parts.push('현재 기온에 맞는 겉옷');
    if(firstRain)parts.push(hour(firstRain.time)+' 전 우산');
    if(finite(current&&current.wind_speed_10m)&&current.wind_speed_10m>=25)parts.push('강풍 주의');
    if(!firstRain&&!(finite(current&&current.wind_speed_10m)&&current.wind_speed_10m>=25))parts.push('우산 부담 낮음');
    return parts.join(' · ');
  }
  function build(payload){
    var weather=payload&&payload.weather,reference=validTime(payload&&payload.now)||new Date(),items=rows(weather,24,reference),c=weather&&weather.current||{},change=nextChange(items),labels={rain:'비 가능성',wind:'강한 바람',cold:'추위',heat:'더위',good:'활동하기 무난한 날씨'};
    var now=finite(c.temperature_2m)?number(c.temperature_2m,1)+'℃'+(finite(c.apparent_temperature)?' · 체감 '+number(c.apparent_temperature,1)+'℃':''):'현재 기온 자료 없음';
    var changeText=change?hour(change.row.time)+' '+labels[change.to]+' 전환':items.length>=12?'12시간 큰 변화 없음':'다음 변화 판단 불가';
    var sample=items.slice(0,12),complete=sample.length===12&&sample.every(function(r){return finite(r.temp)&&finite(r.rain)&&finite(r.mm)&&finite(r.wind);});
    return {now:now,change:changeText,action:action(items,c),currentTime:reference.toISOString(),confidence:{level:complete?'보통':'낮음',detail:complete?'시간별 모델 예보 자료 완전':'12시간 자료 일부 누락'},source:'모델 예보 · 관측소 실측 아님',timeline:items.map(function(r){return Object.assign({},r,{kind:kind(r),label:hour(r.time)});})};
  }
  return Object.freeze({build:build,rows:rows,kind:kind});
});
