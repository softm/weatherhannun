/* 날씨한눈 saved location domain logic (no DOM, browser or network dependencies). */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherLocationCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const MAX_SAVED=10;
  function validNumber(v){return (typeof v==="number"&&Number.isFinite(v))||(typeof v==="string"&&v.trim()!==""&&Number.isFinite(Number(v)));}
  function cleanPlace(raw){
    if(!raw||!validNumber(raw.lat)||!validNumber(raw.lon))return null;
    const lat=Number(raw.lat),lon=Number(raw.lon);
    if(lat< -90||lat>90||lon< -180||lon>180)return null;
    const name=String(raw.name||"").trim().slice(0,75);
    const address=String(raw.address||"").trim().slice(0,170);
    const admin=String(raw.administrative||"").trim().slice(0,145);
    return {name:name||"선택 지역",lat,lon,
      source:raw.source==="gps"?"gps":"manual",
      address,administrative:admin,approximate:raw.approximate===true,regionCenter:raw.regionCenter===true};
  }
  function key(place){
    const p=cleanPlace(place);
    return p?"place:"+p.lat.toFixed(3)+":"+p.lon.toFixed(3):null;
  }
  function same(a,b){const x=key(a),y=key(b);return !!(x&&x===y);}
  function collection(input,limit=MAX_SAVED){
    const out=[],seen=new Set();
    (Array.isArray(input)?input:[]).forEach(function(item){
      const p=cleanPlace(item),k=key(p);
      if(!p||!k||seen.has(k)||out.length>=limit)return;
      seen.add(k);
      out.push({id:k,...p});
    });
    return out;
  }
  function add(list,raw){
    const p=cleanPlace(raw),items=collection(list);
    if(!p)return {items,error:"invalid"};
    const k=key(p);
    if(items.some(x=>x.id===k))return {items,error:"exists"};
    if(items.length>=MAX_SAVED)return {items,error:"full"};
    return {items:items.concat([{id:k,...p}]),error:null};
  }
  function rename(list,id,newName){
    const name=String(newName||"").trim().replace(/\s+/g," ").slice(0,42);
    const items=collection(list);
    if(!name)return {items,error:"empty"};
    if(!items.some(x=>x.id===id))return {items,error:"missing"};
    return {items:items.map(x=>x.id===id?{...x,name}:x),error:null};
  }
  function remove(list,id){
    const items=collection(list),index=items.findIndex(x=>x.id===id);
    if(index<0)return {items,removed:null,index:-1};
    return {items:items.filter(x=>x.id!==id),removed:items[index],index};
  }
  function move(list,id,direction){
    const items=collection(list),from=items.findIndex(x=>x.id===id);
    if(from<0)return {items,error:"missing",from:-1,to:-1};
    const step=direction==="up"?-1:direction==="down"?1:0;
    if(!step)return {items,error:"direction",from,to:from};
    const to=from+step;
    if(to<0||to>=items.length)return {items,error:"boundary",from,to:from};
    const reordered=items.slice();
    [reordered[from],reordered[to]]=[reordered[to],reordered[from]];
    return {items:reordered,error:null,from,to};
  }
  function afterDelete(active,removed,remaining,defaultLoc){
    return same(active,removed)?(collection(remaining)[0]||cleanPlace(defaultLoc)):null;
  }
  return Object.freeze({MAX_SAVED,cleanPlace,key,same,collection,add,rename,remove,move,afterDelete});
});
