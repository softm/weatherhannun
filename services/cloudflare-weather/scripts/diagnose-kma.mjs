#!/usr/bin/env node
// Diagnostic only: never output serviceKey, request URL, or response body containing secrets.
// Tests direct official KMA public data gateway and provider normalization.
import {kmaBase,dfsGrid} from "../../weather-api/core.mjs";
import {collectKma,normalizeServiceKey} from "../../weather-api/providers.mjs";
import {appendFileSync} from "node:fs";
const key = normalizeServiceKey(process.env.KMA_API_KEY || "");
const note = [];
if(!key || key==="UNCONFIGURED") {
  note.push("KMA_API_KEY: missing or unconfigured");
} else {
  const coords={lat:37.5665,lon:126.978,name:"Seoul"};
  const grid=dfsGrid(coords.lat,coords.lon);
  const cycle=kmaBase("village",new Date());
  const url=new URL("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst");
  for(const [k,v] of Object.entries({serviceKey:key,pageNo:"1",numOfRows:"1000",dataType:"JSON",
      nx:grid.nx,ny:grid.ny,base_date:cycle.baseDate,base_time:cycle.baseTime})) {
    url.searchParams.set(k,String(v));
  }
  try {
    const res=await fetch(url,{signal:AbortSignal.timeout(10000)});
    const raw=await res.text();
    let parsed;
    try {parsed=JSON.parse(raw);}catch{}
    const head=parsed?.response?.header;
    const code=String(head?.resultCode??"none").slice(0,16);
    const message=String(head?.resultMsg??"none").replace(/[\r\n\t]/g," ").slice(0,100);
    note.push("KMA getVilageFcst gateway: HTTP "+res.status+", resultCode="+code+
      ", resultMsg="+message+", contentType="+String(res.headers.get("content-type")||"none").slice(0,60));
    if(!res.ok && !parsed) note.push("Upstream returned non-JSON error; body intentionally redacted.");
    if(res.ok && code==="00") {
      try {
        const v=await collectKma(coords,key,{attempts:1,timeoutMs:7000});
        note.push("KMA full collect: OK, hourly="+v.hourly.length+", source="+v.source.provider);
      } catch (err) {
        note.push("KMA full collect: FAILED, code="+String(err?.message || "unknown").slice(0,80));
      }
    }
  } catch(err) {
    note.push("KMA gateway request failed: "+String(err?.name||"network_error").slice(0,60));
  }
}
const result=note.join("\n");
console.log(result);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  "\n### KMA source diagnostics (secrets hidden)\n\n"+note.map(x=>"- "+x).join("\n")+"\n");
