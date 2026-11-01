(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherHannunBriefingHubCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const finite=value=>typeof value==="number"&&Number.isFinite(value);
  const number=(value,digits=0)=>finite(value)?value.toFixed(digits):"정보 없음";
  const maxKnown=values=>{const known=values.filter(finite);return known.length?Math.max(...known):null;};
  const minKnown=values=>{const known=values.filter(finite);return known.length?Math.min(...known):null;};
  const hourLabel=time=>typeof time==="string"&&time.length>=13?Number(time.slice(11,13))+"시":"시각 미상";
  function metrics(weather,core){
    const hours=core?.hoursOf?.(weather,36)||[];
    const next12=hours.slice(0,12),next24=hours.slice(0,24),night=hours.filter(x=>x.day===0).slice(0,12);
    return {hours,next12,next24,night,
      rain12:maxKnown(next12.map(x=>x.rain)),mm12:maxKnown(next12.map(x=>x.mm)),
      wind12:maxKnown(next12.map(x=>x.wind)),gust24:maxKnown(next24.map(x=>x.gust)),
      low24:minKnown(next24.map(x=>x.temp)),high24:maxKnown(next24.map(x=>x.temp))};
  }
  function build(payload){
    const core=typeof globalThis!=="undefined"&&globalThis.WeatherHannunBriefingCore;
    if(!core)return [];
    const base=core.analyse(payload),weather=payload?.weather,m=metrics(weather,core),where=base.where||payload?.loc?.name||"선택 지역";
    if(!base.valid)return [{id:"summary",icon:"view_agenda",title:"한눈 요약",caption:"지금 가장 중요한 변화",text:base.short,evidence:base.evidence||[]}];
    const firstRain=m.next12.find(x=>(finite(x.rain)&&x.rain>=50)||(finite(x.mm)&&x.mm>=.3));
    const commuteAction=firstRain?hourLabel(firstRain.time)+"부터 비 가능성이 있어 우산을 준비하세요.":m.next12.length===12?"12시간 안에 설정 기준을 넘는 강수 신호는 없습니다.":"강수 자료가 충분하지 않아 우산 필요 여부를 단정하지 않습니다.";
    const commute=`${where} 이동 브리핑입니다. ${commuteAction} 최대 풍속은 ${number(m.wind12)}킬로미터 매 시, 돌풍은 ${number(m.gust24)}킬로미터 매 시 예보입니다.`;
    const life=`${where} 생활 브리핑입니다. 앞으로 24시간 예상 기온은 최저 ${number(m.low24)}도, 최고 ${number(m.high24)}도입니다. 12시간 최고 강수확률은 ${number(m.rain12)}퍼센트, 시간당 최대 예상 강수량은 ${number(m.mm12,1)}밀리미터입니다.`;
    const caution=base.events.length?base.events.slice(0,3).map(x=>x.detail).join(" "):"예보 자료에서 설정 기준을 넘는 큰 변화는 확인되지 않았습니다. 공식 특보가 없다는 의미는 아닙니다.";
    const safety=`${where} 안전 브리핑입니다. ${caution} 공식 특보와 현장 상태를 함께 확인하세요.`;
    const farmRain=firstRain?"강수 신호가 있어 방제와 수확 작업 전 예보를 다시 확인하세요.":"강수 신호가 낮더라도 포장 상태와 최신 예보를 확인하세요.";
    const farming=`${where} 농작업 참고 브리핑입니다. ${farmRain} 24시간 최대 돌풍은 ${number(m.gust24)}킬로미터 매 시입니다. 이 안내는 모델 예보이며 작업 안전 판단을 대신하지 않습니다.`;
    const nightRows=m.night.length?m.night:m.next12;
    const nightLow=minKnown(nightRows.map(x=>x.temp)),nightRain=maxKnown(nightRows.map(x=>x.rain));
    const sleep=`${where} 취침 전 브리핑입니다. 밤 시간대 예상 최저 기온은 ${number(nightLow)}도, 최고 강수확률은 ${number(nightRain)}퍼센트입니다. 기상특보와 실내 환경은 별도로 확인하세요.`;
    const shared=[{label:"자료",value:"Open-Meteo 모델 예보"},{label:"관측 여부",value:"관측 실황 아님"}];
    return [
      {id:"summary",icon:"view_agenda",title:"한눈 요약",caption:"지금 가장 중요한 변화",text:base.detail,evidence:base.evidence},
      {id:"commute",icon:"directions_car",title:"출근·외출",caption:"비·바람·이동 준비",text:commute,evidence:shared},
      {id:"life",icon:"checkroom",title:"생활 준비",caption:"옷차림·우산·기온",text:life,evidence:shared},
      {id:"safety",icon:"shield",title:"안전 기상",caption:"강풍·저온·고온 변화",text:safety,evidence:shared},
      {id:"farming",icon:"agriculture",title:"농작업 참고",caption:"방제·수확·관수 판단",text:farming,evidence:shared},
      {id:"sleep",icon:"bedtime",title:"취침 전",caption:"밤 기온·강수 변화",text:sleep,evidence:shared}
    ];
  }
  function normalizeSettings(value){
    const valid=new Set(["summary","commute","life","safety","farming","sleep"]),types=Array.isArray(value?.types)?value.types.filter(x=>valid.has(x)):[];
    return {enabled:value?.enabled===true,types:types.length?types:["summary","commute","safety"],morning:value?.morning||"07:00",evening:value?.evening||"18:00",delivery:["notice","tap","auto"].includes(value?.delivery)?value.delivery:"tap"};
  }
  return Object.freeze({build,normalizeSettings,metrics});
});
