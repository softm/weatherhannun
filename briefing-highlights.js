/* Semantic Stitch-style highlighting for fact-based weather briefings.
 * Keeps the original text intact; never interpolates weather/location into HTML.
 * Safe for model-provided and user-selected text (DOM text nodes only).
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherBriefingHighlights=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const KINDS=Object.freeze(["place","sky","temperature","time","time-warning","alert","trend","metric","action"]);
  function ranges(input,context){
    const text=String(input??""),meta=context||{},results=[];
    function add(start,end,kind,priority){
      if(start<0||end<=start||!KINDS.includes(kind))return;
      results.push({start,end,kind,priority});
    }
    function literal(phrase,kind,priority){
      if(typeof phrase!=="string"||!phrase.trim())return;
      let from=0,index,steps=0;
      // Large untrusted strings should never create unbounded loops or DOM nodes.
      while((index=text.indexOf(phrase,from))!==-1&&steps++<12){
        add(index,index+phrase.length,kind,priority);
        from=index+phrase.length;
      }
    }
    function pattern(regex,kind,priority){
      const exp=new RegExp(regex.source,regex.flags.includes("g")?regex.flags:regex.flags+"g");
      let match,limit=0;
      while((match=exp.exec(text))!==null&&limit++<40){
        add(match.index,match.index+match[0].length,kind,priority);
        if(match[0].length===0)exp.lastIndex++;
      }
    }

    // Explicit semantic facts take precedence over look-alike words.
    if(typeof meta.where==="string")literal(meta.where,"place",96);
    (Array.isArray(meta.events)?meta.events:[]).forEach(event=>{
      if(!event||typeof event.title!=="string")return;
      literal(event.title,event.severity==="caution"?"alert":"trend",110);
    });
    // Forecast event times have stronger urgency than generic dates.
    (Array.isArray(meta.events)?meta.events:[]).forEach(event=>{
      if(typeof event?.time!=="string"||event.time.length<13)return;
      const date=event.time;
      const dateLabel=Number(date.slice(5,7))+"월 "+Number(date.slice(8,10))+"일 "+date.slice(11,13)+"시";
      literal(dateLabel,event.severity==="caution"?"time-warning":"time",99);
    });
    // Full time tokens must win against incidental numeric matches.
    pattern(/\d{1,2}월\s*\d{1,2}일(?:\s*(?:오전|오후))?\s*\d{1,2}시(?:\s*\d{1,2}분)?/g,"time",90);
    pattern(/(?:오늘|내일|모레)\s*(?:오전|오후)\s*\d{1,2}시(?:\s*\d{1,2}분)?/g,"time",86);
    pattern(/(?:오전|오후)\s*\d{1,2}시(?:\s*\d{1,2}분)?/g,"time",80);

    // Rain/snow and unsafe sky condition language should be amber, not 'good' green.
    pattern(/대체로 맑거나 구름이 조금 있고|하늘 상태 정보가 없고|맑고|흐리고|구름이 조금 있고/g,"sky",75);
    pattern(/비가 예상되고|눈이 예상되고|안개가 예상되고|뇌우 가능성이 있고/g,"alert",75);

    pattern(/[-+]?\d+(?:\.\d+)?\s*°C/g,"temperature",67);
    pattern(/[-+]?\d+(?:\.\d+)?\s*(?:km\/h|mm|%|㎍\/㎥)/g,"metric",62);

    // This is a call-to-action, not a claim that the weather is safe.
    pattern(/예보를 다시 확인하세요|예보를 재확인하세요|공식 특보를 별도로 확인해야 합니다|이동과 시설물 관리에 유의하세요|수분 섭취에 신경 쓰세요/g,"action",45);

    const occupied=new Uint8Array(text.length);
    // Long, higher-priority explicit semantic spans are selected before smaller ones.
    const selected=[];
    results.sort((a,b)=>b.priority-a.priority||(b.end-b.start)-(a.end-a.start)||a.start-b.start);
    for(const r of results){
      let overlaps=false;
      for(let i=r.start;i<r.end;i++)if(occupied[i]){overlaps=true;break;}
      if(overlaps)continue;
      for(let i=r.start;i<r.end;i++)occupied[i]=1;
      selected.push(r);
      if(selected.length>=40)break;
    }
    selected.sort((a,b)=>a.start-b.start);
    const parts=[];
    let cursor=0;
    for(const r of selected){
      if(r.start>cursor)parts.push({text:text.slice(cursor,r.start),kind:null});
      parts.push({text:text.slice(r.start,r.end),kind:r.kind});
      cursor=r.end;
    }
    if(cursor<text.length)parts.push({text:text.slice(cursor),kind:null});
    if(!parts.length)parts.push({text,kind:null});
    return parts;
  }

  function render(target,text,context){
    if(!target)return [];
    const source=String(text??"");
    const parts=ranges(source,context);
    const doc=target.ownerDocument||(typeof document!=="undefined"?document:null);
    if(!doc||typeof doc.createElement!=="function"||typeof target.replaceChildren!=="function"){
      target.textContent=source;
      return parts;
    }
    const nodes=parts.map(part=>{
      if(!part.kind)return doc.createTextNode(part.text);
      const mark=doc.createElement("mark");
      mark.className="weather-brief-mark weather-brief-mark--"+part.kind;
      mark.textContent=part.text;
      return mark;
    });
    target.replaceChildren(...nodes);
    // An accessible, continuous sentence: no decorative emoji or extra words.
    return parts;
  }
  return Object.freeze({ranges,render});
});
