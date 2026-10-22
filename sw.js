"use strict";
const CACHE="weatherhannun-shell-v2";
const BASE=self.registration.scope;
const SHELL=["./","./index.html","./styles.css","./app.js","./forecast-insights.js","./forecast-insights.css","./manifest.webmanifest","./icon.svg","./data-status.html"].map(x=>new URL(x,BASE).href);
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req).catch(()=>caches.match(new URL("./index.html",BASE).href)));return;
  }
  if(SHELL.includes(req.url)){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));return;
  }
});