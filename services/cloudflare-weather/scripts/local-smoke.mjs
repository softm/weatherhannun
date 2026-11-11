#!/usr/bin/env node
import {spawn} from "node:child_process";
const port=18794;
const base="http://127.0.0.1:"+port;
const worker=spawn("npx",["wrangler","dev","--local","--ip","127.0.0.1","--port",String(port)],{
  stdio:["ignore","pipe","pipe"],env:{...process.env,CI:"true"}});
let log="";
for(const stream of [worker.stdout,worker.stderr])stream.on("data",x=>log+=String(x).slice(-1200));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function probe(path){
  const res=await fetch(base+path,{signal:AbortSignal.timeout(3500)});
  return {status:res.status,body:await res.json()};
}
try{
 let ready=false;
 for(let i=0;i<50;i++){
  if(worker.exitCode!==null)throw Error("Wrangler stopped: "+log.slice(-1000));
  try{
   const h=await probe("/weatherHealth");
   if(h.status===200 && h.body.ok && h.body.database==="d1"){ready=true;break;}
  }catch{}
  await delay(500);
 }
 if(!ready)throw Error("D1 local health check failed: "+log.slice(-1000));
 const invalid=await probe("/weatherApi?lat=nope&lon=127");
 if(invalid.status!==400||invalid.body.error!=="invalid_coordinates")throw Error("Coordinates contract failed");
 const domestic=await probe("/weatherApi?lat=37.5665&lon=126.978");
 if(domestic.status!==503||domestic.body.error!=="domestic_provider_not_configured")
  throw Error("Domestic missing-key safety check failed: "+JSON.stringify(domestic));
 console.log("Local Wrangler Worker + D1 HTTP tests: PASS");
}finally{worker.kill("SIGTERM");}
