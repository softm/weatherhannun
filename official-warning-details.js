/* Official warning details. Never infer 'no warning' from stale or missing feeds. */
(function(){
"use strict";
const source="https://www.weather.go.kr/w/special-report/overall.do";
function init(){
 const host=document.querySelector("#view-today");
 if(!host)return;
 const section=document.createElement("section");
 section.className="official-warning-details";
 section.setAttribute("aria-label","현재 지역 기상특보 상세");
 const heading=document.createElement("h2");heading.textContent="현재 지역 기상특보";
 const status=document.createElement("p");status.setAttribute("aria-live","polite");status.textContent="공식 특보 자료 확인 중";
 const list=document.createElement("ul");list.hidden=true;
 const link=document.createElement("a");link.href=source;link.target="_blank";link.rel="noopener noreferrer";link.textContent="기상청 특보 원문 확인";
 section.append(heading,status,list,link);
 const hero=host.querySelector(".today-layout")||host;
 hero.parentNode.insertBefore(section,hero.nextSibling);
 window.addEventListener("weatherhannun:official-data",event=>{
  const data=event.detail||{};
  list.replaceChildren();list.hidden=true;
  if(!data.warningFeedReady){status.textContent="특보 데이터가 없거나 갱신이 지연되었습니다. 공식 원문에서 확인하세요.";section.dataset.state="unknown";return;}
  const local=Array.isArray(data.localWarnings)?data.localWarnings:[];
  if(!local.length){status.textContent="최신 제공 스냅샷에서 현재 지역에 매칭된 특보가 없습니다.";section.dataset.state="clear";return;}
  section.dataset.state="warning";
  status.textContent="현재 지역 적용 특보 "+local.length+"건 · 발표 지역과 시간을 확인하세요.";
  local.forEach(row=>{
   const li=document.createElement("li");
   const title=document.createElement("strong");
   title.textContent=String(row.title||row.warningType||row.type||"기상특보");
   const meta=document.createElement("span");
   meta.textContent=[row.regionName,row.issuedAt||row.announcedAt].filter(Boolean).join(" · ");
   li.append(title,meta);list.append(li);
  });list.hidden=false;
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
