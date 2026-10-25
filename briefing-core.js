/* 날씨한눈: deterministic weather briefing rules — model forecast, NOT observations.
 * Pure functions, tested without network or browser. Keep safety claims conservative.
 */
(function(root, factory) {
  "use strict";
  var api=factory();
  if (typeof module==="object" && module.exports) module.exports=api;
  if (root) root.WeatherHannunBriefingCore=api;
})(typeof globalThis!=="undefined"?globalThis:this, function() {
  "use strict";
  function finite(value){return typeof value==="number" && Number.isFinite(value);}
  function asNumber(value,digits){return finite(value)?value.toFixed(digits===undefined?0:digits):"정보 없음";}
  function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
  function dateText(time){if(typeof time!=="string"||time.length<13)return "시각 확인 필요";return Number(time.slice(5,7))+"월 "+Number(time.slice(8,10))+"일 "+time.slice(11,13)+"시";}
  function weatherText(code){
    if(!finite(code))return "하늘 상태 정보가 없고";
    if(code===0)return "맑고";
    if(code===1||code===2)return "대체로 맑거나 구름이 조금 있고";
    if(code===3)return "흐리고";
    if(code===45||code===48)return "안개가 예상되고";
    if(code>=51&&code<=67||code>=80&&code<=82)return "비가 예상되고";
    if(code>=71&&code<=77||code>=85&&code<=86)return "눈이 예상되고";
    if(code>=95)return "뇌우 가능성이 있고";
    return "날씨가 변동할 수 있고";
  }
  function hoursOf(weather,limit) {
    if(!weather||!weather.hourly||!Array.isArray(weather.hourly.time))return [];
    var h=weather.hourly,arr=h.time;
    var current=weather.current&&weather.current.time?weather.current.time.slice(0,13):"";
    var start=arr.findIndex(function(t){return typeof t==="string"&&t.slice(0,13)>=current;});
    if(start<0) return [];
    return arr.slice(start,start+(limit||48)).map(function(time,i) {
      var k=start+i;
      return {time:time,
        temp:h.temperature_2m&&h.temperature_2m[k],
        rain:h.precipitation_probability&&h.precipitation_probability[k],
        mm:h.precipitation&&h.precipitation[k],
        wind:h.wind_speed_10m&&h.wind_speed_10m[k],
        gust:h.wind_gusts_10m&&h.wind_gusts_10m[k],
        uv:h.uv_index&&h.uv_index[k],
        day:h.is_day&&h.is_day[k],
        code:h.weather_code&&h.weather_code[k]
      };
    });
  }
  function dataFreshness(fetchedAt,now) {
    if(!fetchedAt)return {state:"unknown",label:"조회 시각 확인 필요",ageMinutes:null};
    var stamp=Date.parse(fetchedAt);
    if(!Number.isFinite(stamp))return {state:"unknown",label:"조회 시각 확인 필요",ageMinutes:null};
    var age=Math.max(0,Math.round(((finite(now)?now:Date.now())-stamp)/60000));
    if(age>180)return {state:"stale",label:"3시간 이전에 조회한 저장 예보",ageMinutes:age};
    return {state:"recent",label:"최근 조회한 예보",ageMinutes:age};
  }
  function analyse(payload,options) {
    var weather=payload&&payload.weather;
    var loc=payload&&payload.loc;
    var c=weather&&weather.current;
    var h=hoursOf(weather,48);
    var fresh=dataFreshness(payload&&payload.at,options&&options.now);
    var where=loc&&typeof loc.name==="string"?loc.name:"선택 지역";
    if(!weather||!c||!h.length) return {
      valid:false,headline:"예보를 불러오는 중입니다.",
      short:"예보가 준비되지 않아 날씨 변화를 판단할 수 없습니다.",
      detail:"지역과 네트워크 상태를 확인한 뒤 다시 조회해 주세요.",
      events:[],evidence:[],freshness:fresh,source:"Open-Meteo 모델 예보"
    };
    var events=[];
    var firstRain=h.slice(0,24).find(function(x){return (finite(x.rain)&&x.rain>=55)||(finite(x.mm)&&x.mm>=0.3);});
    if(firstRain){
      var rainEx=finite(firstRain.rain)?"강수확률 "+asNumber(firstRain.rain)+"%":"강수확률 정보 없음";
      if(finite(firstRain.mm))rainEx+=" · 시간당 예상 강수량 "+asNumber(firstRain.mm,1)+"mm";
      events.push({id:"rain",icon:"☂",severity:"caution",title:"비 가능성 증가",time:firstRain.time,detail:dateText(firstRain.time)+"부터 강수 가능성이 높아집니다. "+rainEx+" · 외출과 야외 작업 시 예보를 재확인하세요.",evidence:rainEx});
    }
    var highGust=h.slice(0,24).find(function(x){return (finite(x.gust)&&x.gust>=40)||(finite(x.wind)&&x.wind>=30);});
    if(highGust){
      var windText=finite(highGust.gust)?"돌풍 "+asNumber(highGust.gust)+"km/h":"평균풍속 "+asNumber(highGust.wind)+"km/h";
      events.push({id:"wind",icon:"≋",severity:"caution",title:"바람 강해질 가능성",time:highGust.time,detail:dateText(highGust.time)+" 무렵 "+windText+"가 예보됩니다. 이동과 시설물 관리에 유의하세요.",evidence:windText});
    }
    var cold=h.slice(0,36).find(function(x){return finite(x.temp)&&x.temp<=2;});
    if(cold)events.push({id:"cold",icon:"❄",severity:"caution",title:"저온 주의",time:cold.time,detail:dateText(cold.time)+" 무렵 기온 "+asNumber(cold.temp)+"°C 예보. 결빙·서리 여부는 현장 지표면 상태를 별도 확인하세요.",evidence:"기온 "+asNumber(cold.temp)+"°C"});
    var firstHot=h.slice(0,24).find(function(x){return finite(x.temp)&&x.temp>=32;});
    if(firstHot)events.push({id:"heat",icon:"☀",severity:"caution",title:"고온 부담",time:firstHot.time,detail:dateText(firstHot.time)+" 무렵 "+asNumber(firstHot.temp)+"°C 예보. 야외활동 중 휴식과 수분 섭취에 신경 쓰세요.",evidence:"기온 "+asNumber(firstHot.temp)+"°C"});
    var origin=finite(c.temperature_2m)?c.temperature_2m:h[0].temp;
    var latest=h.find(function(x,i){return i>=6&&finite(x.temp);});
    if(finite(origin)&&latest&&finite(latest.temp)){
      var change=latest.temp-origin;
      if(Math.abs(change)>=6)events.push({id:"swing",icon:"↕",severity:"info",title:change<0?"기온 하락 예상":"기온 상승 예상",time:latest.time,detail:dateText(latest.time)+"까지 현재 모델값 대비 약 "+asNumber(Math.abs(change))+"°C "+(change<0?"떨어질":"오를")+" 수 있습니다.",evidence:"기온 변화 "+(change>0?"+":"")+asNumber(change)+"°C"});
    }
    events.sort(function(a,b){return a.time.localeCompare(b.time);});
    var important=events.filter(function(x){return x.severity==="caution";});
    var lead=important[0]||events[0];
    var nowTemp=finite(c.temperature_2m)?asNumber(c.temperature_2m)+"°C":"기온 정보 없음";
    var start=where+"의 현재 모델 예보는 "+weatherText(c.weather_code)+" 기온은 "+nowTemp+"입니다.";
    var short=lead?start+" "+lead.title+" — "+dateText(lead.time)+"을 확인해 주세요.":start+" 향후 24시간의 주요 위험 기준에 해당하는 변화는 발견되지 않았습니다.";
    var d=weather.daily||{};
    var dayLow=d.temperature_2m_min&&d.temperature_2m_min[0];
    var dayHigh=d.temperature_2m_max&&d.temperature_2m_max[0];
    var range=finite(dayLow)&&finite(dayHigh)?" 오늘 예상 최고 "+asNumber(dayHigh)+"°C, 최저 "+asNumber(dayLow)+"°C입니다.":"";
    var nextEvents=events.slice(0,3).map(function(e){return e.detail;}).join(" ");
    var detail=short+range+(nextEvents?" "+nextEvents:"")+" 기상특보 실시간 연동은 아직 없어 공식 특보를 별도로 확인해야 합니다.";
    var evidence=[
      {label:"현재 기온 (모델)",value:nowTemp},
      {label:"12시간 최고 강수확률",value:(function(){var xs=h.slice(0,12).map(function(x){return x.rain;}).filter(finite);return xs.length?asNumber(Math.max.apply(null,xs))+"%":"정보 없음";})()},
      {label:"24시간 최대 돌풍",value:(function(){var xs=h.slice(0,24).map(function(x){return x.gust;}).filter(finite);return xs.length?asNumber(Math.max.apply(null,xs))+"km/h":"정보 없음";})()},
      {label:"예보 유효 시각",value:typeof c.time==="string"?c.time.replace("T"," ")+" KST":"정보 없음"}
    ];
    var air=payload&&payload.air&&payload.air.current;
    if(air&&finite(air.pm2_5))evidence.push({label:"PM2.5 (모델 예측)",value:asNumber(air.pm2_5,1)+" μg/m³"});
    return {valid:true,headline:lead?lead.title:"가까운 시간의 뚜렷한 위험 신호 낮음",short:short,detail:detail,events:events.slice(0,5),evidence:evidence,freshness:fresh,source:"Open-Meteo 모델 예보",where:where,validAt:c.time||null};
  }
  return Object.freeze({analyse:analyse,hoursOf:hoursOf,dataFreshness:dataFreshness,dateText:dateText});
});