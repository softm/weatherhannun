/* Saved-region swipe navigation: only on the current-weather hero, not forecast carousels. */
(function(){
  "use strict";
  const threshold=65, verticalTolerance=50;
  let start=null;
  function manager(){return window.WeatherLocationManager;}
  function switchRegion(direction){
    const api=manager(), places=api?.getSavedPlaces?.()||[], active=api?.getActiveLocation?.();
    if(places.length<2||!active)return;
    const same=(a,b)=>Math.abs(Number(a.lat)-Number(b.lat))<0.0001&&Math.abs(Number(a.lon)-Number(b.lon))<0.0001;
    const index=places.findIndex(p=>same(p,active));
    const next=index<0?(direction>0?0:places.length-1):(index+direction+places.length)%places.length;
    api.selectSavedPlace?.(places[next].id);
  }
  function isInteractive(target){
    return !!target.closest("button,a,input,select,textarea,[role=button],[contenteditable],.hourly-scroll,.day-flow-time-axis");
  }
  function init(){
    const hero=document.querySelector("#stitch-live-dashboard .stitch-dashboard-hero")||document.querySelector("#view-today .hero-weather");
    if(!hero)return;
    hero.addEventListener("touchstart",e=>{
      if(e.touches.length!==1||isInteractive(e.target)){start=null;return;}
      start={x:e.touches[0].clientX,y:e.touches[0].clientY};
    },{passive:true});
    hero.addEventListener("touchend",e=>{
      if(!start||e.changedTouches.length!==1)return;
      const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
      start=null;
      if(Math.abs(dx)>=threshold&&Math.abs(dy)<=verticalTolerance&&Math.abs(dx)>Math.abs(dy)*1.5){
        switchRegion(dx<0?1:-1);
      }
    },{passive:true});
    hero.addEventListener("touchcancel",()=>{start=null;},{passive:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
