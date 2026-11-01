(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WeatherHourlyExplorerCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const format=(x,d=0)=>finite(x)?x.toFixed(d):'--';
 function rows(weather){
  const h=weather?.hourly;if(!Array.isArray(h?.time))return [];
  const now=weather.current?.time?.slice(0,13)||'';
  const start=h.time.findIndex(t=>t.slice(0,13)>=now);if(start<0)return [];
  return h.time.slice(start,start+168).map((time,i)=>{const k=start+i;return {time,temp:h.temperature_2m?.[k],rain:h.precipitation_probability?.[k],mm:h.precipitation?.[k],code:h.weather_code?.[k],isDay:h.is_day?.[k],wind:h.wind_speed_10m?.[k],gust:h.wind_gusts_10m?.[k],humidity:h.relative_humidity_2m?.[k],feels:h.apparent_temperature?.[k],uv:h.uv_index?.[k]};});
 }
 function range(all,period,start,end){return period==='custom'?all.filter(x=>x.time.slice(0,10)>=start&&x.time.slice(0,10)<=end):all.slice(0,[24,48,72,168].includes(Number(period))?Number(period):24);}
 function label(time){return time.slice(5,10).replace('-','/')+' '+time.slice(11,16);}
 return {finite,format,rows,range,label};
});
