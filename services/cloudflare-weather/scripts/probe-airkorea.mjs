#!/usr/bin/env node
// Test existing public-data key against AirKorea, without logging key or request URL.
import {appendFileSync} from "node:fs";
import {normalizeServiceKey} from "../../weather-api/providers.mjs";
const key=normalizeServiceKey(process.env.DATA_GO_KR_SERVICE_KEY||"");
const output=process.env.GITHUB_OUTPUT;
let approved=false;
const results=[];
if(key){
  for(const [label,endpoint,params] of [
    ["stations","https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList",{tmX:"197453",tmY:"451900",ver:"1.1"}],
    ["measurements","https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty",{stationName:"종로구",dataTerm:"DAILY",ver:"1.3"}]
  ]){
    const u=new URL(endpoint);
    for(const [k,v] of Object.entries({...params,serviceKey:key,returnType:"json",numOfRows:"1",pageNo:"1"}))u.searchParams.set(k,v);
    try{
      const res=await fetch(u,{signal:AbortSignal.timeout(12000)});
      const body=await res.json().catch(()=>null);
      const header=body?.response?.header;
      const code=String(header?.resultCode??"unknown").slice(0,16);
      const items=body?.response?.body?.items;
      const hasItems=Array.isArray(items)?items.length>0:Array.isArray(items?.item)?items.item.length>0:false;
      results.push({label,http:res.status,code,hasItems});
    }catch(e){results.push({label,http:"network-error",code:String(e?.name||"error").slice(0,30),hasItems:false});}
  }
  approved=results.every(x=>x.http===200&&x.code==="00"&&x.hasItems);
}
if(output)appendFileSync(output,"airkorea_approved="+approved+"\n");
const summary=results.map(x=>"- "+x.label+": HTTP "+x.http+", resultCode="+x.code+", data="+x.hasItems).join("\n")||"- DATA_GO_KR_SERVICE_KEY absent";
console.log("AirKorea source validation (credentials hidden):\n"+summary+"\nApproved for auto configuration: "+approved);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,"\n### AirKorea key validation\n"+summary+"\nApproved: **"+approved+"**\n");
