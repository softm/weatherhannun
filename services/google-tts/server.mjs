import crypto from "node:crypto";
import {pathToFileURL} from "node:url";
import express from "express";
import textToSpeech from "@google-cloud/text-to-speech";

export const DEFAULT_VOICE="ko-KR-Chirp3-HD-Kore";
export function normalizeText(value){
  if(typeof value!=="string")return "";
  return value.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,350);
}
export function allowedOrigin(origin,configured=process.env.ALLOWED_ORIGIN||"https://softm.github.io"){
  return !origin||origin===configured;
}
export function cacheKey(text,voice=DEFAULT_VOICE){return crypto.createHash("sha256").update(`${voice}\0${text}`).digest("hex");}
export function createRateLimiter(limit=Number(process.env.MAX_REQUESTS_PER_MINUTE||30)){
  const clients=new Map();
  return (key,now=Date.now())=>{const previous=clients.get(key);if(!previous||now-previous.started>=60_000){clients.set(key,{started:now,count:1});return true;}previous.count+=1;return previous.count<=limit;};
}

export function createApp({client=new textToSpeech.TextToSpeechClient()}={}){
  const app=express(),cache=new Map(),allowRequest=createRateLimiter();
  app.disable("x-powered-by");app.set("trust proxy",1);app.use(express.json({limit:"4kb"}));
  app.get("/health",(_req,res)=>res.json({ok:true,voice:process.env.TTS_VOICE||DEFAULT_VOICE}));
  app.post("/v1/briefing/speech",async(req,res)=>{
    const origin=req.get("origin");
    if(!allowedOrigin(origin))return res.status(403).json({error:"origin_not_allowed"});
    if(!allowRequest(req.ip||req.socket.remoteAddress||"unknown"))return res.status(429).json({error:"rate_limited"});
    if(origin){res.set("Access-Control-Allow-Origin",origin);res.set("Vary","Origin");}
    const text=normalizeText(req.body?.text),voice=process.env.TTS_VOICE||DEFAULT_VOICE;
    if(!text)return res.status(400).json({error:"text_required"});
    const key=cacheKey(text,voice),hit=cache.get(key);
    if(hit){res.set({"Content-Type":"audio/mpeg","Cache-Control":"public, max-age=21600, immutable","ETag":`\"${key}\"`,"X-TTS-Cache":"HIT","X-TTS-Voice":voice});return res.send(hit);}
    try{
      const [response]=await client.synthesizeSpeech({input:{text},voice:{languageCode:"ko-KR",name:voice},audioConfig:{audioEncoding:"MP3",speakingRate:.96}});
      const audio=Buffer.from(response.audioContent||"");
      if(!audio.length)throw new Error("empty_audio");
      cache.set(key,audio);if(cache.size>256)cache.delete(cache.keys().next().value);
      res.set({"Content-Type":"audio/mpeg","Cache-Control":"public, max-age=21600, immutable","ETag":`\"${key}\"`,"X-TTS-Cache":"MISS","X-TTS-Voice":voice});res.send(audio);
    }catch(error){console.error("tts_synthesis_failed",error?.message||error);res.status(502).json({error:"tts_unavailable"});}
  });
  app.options("/v1/briefing/speech",(req,res)=>{const origin=req.get("origin");if(!allowedOrigin(origin))return res.sendStatus(403);res.set({"Access-Control-Allow-Origin":origin||"https://softm.github.io","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400"});res.sendStatus(204);});
  return app;
}

const isDirectRun=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(process.env.NODE_ENV!=="test"&&isDirectRun)createApp().listen(Number(process.env.PORT||8080),()=>console.log("weatherhannun Google TTS listening"));
