/* 날씨한눈 활동 추천 규칙. 누락값을 0이나 안전한 값으로 대체하지 않는다. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherActivityCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const RULE_VERSION="WH-ACTIVITY-v2";
  const DEFINITIONS=Object.freeze({
    spray:Object.freeze({title:"농약 방제",icon:"🌿",category:"agri",hint:"바람·비·온도를 종합해 약제 비산 위험을 줄이는 데 참고하세요."}),
    harvest:Object.freeze({title:"수확·농작업",icon:"🌾",category:"agri",hint:"비와 고온, 강풍을 피할 수 있는 시간대를 찾습니다."}),
    irrigation:Object.freeze({title:"관수 참고",icon:"💧",category:"agri",hint:"강수·기온·습도·바람을 확인하는 작업 시간 참고이며, 토양수분이나 작물별 필요 수량을 판단하지 않습니다."}),
    walk:Object.freeze({title:"산책·외출",icon:"🚶",category:"outdoor",hint:"기온·비·자외선·바람을 고려합니다."}),
    laundry:Object.freeze({title:"빨래",icon:"👕",category:"daily",hint:"비가 적고 습도가 낮은 낮 시간대를 우선합니다."}),
    carwash:Object.freeze({title:"세차",icon:"🚗",category:"daily",hint:"당장뿐 아니라 다음 6시간의 강수 가능성도 확인합니다."})
  });
  const finite=value=>typeof value==="number"&&Number.isFinite(value);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const number=(value,decimals=0)=>finite(value)?value.toFixed(decimals):"정보 없음";
  const rainKnown=row=>!!row&&(finite(row.rain)||finite(row.mm));
  const windKnown=row=>!!row&&(finite(row.wind)||finite(row.gust));
  const maxKnown=(rows,key)=>{
    const values=rows.map(row=>row?.[key]).filter(finite);
    return values.length?Math.max(...values):null;
  };
  function missingFor(type,row,following){
    const missing=[];
    if(!rainKnown(row))missing.push("강수");
    if(!finite(row?.temp))missing.push("기온");
    if(["spray","harvest","walk","laundry","irrigation"].includes(type)&&!windKnown(row))missing.push("바람");
    if(["harvest","laundry","irrigation"].includes(type)&&!finite(row?.humidity))missing.push("습도");
    if(["spray","harvest","laundry","carwash","irrigation"].includes(type)&&row?.isDay!==0&&row?.isDay!==1)missing.push("낮/밤");
    if(["carwash","irrigation"].includes(type)){
      const rainRows=[row,...following.slice(0,6)].filter(rainKnown).length;
      if(rainRows<3)missing.push("이후 강수");
    }
    return [...new Set(missing)];
  }
  function unavailable(type,missing){
    const info=DEFINITIONS[type];
    return Object.freeze({
      version:RULE_VERSION,type,available:false,score:null,missing:Object.freeze(missing.slice()),
      reasons:Object.freeze([{label:"판단 자료 부족",detail:missing.join("·")+" 자료가 없어 안전한 시간 점수를 만들지 않습니다."}]),
      disclaimer:info?.hint||"필요한 예보 자료가 없습니다."
    });
  }
  function evaluate(type,row,following=[]){
    if(!DEFINITIONS[type])return unavailable(type,["지원 활동"]);
    const current=row&&typeof row==="object"?row:{};
    const future=Array.isArray(following)?following.filter(item=>item&&typeof item==="object"):[];
    const missing=missingFor(type,current,future);
    if(missing.length)return unavailable(type,missing);
    const rain=finite(current.rain)?current.rain:null;
    const mm=finite(current.mm)?current.mm:null;
    const wind=finite(current.wind)?current.wind:null;
    const gust=finite(current.gust)?current.gust:null;
    const humidity=finite(current.humidity)?current.humidity:null;
    const temp=current.temp;
    const daytime=current.isDay===1;
    let score=100;
    const reasons=[];
    const penalty=(points,label,detail)=>{score-=points;reasons.push({label,detail});};
    const rainAtLeast=(probability,amount)=>
      (finite(rain)&&rain>=probability)||(finite(mm)&&mm>=amount);
    const rainMaybe=probability=>finite(rain)&&rain>=probability;
    const peakWind=finite(wind)&&finite(gust)?Math.max(wind,gust):finite(wind)?wind:gust;

    if(type==="spray"){
      if(finite(wind)&&wind>=18)penalty(45,"강한 바람","평균풍속 "+number(wind)+" km/h — 비산 위험을 확인하세요.");
      else if(finite(wind)&&wind>=10)penalty(18,"바람 주의","평균풍속 "+number(wind)+" km/h — 현장 풍향 확인이 필요합니다.");
      if(finite(gust)&&gust>=25)penalty(28,"돌풍 위험","돌풍 "+number(gust)+" km/h 예보입니다.");
      if(rainAtLeast(40,.2))penalty(42,"강수 위험","강수확률 "+number(rain)+"%, 시간당 강수량 "+number(mm,1)+"mm 예보입니다.");
      else if(rainMaybe(20))penalty(16,"강수 가능성","강수확률 "+number(rain)+"% — 최신 예보를 다시 확인하세요.");
      if(temp>=30)penalty(19,"고온 주의","기온 "+number(temp)+"°C — 약해와 작업자 열 부담을 확인하세요.");
      if(!daytime)penalty(42,"야간 작업","방제는 밝은 시간에 현장 안전과 제품 표시사항을 확인하세요.");
    }else if(type==="harvest"){
      if(rainAtLeast(45,.4))penalty(44,"비에 의한 작업 위험","강수확률 "+number(rain)+"%, 시간당 강수량 "+number(mm,1)+"mm 예보입니다.");
      else if(rainMaybe(20))penalty(13,"약한 강수 가능성","당일 강수 예보를 다시 확인하세요.");
      if(peakWind>=30)penalty(23,"강풍 위험","바람·돌풍 최고 "+number(peakWind)+" km/h입니다.");
      if(temp>=31)penalty(21,"온열 부담","예상 기온 "+number(temp)+"°C입니다.");
      if(humidity>=90)penalty(11,"높은 습도","습도 "+number(humidity)+"% — 이슬·젖은 작물을 확인하세요.");
      if(!daytime)penalty(14,"야간 안전","야간 농작업은 조명과 안전 장비가 필요합니다.");
    }else if(type==="irrigation"){
      const rows=[current,...future.slice(0,6)];
      const futureRain=maxKnown(rows,"rain"),futureMm=maxKnown(rows,"mm");
      if((finite(futureRain)&&futureRain>=50)||(finite(futureMm)&&futureMm>=.3))penalty(55,"강수 예보","이후 6시간 최고 강수확률 "+number(futureRain)+"%, 시간당 강수량 "+number(futureMm,1)+"mm — 관수량을 현장에서 조정하세요.");
      else if((finite(futureRain)&&futureRain>=25)||(finite(futureMm)&&futureMm>=.1))penalty(22,"강수 가능성","이후 6시간 비 가능성이 있어 최신 예보와 토양 상태를 확인하세요.");
      if(temp>=30)penalty(22,"고온 증발 주의","기온 "+number(temp)+"°C — 작물별 적정 시간과 수량을 확인하세요.");
      if(temp<=4)penalty(25,"저온 관수 주의","기온 "+number(temp)+"°C — 결빙과 뿌리 스트레스를 확인하세요.");
      if(humidity>=90)penalty(14,"높은 습도","습도 "+number(humidity)+"% — 병해 위험과 잎 젖음 시간을 확인하세요.");
      if(peakWind>=25)penalty(18,"바람 주의","바람·돌풍 최고 "+number(peakWind)+" km/h — 살수 편차를 확인하세요.");
      if(!daytime)penalty(12,"야간 작업 안전","야간 작업이면 조명과 이동 안전을 우선하세요.");
    }else if(type==="walk"){
      if(rainAtLeast(45,.4))penalty(40,"비 예보","강수확률 "+number(rain)+"%, 시간당 강수량 "+number(mm,1)+"mm입니다.");
      else if(rainMaybe(20))penalty(13,"비 가능성","강수확률 "+number(rain)+"% — 우산을 준비할 수 있습니다.");
      if(peakWind>=35)penalty(24,"바람 강함","바람·돌풍 최고 "+number(peakWind)+" km/h입니다.");
      if(temp<4||temp>32)penalty(33,"기온 부담","기온 "+number(temp)+"°C입니다.");
      else if(temp<9||temp>29)penalty(12,"체감 주의","기온 "+number(temp)+"°C입니다.");
      if(finite(current.uv)&&current.uv>=7)penalty(23,"자외선 강함","자외선 지수 "+number(current.uv,1)+" — 자외선 차단을 권합니다.");
    }else if(type==="laundry"){
      if(rainAtLeast(35,.3))penalty(54,"비 예보","강수확률 "+number(rain)+"%, 시간당 강수량 "+number(mm,1)+"mm입니다.");
      else if(rainMaybe(15))penalty(22,"강수 가능성","강수확률 "+number(rain)+"% — 실내 이동을 준비하세요.");
      if(humidity>80)penalty(28,"높은 습도","습도 "+number(humidity)+"%로 건조에 불리합니다.");
      else if(humidity>65)penalty(12,"습도 보통","습도 "+number(humidity)+"%입니다.");
      if(!daytime)penalty(17,"햇빛 부족","야간에는 건조가 느릴 수 있습니다.");
      if(peakWind>=35)penalty(16,"강풍 주의","바람·돌풍 최고 "+number(peakWind)+" km/h — 빨래를 고정하세요.");
    }else if(type==="carwash"){
      const rows=[current,...future.slice(0,6)];
      const futureRain=maxKnown(rows,"rain"),futureMm=maxKnown(rows,"mm");
      if((finite(futureRain)&&futureRain>=45)||(finite(futureMm)&&futureMm>=.4))penalty(58,"세차 후 비 가능성","이후 6시간 최고 강수확률 "+number(futureRain)+"%, 시간당 강수량 "+number(futureMm,1)+"mm입니다.");
      else if(finite(futureRain)&&futureRain>=20)penalty(24,"강수 변동 위험","이후 6시간 최고 강수확률 "+number(futureRain)+"%입니다.");
      if(temp<=1)penalty(38,"결빙 위험","기온 "+number(temp)+"°C — 물기 결빙 우려가 있습니다.");
      if(!daytime)penalty(18,"야간 세차","시야와 주변 안전을 위해 낮 시간을 우선하세요.");
    }
    if(!reasons.length)reasons.push({label:"확인한 기상 위험 낮음",detail:"현재 확보된 필수 예보값에서 이 활동의 큰 위험 신호는 낮습니다. 공식 특보와 현장 상태는 별도로 확인하세요."});
    const ceiling=type==="spray"?85:type==="irrigation"?80:100;
    return Object.freeze({version:RULE_VERSION,type,available:true,score:clamp(Math.round(score),0,ceiling),missing:Object.freeze([]),reasons:Object.freeze(reasons.map(Object.freeze)),disclaimer:DEFINITIONS[type].hint});
  }
  return Object.freeze({RULE_VERSION,DEFINITIONS,evaluate});
});
