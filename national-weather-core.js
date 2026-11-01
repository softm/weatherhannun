/* 전국 날씨: 날짜와 대표 시각은 한국 표준시 기준. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WeatherNationalCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const cities=[
    ['백령',37.966,124.630,12,23],['서울',37.5665,126.978,38,25],
    ['춘천',37.8813,127.730,55,15],['강릉',37.7519,128.8761,71,25],
    ['울릉/독도',37.484,130.906,89,35],['수원',37.2636,127.0286,35,37],
    ['청주',36.6424,127.489,52,34],['안동',36.5684,128.7294,70,44],
    ['대전',36.3504,127.3845,47,48],['전주',35.8242,127.148,32,56],
    ['대구',35.8714,128.6014,63,57],['울산',35.5384,129.3114,81,65],
    ['광주',35.1595,126.8526,32,68],['목포',34.8118,126.3922,17,77],
    ['여수',34.7604,127.6622,49,78],['부산',35.1796,129.0756,71,76],
    ['제주',33.4996,126.5312,21,92]
  ].map(([name,lat,lon,x,y])=>({name,lat,lon,x,y,regionCenter:true}));
  function dates(now=new Date()){
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    return Array.from({length:7},(_,i)=>new Date(Date.parse(day+'T00:00:00+09:00')+i*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}));
  }
  function sample(payload,date,period,today){
    if(period==='current')return date===today?payload?.current||null:null;
    const hour=period==='morning'?'09:00':'15:00';
    const h=payload?.hourly,index=h?.time?.indexOf(date+'T'+hour);
    if(index===undefined||index<0)return null;
    const result={time:h.time[index]};
    ['temperature_2m','weather_code','is_day'].forEach(key=>result[key]=h[key]?.[index]);return result;
  }
  return {cities,dates,sample};
});
