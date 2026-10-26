/* Weather Hannun × Google Stitch.
 * DOM-only visual composition, preserving every live-weather widget ID.
 * This file MUST be loaded before app.js so new tabs receive its listeners.
 */
(function(){
 "use strict";
 var root=document.documentElement,KEY="weatherhannun:stitch-theme:v1";
 var saved="";
 try{saved=localStorage.getItem(KEY)||"";}catch(_){}
 root.dataset.weatherTheme=(saved==="light"||saved==="dark")?saved:"light";
 root.dataset.weatherView="today";
 function el(tag,attrs,value){
  var node=document.createElement(tag);
  Object.keys(attrs||{}).forEach(function(k){node.setAttribute(k,attrs[k]);});
  if(value!==undefined)node.textContent=value;
  return node;
 }
 function icon(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+p+'</svg>';}
 var icons={
  today:icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'),
  hourly:icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  weekly:icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m3 0h3m-9 4h3"/>'),
  activity:icon('<path d="m12 2 3 6 6 1-4.5 4.5 1 7L12 17l-5.5 3.5 1-7L3 9l6-1z"/>'),
  air:icon('<path d="M3 8h11a3 3 0 1 0-3-3M2 12h18a2 2 0 1 1-2 2M4 17h8a3 3 0 1 1-3 3"/>'),
  map:icon('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>')
 };
 function tab(view,label){
  var b=el("button",{type:"button","data-view":view,"aria-label":label});
  if(view==="today")b.classList.add("active");
  var s=el("span",{class:"stitch-tab-icon"});s.innerHTML=icons[view];b.appendChild(s);
  b.appendChild(document.createTextNode(label));return b;
 }
 function compose(){
  var today=document.getElementById("view-today"),weekly=document.getElementById("view-weekly");
  if(!today||!weekly)return;
  var hour=document.getElementById("view-hourly");
  if(!hour){
   hour=el("section",{id:"view-hourly",class:"screen content-bound","aria-label":"시간별 예보 및 강수 분석"});
   var hero=el("div",{class:"stitch-page-lead"});
   hero.innerHTML='<div><p class="eyebrow">HOURLY FORECAST</p><h2>언제 비 오고, 언제 맑을까?</h2><p>시간대별 강수와 기온을 살펴보세요.</p></div><img src="./assets/stitch/rain.svg" alt="" loading="lazy">';
   hour.appendChild(hero);
   var insight=today.querySelector(".insight-section"),panel=today.querySelector(".hourly-panel");
   if(insight)hour.appendChild(insight);
   if(panel){
    var heading=panel.previousElementSibling;
    if(heading&&heading.classList.contains("section-title")&&today.contains(heading))hour.appendChild(heading);
    hour.appendChild(panel);
   }
   weekly.parentNode.insertBefore(hour,weekly);
  }
  if(!today.querySelector(".stitch-quicklinks")){
   var quick=el("div",{class:"stitch-quicklinks","aria-label":"오늘 더 알아보기"});
   quick.appendChild(tab("hourly","시간별 비 예보"));
   quick.appendChild(tab("air","대기질 확인"));
   quick.appendChild(tab("map","전국 날씨 보기"));
   var cards=today.querySelector(".hero-grid");if(cards)cards.insertAdjacentElement("afterend",quick);
  }
  [
   ["view-weekly","sun.svg"],["view-activity","sprout.svg"],
   ["view-air","humidity.svg"],["view-map","partly-cloudy.svg"]
  ].forEach(function(pair){
   var page=document.getElementById(pair[0]);if(!page)return;
   var header=page.querySelector(".page-header");
   if(header&&!header.querySelector(".stitch-page-icon")){
    header.classList.add("stitch-icon-header");
    var img=el("img",{class:"stitch-page-icon",src:"./assets/stitch/"+pair[1],alt:"",loading:"lazy"});
    header.appendChild(img);
   }
  });
 }
 function tabs(){
  var nav=document.querySelector(".desktop-nav");
  if(nav&&!nav.querySelector('[data-view="hourly"]')){
   var b=tab("hourly","시간별");b.classList.add("nav-button");
   nav.insertBefore(b,nav.querySelector('[data-view="weekly"]'));
  }
  var mobile=document.querySelector(".mobile-nav");
  if(mobile)mobile.replaceChildren(tab("today","오늘"),tab("hourly","시간별"),tab("weekly","주간"),tab("activity","활동추천"),tab("map","전국지도"));
 }
 function theme(){
  var buttons=[...document.querySelectorAll("[data-theme-choice]")];
  function sync(){
   var dark=root.dataset.weatherTheme==="dark";
   buttons.forEach(function(button){
    var active=button.dataset.themeChoice===root.dataset.weatherTheme;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
   });
   var meta=document.querySelector('meta[name="theme-color"]');
   if(meta)meta.content=dark?"#04132a":"#f0f6fc";
  }
  buttons.forEach(function(button){
   button.addEventListener("click",function(){
    var choice=button.dataset.themeChoice;
    if(choice!=="light"&&choice!=="dark")return;
    root.dataset.weatherTheme=choice;
    try{localStorage.setItem(KEY,choice);}catch(_){}
    sync();
   });
  });
  sync();
 }
 function currentWeatherIcon(){
  var target=document.getElementById("weatherIcon");if(!target)return;
  target.style.backgroundImage="";
  target.classList.remove("stitch-weather-icon");
  target.classList.add("weather-icon-host");
 }
 function syncTabs(){
  var page=document.querySelector(".screen.active");
  var view=page?page.id.replace(/^view-/,""):"today";
  root.dataset.weatherView=view;
  document.querySelectorAll('.mobile-nav [data-view]').forEach(function(b){
   var active=b.dataset.view===view;
   b.classList.toggle("active",active);
   b.setAttribute("aria-current",active?"page":"false");
  });
 }
 function init(){
  compose();tabs();theme();currentWeatherIcon();syncTabs();
  document.querySelectorAll(".screen").forEach(function(p){
   new MutationObserver(syncTabs).observe(p,{attributes:true,attributeFilter:["class"]});
  });
  document.addEventListener("click",function(e){
   if(e.target.closest&&e.target.closest("[data-view]"))requestAnimationFrame(syncTabs);
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();
