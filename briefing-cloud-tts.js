(function(root){
  "use strict";
  let active=null;
  const endpoint=()=>document.querySelector('meta[name="weatherhannun-tts-endpoint"]')?.content?.trim()||"";
  const sentences=text=>String(text||"").match(/[^.!?。！？]+[.!?。！？]?\s*/g)?.map(x=>x.trim()).filter(Boolean)||[];
  const configured=()=>/^https:\/\//.test(endpoint());
  async function play(text,{onSentence=()=>{},onStatus=()=>{}}={}){
    stop();if(!configured())throw new Error("cloud_tts_not_configured");
    const controller=new AbortController(),session={controller,audio:null,urls:[]};active=session;
    const parts=sentences(text);if(!parts.length)throw new Error("briefing_empty");
    try{for(let index=0;index<parts.length;index+=1){
      if(active!==session)throw new DOMException("Stopped","AbortError");onStatus(`${index+1} / ${parts.length} 문장 준비 중`);
      const response=await fetch(endpoint(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:parts[index]}),signal:controller.signal});
      if(!response.ok||!String(response.headers.get("content-type")||"").startsWith("audio/"))throw new Error(`cloud_tts_${response.status}`);
      const url=URL.createObjectURL(await response.blob());session.urls.push(url);const audio=new Audio(url);session.audio=audio;onSentence(index);onStatus(`${index+1} / ${parts.length} 문장 HD 재생 중`);
      await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=()=>reject(new Error("audio_playback_failed"));audio.play().catch(reject);});
    }if(active===session){active=null;onSentence(-1);onStatus("HD 브리핑 재생 완료");}return true;
    }finally{session.urls.forEach(URL.revokeObjectURL);if(active===session)active=null;}
  }
  function stop(){if(!active)return;active.controller.abort();active.audio?.pause();active.urls.forEach(URL.revokeObjectURL);active=null;}
  root.WeatherHannunCloudTTS=Object.freeze({configured,endpoint,sentences,play,stop});
})(typeof window!=="undefined"?window:globalThis);
