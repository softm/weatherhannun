#!/usr/bin/env node
// Static source-code inventory; captures candidate external URLs and fetch call sites.
// Does not assume each literal URL is actively invoked in production.
import {readdirSync,readFileSync,writeFileSync,appendFileSync} from "node:fs";
import {join,relative,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=join(dirname(fileURLToPath(import.meta.url)),"../../..");
const ignore=new Set([".git","node_modules",".wrangler","assets","data","tests",".pages-public"]);
const good=/\.(?:js|mjs|cjs|html)$/i;
const results=[];
function walk(dir){
 for(const ent of readdirSync(dir,{withFileTypes:true})){
  if(ent.isDirectory()){if(!ignore.has(ent.name))walk(join(dir,ent.name));continue;}
  if(!good.test(ent.name))continue;
  const path=join(dir,ent.name),name=relative(root,path);
  if(name.startsWith("services/cloudflare-weather/test/"))continue;
  const contents=readFileSync(path,"utf8");
  const lines=contents.split(/\r?\n/);
  lines.forEach((line,index)=>{
   const urls=[...line.matchAll(/https?:\/\/[^\s"'\x60<>\\]+/g)]
     .map(x=>x[0].replace(/[;,)\]}]+$/g,"").slice(0,300));
   const outbound=/\bfetch\s*\(|\bXMLHttpRequest\b|\bbuildForecastUrl\b|\bWeatherHannunCloudTTS\b|\bWebSocket\s*\(/.test(line);
   const important=urls.filter(u=>/cloudfunctions\.net|workers\.dev|api\.met\.no|apis\.data\.go\.kr|apihub\.kma|nominatim|open-meteo|openstreetmap|api\.map|weather|google|kakao|naver/i.test(u));
   if(important.length||outbound)results.push({file:name,line:index+1,urls:important,outbound,source:line.trim().slice(0,220)});
  });
 }
}
walk(root);
const output={checkedAt:new Date().toISOString(),source:"weatherhannun main",notes:"Static source inventory; literals are not necessarily live requests; Android separate repository excluded",matches:results};
writeFileSync(join(root,"services/cloudflare-weather/api-inventory.json"),JSON.stringify(output,null,2)+"\n");
console.log("Weather app source network inventory: "+results.length+" call sites and candidate references");
for(const x of results.filter(x=>x.urls.length))console.log(x.file+":"+x.line+" "+x.urls.join(" "));
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
 "\n### Source API inventory\nFound "+results.length+" candidate network-related source locations. See api-inventory artifact; verify each active call manually.\n");
