"use strict";
const CACHE="weatherhannun-shell-v36-location-period-compare";
const BASE=self.registration.scope;
const SHELL=[
  "./","./index.html","./styles.css","./stitch-theme.css?v=18","./stitch-mobile.css?v=16",
  "./settings.css?v=34","./screen-weather-settings.css?v=34","./screen-weather-settings.js?v=35",
  "./agriculture-planner.css?v=34","./agriculture-planner-core.js?v=34","./agriculture-planner.js?v=34",
  "./weather-icons.css?v=17","./weather-icons.js?v=17","./stitch-layout.js?v=18",
  "./stitch-today.template.html?v=17","./stitch-today.js?v=31","./stitch-today.css?v=16",
  "./stitch-today.utilities.css","./rain-decision-core.js?v=31","./rain-decision-ui.js?v=21",
  "./rain-decision.css?v=21","./outfit-decision-core.js?v=31","./outfit-decision-ui.js?v=24",
  "./outfit-decision.css?v=24","./daily-delta-core.js?v=27","./daily-delta-ui.js?v=27",
  "./location-compare-core.js?v=32","./location-compare-ui.js?v=32","./location-compare.css?v=28",
  "./weather-provider-core.js?v=31","./monetization-core.js?v=32","./monetization-settings.js?v=34","./plus-personalization-core.js?v=34","./plus-personalization.js?v=34","./product-metrics-core.js?v=33","./product-metrics.js?v=33","./activity-decision-core.js?v=28","./official-data.css?v=30","./official-data-ui.js?v=30",
  "./assets/stitch/today-presenter.jpg","./assets/stitch/sun.svg",
  "./assets/stitch/partly-cloudy.svg","./assets/stitch/storm.svg","./assets/stitch/snow.svg",
  "./assets/stitch/rain.svg","./assets/stitch/wind.svg","./assets/stitch/humidity.svg",
  "./assets/brand/weatherhannun-32.png?v=18","./assets/brand/weatherhannun-180.png?v=18",
  "./assets/brand/weatherhannun-192.png?v=18","./assets/brand/weatherhannun-512.png?v=18",
  "./data/korea-regions-202602.json","./region-search-core.js?v=15","./region-search-ui.js?v=15",
  "./region-search.css?v=15","./location-core.js","./reverse-geocode.js","./location-manager.js",
  "./location-manager.css","./briefing-core.js?v=31","./briefing-highlights.js?v=20","./briefing-ui.js?v=20",
  "./briefing-ui.css","./briefing-highlights.css?v=20","./app.js?v=34","./alert-rules-core.js?v=31",
  "./forecast-insights.js?v=31","./forecast-insights.css?v=26","./manifest.webmanifest?v=18",
  "./icon.svg?v=18","./data-status.html"
].map(x=>new URL(x,BASE).href);
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
