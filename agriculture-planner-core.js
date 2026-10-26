/* WH-P02 agricultural weather planning rules. Missing data never becomes a safe verdict. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherAgriculturePlannerCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CONTRACT_VERSION="WH-P02-RISK-v1";
  const MIN_WORK_WINDOW_SCORE=60;
  const SOURCE_LINKS=Object.freeze({
    fruitFlowering:Object.freeze({
      title:"농촌진흥청·전북특별자치도농업기술원 과수 개화기 저온 기준",
      url:"https://www.rda.go.kr/board/board.do?boardId=farmlcltinfo&dataNo=100000802119&mode=updateCnt&prgId=day_farmlcltinfoEntry"
    }),
    riceLow:Object.freeze({
      title:"농사로 벼 생육단계별 저온 장해 참고",
      url:"https://nongsaro.go.kr/portal/ps/psz/psza/contentSub.ps?cntntsNo=207427&menuId=PS00077"
    }),
    riceHeat:Object.freeze({
      title:"농촌진흥청·충남도농업기술원 벼 출수기 고온 기준",
      url:"https://rda.go.kr/board/board.do?boardId=farmlcltinfo&dataNo=100000812378&mode=updateCnt&prgId=day_farmlcltinfoEntry"
    })
  });
  const CROPS=Object.freeze({
    rice:Object.freeze({name:"벼",stages:Object.freeze({
      growth:"활착·분얼기",meiosis:"감수분열기",flowering:"출수·개화기",ripening:"등숙기",harvest:"수확기"
    })}),
    apple:Object.freeze({name:"사과",stages:Object.freeze({dormant:"휴면·발아 전",bud:"발아·꽃봉오리",flowering:"개화기",fruit:"과실 비대기",harvest:"수확기"})}),
    pear:Object.freeze({name:"배",stages:Object.freeze({dormant:"휴면·발아 전",bud:"발아·전엽기",flowering:"개화기",fruit:"과실 비대기",harvest:"수확기"})}),
    grape:Object.freeze({name:"포도",stages:Object.freeze({dormant:"휴면기",bud:"발아기",flowering:"개화기",fruit:"과실 비대기",harvest:"수확기"})}),
    peach:Object.freeze({name:"복숭아",stages:Object.freeze({dormant:"휴면기",bud:"발아기",flowering:"개화기",fruit:"과실 비대기",harvest:"수확기"})})
  });
  const PROFILES=Object.freeze({
    "rice:growth":Object.freeze({low:Object.freeze({value:17,source:SOURCE_LINKS.riceLow,label:"17°C 이하 저온 신호"})}),
    "rice:meiosis":Object.freeze({
      low:Object.freeze({value:17,source:SOURCE_LINKS.riceLow,label:"17°C 이하 저온 신호"}),
      high:Object.freeze({value:38,source:SOURCE_LINKS.riceHeat,label:"38°C 이상 고온 신호"})
    }),
    "rice:flowering":Object.freeze({high:Object.freeze({value:35,source:SOURCE_LINKS.riceHeat,label:"35°C 이상 고온 신호"})}),
    "apple:flowering":Object.freeze({low:Object.freeze({value:-2.2,source:SOURCE_LINKS.fruitFlowering,label:"-2.2°C 이하 개화기 저온 신호"})}),
    "pear:flowering":Object.freeze({low:Object.freeze({value:-1.9,source:SOURCE_LINKS.fruitFlowering,label:"-1.9°C 이하 개화기 저온 신호"})}),
    "grape:flowering":Object.freeze({low:Object.freeze({value:-0.6,source:SOURCE_LINKS.fruitFlowering,label:"-0.6°C 이하 개화기 저온 신호"})}),
    "peach:flowering":Object.freeze({low:Object.freeze({value:-1.1,source:SOURCE_LINKS.fruitFlowering,label:"-1.1°C 이하 개화기 저온 신호"})})
  });
  const finite=value=>typeof value==="number"&&Number.isFinite(value);
  const number=(value,decimals=0)=>finite(value)?value.toFixed(decimals):"자료 없음";
  const cell=(values,index)=>Array.isArray(values)&&finite(values[index])?values[index]:null;
  function normalizeForecast(payload,limit=48){
    const hourly=payload&&payload.hourly;
    if(!hourly||!Array.isArray(hourly.time))return Object.freeze([]);
    const current=typeof payload.current?.time==="string"?payload.current.time.slice(0,13):"";
    let start=current?hourly.time.findIndex(time=>typeof time==="string"&&time.slice(0,13)>=current):0;
    if(start<0)start=0;
    return Object.freeze(hourly.time.slice(start,start+Math.max(1,Math.min(168,Number(limit)||48))).map((time,offset)=>{
      const index=start+offset;
      return Object.freeze({
        index:offset,time:typeof time==="string"?time:"",
        temp:cell(hourly.temperature_2m,index),rain:cell(hourly.precipitation_probability,index),
        mm:cell(hourly.precipitation,index),wind:cell(hourly.wind_speed_10m,index),
        gust:cell(hourly.wind_gusts_10m,index),humidity:cell(hourly.relative_humidity_2m,index),
        isDay:Array.isArray(hourly.is_day)&&(hourly.is_day[index]===0||hourly.is_day[index]===1)?hourly.is_day[index]:null
      });
    }));
  }
  function groups(rows,predicate){
    const output=[];let group=[];
    rows.forEach(row=>{
      if(predicate(row)){group.push(row);return;}
      if(group.length){output.push(group);group=[];}
    });
    if(group.length)output.push(group);
    return output;
  }
  function period(group){return {start:group[0].time,end:group[group.length-1].time,hours:group.length};}
  function riskFromTemperature(rows,kind,rule){
    if(!rule)return [];
    return groups(rows,row=>finite(row.temp)&&(kind==="low"?row.temp<=rule.value:row.temp>=rule.value)).map(group=>{
      const values=group.map(row=>row.temp).filter(finite);
      const observed=kind==="low"?Math.min(...values):Math.max(...values);
      return Object.freeze({
        type:kind==="low"?"crop_low_temperature":"crop_high_temperature",severity:"high",
        title:rule.label,evidence:`모델 예보 ${kind==="low"?"최저":"최고"} ${number(observed,1)}°C`,
        threshold:rule.value,metric:"temperature_2m",source:rule.source,...period(group)
      });
    });
  }
  function genericRisks(rows){
    const rain=groups(rows,row=>(finite(row.rain)&&row.rain>=50)||(finite(row.mm)&&row.mm>=.3)).map(group=>{
      const probabilities=group.map(row=>row.rain).filter(finite),amounts=group.map(row=>row.mm).filter(finite);
      const evidence=[];
      if(probabilities.length)evidence.push(`최고 강수확률 ${number(Math.max(...probabilities))}%`);
      if(amounts.length)evidence.push(`최대 시간당 ${number(Math.max(...amounts),1)}mm`);
      return Object.freeze({type:"rain_work_signal",severity:"caution",title:"강수 작업 신호",evidence:evidence.join(" · ")||"강수 신호",threshold:"50% 또는 0.3mm/h",metric:"precipitation",source:null,...period(group)});
    });
    const gust=groups(rows,row=>finite(row.gust)&&row.gust>=35).map(group=>{
      const maximum=Math.max(...group.map(row=>row.gust).filter(finite));
      return Object.freeze({type:"gust_work_signal",severity:"caution",title:"돌풍 작업 신호",evidence:`최대 돌풍 ${number(maximum)}km/h`,threshold:35,metric:"wind_gusts_10m",source:null,...period(group)});
    });
    return rain.concat(gust).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  }
  function coverage(rows){
    const count=key=>rows.filter(row=>finite(row[key])).length;
    return Object.freeze({hours:rows.length,temperature:count("temp"),rainProbability:count("rain"),precipitation:count("mm"),wind:count("wind"),gust:count("gust"),humidity:count("humidity")});
  }
  function workWindows(rows,activityCore,type){
    if(!activityCore||typeof activityCore.evaluate!=="function"||!["spray","harvest","irrigation"].includes(type))return Object.freeze([]);
    const candidates=[];
    for(let index=0;index<=rows.length-3;index+=1){
      const evaluated=[index,index+1,index+2].map(position=>activityCore.evaluate(type,rows[position],rows.slice(position+1,position+7)));
      if(evaluated.some(result=>!result?.available||!finite(result.score)))continue;
      const score=Math.round(evaluated.reduce((sum,result)=>sum+result.score,0)/evaluated.length);
      if(score<MIN_WORK_WINDOW_SCORE)continue;
      candidates.push({type,start:rows[index].time,end:rows[index+2].time,score,reasons:evaluated[0].reasons||[]});
    }
    const selected=[];
    candidates.sort((a,b)=>b.score-a.score||String(a.start).localeCompare(String(b.start))).forEach(candidate=>{
      const start=rows.findIndex(row=>row.time===candidate.start);
      if(selected.some(item=>Math.abs(item.index-start)<3)||selected.length>=3)return;
      selected.push({...candidate,index:start});
    });
    return Object.freeze(selected.sort((a,b)=>String(a.start).localeCompare(String(b.start))).map(item=>Object.freeze({type:item.type,start:item.start,end:item.end,score:item.score,reasons:Object.freeze(item.reasons)})));
  }
  function evaluate(payload,{crop="rice",stage="growth",activityCore=null}={}){
    const cropInfo=CROPS[crop];
    const stageName=cropInfo&&cropInfo.stages[stage];
    const rows=normalizeForecast(payload,48);
    if(!cropInfo||!stageName)return Object.freeze({version:CONTRACT_VERSION,available:false,reason:"지원하지 않는 작물·생육단계입니다.",risks:Object.freeze([]),windows:Object.freeze({}),coverage:coverage(rows)});
    if(!rows.length)return Object.freeze({version:CONTRACT_VERSION,available:false,reason:"시간별 예보 자료가 없습니다.",crop,cropName:cropInfo.name,stage,stageName,risks:Object.freeze([]),windows:Object.freeze({}),coverage:coverage(rows)});
    const profile=PROFILES[`${crop}:${stage}`]||null;
    const risks=[...riskFromTemperature(rows,"low",profile?.low),...riskFromTemperature(rows,"high",profile?.high),...genericRisks(rows)]
      .sort((a,b)=>String(a.start).localeCompare(String(b.start)));
    const windows={};
    ["spray","harvest","irrigation"].forEach(type=>{windows[type]=workWindows(rows,activityCore,type);});
    return Object.freeze({
      version:CONTRACT_VERSION,available:true,crop,cropName:cropInfo.name,stage,stageName,
      cropRuleAvailable:!!profile,
      profileMessage:profile?"공식 공개자료의 단계별 기온 기준을 적용했습니다.":"이 작물·단계의 검증된 전용 온도 기준이 없어 공통 강수·돌풍 신호만 표시합니다.",
      risks:Object.freeze(risks),windows:Object.freeze(windows),coverage:coverage(rows)
    });
  }
  function report({site="선택 지역",result,generatedAt="",sourceLabel="모델 예보"}={}){
    if(!result?.available)return "농업 기상 위험 리포트를 만들 수 없습니다.\n"+(result?.reason||"예보 자료 부족");
    const lines=[
      "날씨한눈 농업 Premium 기상 위험 리포트",
      `지역: ${String(site).slice(0,75)}`,
      `작물·단계: ${result.cropName} · ${result.stageName}`,
      `생성시각: ${String(generatedAt||"확인 필요").slice(0,60)}`,
      `자료: ${String(sourceLabel).slice(0,80)}`,
      `규칙: ${result.version}`,
      "",
      result.profileMessage,
      ""
    ];
    if(result.risks.length){
      lines.push("[기상 위험 신호]");
      result.risks.forEach(item=>lines.push(`- ${item.start}~${item.end}: ${item.title} · ${item.evidence}`));
    }else lines.push("[기상 위험 신호]\n- 확보된 값에서 설정 기준을 넘는 신호가 없었습니다. 결측·국지 기상·공식 특보는 별도로 확인하세요.");
    ["spray","harvest","irrigation"].forEach(type=>{
      const title={spray:"방제 참고",harvest:"수확·농작업",irrigation:"관수 참고"}[type];
      lines.push("",`[${title} 참고 시간 · ${MIN_WORK_WINDOW_SCORE}점 이상]`);
      const windows=result.windows[type]||[];
      if(!windows.length)lines.push("- 필수 예보값이 부족하거나 적합 구간을 계산하지 못했습니다.");
      else windows.forEach(item=>lines.push(`- ${item.start}~${item.end}: ${item.score}점`));
    });
    const sources=[...new Map(result.risks.filter(item=>item.source).map(item=>[item.source.url,item.source])).values()];
    if(sources.length){lines.push("","[공식 기준 출처]");sources.forEach(source=>lines.push(`- ${source.title}: ${source.url}`));}
    lines.push("","주의: 모델 예보 기반 사전 점검 자료입니다. 실제 작물 상태, 포장 미기상, 토양수분, 등록 농약 표시사항, 공식 특보와 농업기술센터 지도를 우선하세요.");
    return lines.join("\n");
  }
  return Object.freeze({CONTRACT_VERSION,MIN_WORK_WINDOW_SCORE,SOURCE_LINKS,CROPS,normalizeForecast,evaluate,workWindows,report});
});
