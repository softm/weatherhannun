(function(){
  "use strict";
  const core=window.WeatherAgriculturePlannerCore;
  const provider=window.WeatherProviderCore;
  const activityCore=window.WeatherActivityCore;
  const state={membership:null,current:null,sites:[],reports:[]};
  const element=id=>document.getElementById(id);
  const node=(tag,className,text)=>{const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;};
  const finite=value=>typeof value==="number"&&Number.isFinite(value);
  function locationKey(place){
    const lat=Number(place?.lat),lon=Number(place?.lon);
    return finite(lat)&&finite(lon)?`${lat.toFixed(3)}:${lon.toFixed(3)}`:"";
  }
  function samePlace(a,b){const left=locationKey(a),right=locationKey(b);return !!left&&left===right;}
  function releaseAllowed(){
    try{return provider?.releaseReadiness?.().subscriptions?.allowed===true;}catch(_){return false;}
  }
  function entitled(){return state.membership?.plans?.agriculture?.entitled===true;}
  function usable(){return entitled()&&releaseAllowed();}
  function readSavedPlaces(){
    try{
      const raw=JSON.parse(localStorage.getItem("weatherhannun_places_v2")||"[]");
      return Array.isArray(raw)?raw:[];
    }catch(_){return [];}
  }
  function collectSites(){
    const output=[],seen=new Set();
    [state.current?.loc,...readSavedPlaces()].filter(Boolean).forEach(place=>{
      const key=locationKey(place);
      if(!key||seen.has(key)||output.length>=10)return;
      seen.add(key);
      output.push({key,name:String(place.name||"선택 지역").trim().slice(0,75)||"선택 지역",lat:Number(place.lat),lon:Number(place.lon),current:samePlace(place,state.current?.loc),regionCenter:place.regionCenter===true,approximate:place.approximate===true});
    });
    state.sites=output;
  }
  function populateCrops(){
    const crop=element("agricultureCrop");if(!crop||!core)return;
    crop.replaceChildren();
    Object.entries(core.CROPS).forEach(([id,info])=>{const option=node("option","",info.name);option.value=id;crop.append(option);});
    crop.value="rice";populateStages();
  }
  function populateStages(){
    const crop=element("agricultureCrop"),stage=element("agricultureStage");
    if(!crop||!stage||!core)return;
    const info=core.CROPS[crop.value]||core.CROPS.rice;
    const previous=stage.value;
    stage.replaceChildren();
    Object.entries(info.stages).forEach(([id,label])=>{const option=node("option","",label);option.value=id;stage.append(option);});
    if([...stage.options].some(option=>option.value===previous))stage.value=previous;
  }
  function renderSites(){
    collectSites();
    const target=element("agricultureSites");if(!target)return;
    target.replaceChildren();
    if(!state.sites.length){target.append(node("span","","현재 지역 또는 저장 지역이 필요합니다."));return;}
    state.sites.forEach((site,index)=>{
      const label=node("label","agriculture-site-option");
      const input=document.createElement("input");input.type="checkbox";input.dataset.siteKey=site.key;input.checked=index===0;input.disabled=!usable();
      const copy=node("span");copy.append(node("b","",site.name));
      const kind=site.current?"현재 선택":site.regionCenter?"행정구역 대표 위치":site.approximate?"GPS 주변 위치":"저장 지역";
      copy.append(node("small","",kind));label.append(input,copy);target.append(label);
    });
  }
  function renderGate(){
    const controls=element("agriculturePlannerControls"),badge=element("agriculturePlannerBadge"),status=element("agriculturePlannerStatus");
    if(controls)controls.disabled=!usable();
    if(badge)badge.textContent=usable()?"사용 가능":entitled()?"데이터 권리 필요":"판매 전";
    if(status){
      if(usable())status.textContent="검증된 Premium 권한과 데이터 이용권을 확인했습니다. 선택 지역의 예보를 조회할 수 있습니다.";
      else if(entitled())status.textContent="Premium 권한은 확인됐지만 상업 데이터 이용권 게이트가 닫혀 있어 새 예보를 조회하지 않습니다.";
      else status.textContent="검증된 농업 Premium 권한과 상업 데이터 이용권이 확인되기 전에는 실행하지 않습니다.";
    }
    renderSites();
  }
  async function fetchForecast(site){
    if(site.current&&state.current?.weather){
      const inspection=provider?.inspectForecastPayload?.(state.current.weather);
      const freshness=state.current.source?.freshness||provider?.freshness?.(state.current.at);
      if(inspection?.valid&&freshness==="fresh"){
        const cached=state.current.source?.cached===true?"저장된 ":"";
        return {site,payload:state.current.weather,sourceLabel:`${cached}${state.current.source?.providerName||"현재 공급자"} 모델 예보`};
      }
    }
    const url=provider?.buildForecastUrl?.(site,{short:false});
    if(!url)throw new Error("데이터 공급자 요청을 만들지 못했습니다.");
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),13000);
    try{
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw new Error(`예보 응답 ${response.status}`);
      const payload=await response.json();
      const contract=provider?.inspectForecastPayload?.(payload);
      if(!contract?.valid)throw new Error("필수 시간별 예보값이 없습니다.");
      return {site,payload,sourceLabel:provider?.PROVIDER?.name||provider?.PROVIDER?.id||"모델 예보"};
    }finally{clearTimeout(timer);}
  }
  function selectedSites(){
    const keys=[...document.querySelectorAll("#agricultureSites input:checked")].map(input=>input.dataset.siteKey);
    return state.sites.filter(site=>keys.includes(site.key));
  }
  function timeLabel(value){return String(value||"").replace("T"," ");}
  function renderWindowGroup(target,label,windows){
    const group=node("div","agriculture-work-group");group.append(node("b","",label));
    if(!windows.length)group.append(node("span","","필수 자료가 부족하거나 적합 구간을 계산하지 못했습니다."));
    else windows.forEach(item=>group.append(node("span","",`${timeLabel(item.start)} ~ ${String(item.end).slice(11,16)} · ${item.score}점 이상 참고 구간`)));
    target.append(group);
  }
  function renderSiteResult(entry){
    const article=node("article","agriculture-site-result");
    const heading=node("div","agriculture-site-result-heading");heading.append(node("h4","",entry.site.name),node("span","",`${entry.result.cropName} · ${entry.result.stageName}`));article.append(heading);
    article.append(node("p","agriculture-profile-note",entry.result.profileMessage));
    const coverage=entry.result.coverage;
    article.append(node("small","agriculture-coverage",`48시간 중 기온 ${coverage.temperature}h · 강수확률 ${coverage.rainProbability}h · 강수량 ${coverage.precipitation}h · 돌풍 ${coverage.gust}h 확보`));
    const riskList=node("div","agriculture-risk-list");
    if(!entry.result.risks.length){riskList.append(node("div","agriculture-risk-empty","기준을 넘는 신호가 계산되지 않았습니다. 결측값·국지 기상·공식 특보를 별도로 확인하세요."));}
    entry.result.risks.forEach(risk=>{
      const item=node("div",`agriculture-risk ${risk.severity}`);const copy=node("span");
      copy.append(node("b","",risk.title),node("small","",`${timeLabel(risk.start)} ~ ${String(risk.end).slice(11,16)} · ${risk.evidence}`));item.append(copy);
      if(risk.source){const link=node("a","","공식 기준 ↗");link.href=risk.source.url;link.target="_blank";link.rel="noopener noreferrer";link.title=risk.source.title;item.append(link);}
      riskList.append(item);
    });
    article.append(riskList);
    const work=node("div","agriculture-work-windows");
    renderWindowGroup(work,"방제 참고",entry.result.windows.spray||[]);
    renderWindowGroup(work,"수확·농작업",entry.result.windows.harvest||[]);
    renderWindowGroup(work,"관수 참고",entry.result.windows.irrigation||[]);
    article.append(work);return article;
  }
  function renderResults(entries){
    const target=element("agriculturePlannerResults");if(!target)return;
    target.replaceChildren();entries.forEach(entry=>target.append(renderSiteResult(entry)));
  }
  async function runPlan(){
    if(!usable())return renderGate();
    const sites=selectedSites(),status=element("agriculturePlannerStatus"),run=element("agriculturePlanRun"),exportButton=element("agriculturePlanExport");
    if(!sites.length){if(status)status.textContent="계획할 지역을 한 곳 이상 선택하세요.";return;}
    if(run)run.disabled=true;if(exportButton)exportButton.disabled=true;if(status)status.textContent=`${sites.length}개 지역의 48시간 예보를 확인하고 있습니다.`;
    const outcomes=await Promise.allSettled(sites.map(fetchForecast));
    const crop=element("agricultureCrop").value,stage=element("agricultureStage").value,entries=[];let failed=0;
    outcomes.forEach(outcome=>{
      if(outcome.status!=="fulfilled"){failed+=1;return;}
      const value=outcome.value,result=core.evaluate(value.payload,{crop,stage,activityCore});
      if(!result.available){failed+=1;return;}
      entries.push({site:value.site,result,sourceLabel:value.sourceLabel});
    });
    state.reports=entries.map(entry=>core.report({site:entry.site.name,result:entry.result,generatedAt:new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}),sourceLabel:entry.sourceLabel}));
    renderResults(entries);
    if(status)status.textContent=entries.length?`${entries.length}개 지역 계획 완료${failed?` · ${failed}개 지역 조회 실패`:""}. 모델 예보와 공식 기준 출처를 함께 확인하세요.`:"계획을 만들지 못했습니다. 예보 연결과 데이터 계약 상태를 확인하세요.";
    if(exportButton)exportButton.disabled=!state.reports.length;if(run)run.disabled=false;
  }
  function exportReports(){
    if(!state.reports.length)return;
    const blob=new Blob([state.reports.join("\n\n========================================\n\n")],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`weatherhannun-agriculture-${new Date().toISOString().slice(0,10)}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function bind(){
    if(!element("agriculturePlanner")||!core)return;
    populateCrops();state.membership=window.WeatherHannunMembership?.current?.()||null;renderGate();
    element("agricultureCrop")?.addEventListener("change",populateStages);
    element("agriculturePlanRun")?.addEventListener("click",runPlan);
    element("agriculturePlanExport")?.addEventListener("click",exportReports);
  }
  window.addEventListener("weatherhannun:membership",event=>{state.membership=event.detail||null;renderGate();});
  window.addEventListener("weatherhannun:data",event=>{state.current=event.detail||null;renderSites();});
  window.addEventListener("weatherhannun:location-applied",renderSites);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
