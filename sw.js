"use strict";
const CACHE="weatherhannun-shell-v15-hour-card-contrast";
const BASE=self.registration.scope;
const SHELL=["./","./index.html","./styles.css","./stitch-theme.css","./stitch-mobile.css?v=14","./stitch-layout.js","./stitch-today.template.html","./stitch-today.js?v=15","./stitch-today.css?v=15","./stitch-today.utilities.css","./assets/stitch/today-presenter.jpg","./assets/stitch/sun.svg","./assets/stitch/partly-cloudy.svg","./assets/stitch/storm.svg","./assets/stitch/snow.svg","./assets/stitch/rain.svg","./assets/stitch/wind.svg","./assets/stitch/humidity.svg","./data/korea-regions-202602.json","./region-search-core.js","./region-search-ui.js","./region-search.css?v=14","./location-core.js","./reverse-geocode.js","./location-manager.js","./location-manager.css","./briefing-core.js","./briefing-ui.js","./briefing-ui.css","./app.js","./forecast-insights.js","./forecast-insights.css","./manifest.webmanifest","./icon.svg","./data-status.html"].map(x=>new URL(x,BASE).href);
async function warmShell(){
  const cache=await caches.open(CACHE);
  await Promise.all(SHELL.map(async url=>{
    const response=await fetch(url,{cache:"reload"});
    if(!response.ok)throw new Error("shell asset "+response.status+": "+url);
    await cache.put(url,response);
  }));
}
self.addEventListener("install",event=>{event.waitUntil(warmShell());self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req,{cache:"no-store"}).catch(()=>caches.match(new URL("./index.html",BASE).href)));return;
  }
  if(SHELL.includes(req.url)){
    event.respondWith(fetch(req,{cache:"no-store"}).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{}));}
      return response;
    }).catch(()=>caches.match(req)));return;
  }
});
