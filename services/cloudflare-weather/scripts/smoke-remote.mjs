#!/usr/bin/env node
import {writeFileSync,appendFileSync} from "node:fs";
const origin = process.argv[2] || "";
if (!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(origin)) {
  console.error("Expected a real HTTPS workers.dev URL from Wrangler deploy");
  process.exit(2);
}
const paths = [
 ["health","/weatherHealth"],
 ["invalid-coordinates","/weatherApi?lat=bad&lon=127"],
 ["global-met-norway","/weatherApi?lat=51.5074&lon=-0.1278&name=London"],
 ["domestic-kma","/weatherApi?lat=37.5665&lon=126.978&name=Seoul"]
];
const results = [];
let healthOk=false, globalOk=false, domesticOk=false;
for(const [name,path] of paths){
 try {
  const r=await fetch(origin+path,{headers:{Origin:"https://softm.github.io"},signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  const cors=r.headers.get("access-control-allow-origin")==="https://softm.github.io";
  let ok=false, note="";
  if(name==="health"){ok=r.status===200 && body.ok===true && body.database==="d1";healthOk=ok;}
  if(name==="invalid-coordinates")ok=r.status===400 && body.error==="invalid_coordinates";
  if(name==="global-met-norway"){
    ok=r.status===200 && body.contractVersion==="weatherhannun.v2"
      && body.source?.provider==="met-no" && body.hourly?.length>0;
    globalOk=ok;
  }
  if(name==="domestic-kma"){
    domesticOk=r.status===200 && body.contractVersion==="weatherhannun.v2"
      && body.source?.provider==="kma" && body.hourly?.length>0;
    ok=domesticOk || (r.status===503 && body.error==="domestic_provider_not_configured");
    note=domesticOk?"official KMA live":"KMA secret absent or unconfigured";
  }
  results.push({name,status:r.status,ok:ok&&cors,note:cors?note:"missing CORS"});
 }catch(e){results.push({name,status:"network-error",ok:false,note:String(e.message).slice(0,120)});}
}
const status={
  baseUrl:origin, checkedAt:new Date().toISOString(),results,
  stagingReady:healthOk&&globalOk&&results.every(x=>x.ok),
  productionCutoverReady:healthOk&&globalOk&&domesticOk&&results.every(x=>x.ok),
  domesticLive:domesticOk
};
writeFileSync("weather-deployment-status.json",JSON.stringify(status,null,2)+"\n");
console.log(JSON.stringify(status,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const lines=results.map(x=>"| "+x.name+" | "+x.status+" | "+(x.ok?"yes":"no")+" | "+x.note+" |");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    "\n### Weather Worker real HTTP smoke tests\n| Route | HTTP | Valid | Detail |\n|---|---|---|---|\n"+
    lines.join("\n")+"\n\nProduction cutover ready: **"+(status.productionCutoverReady?"YES":"NO")+"**\n");
}
if(!status.stagingReady)process.exitCode=1;
