/* Saved-place account sync.
   Signing in merges account and device places without replacing either list.
   Saved GPS snapshots stay on the device and are never uploaded automatically. */
(function(){
 'use strict';
 const KEY='weatherhannun_places_v2',SITE='weatherhannun',POLICY='weatherhannun-saved-places';
 let activeUid=null,activeClient=null,lastDeviceKeys=null,running=null,requested=false,stopPolicy=null,suppressPlaceEvent=false;
 const context=()=>window.SoftmAccounts?.get(SITE);
 const readLocal=()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
 const validCoordinate=(value,limit)=>Number.isFinite(value)&&Math.abs(value)<=limit;
 const placeKey=(lat,lon)=>validCoordinate(lat,90)&&validCoordinate(lon,180)
  ?Number(lat).toFixed(3)+':'+Number(lon).toFixed(3):null;
 const idFromPlace=place=>'loc_'+Number(place.lat).toFixed(3).replace('.','_')+'_'+Number(place.lon).toFixed(3).replace('.','_');
 const localPlaces=()=>readLocal().filter(place=>place&&place.source!=='gps'&&validCoordinate(place.lat,90)&&validCoordinate(place.lon,180)).slice(0,10);
 const remotePlaces=data=>(Array.isArray(data?.places)?data.places:[]).filter(place=>place&&typeof place.id==='string'&&placeKey(place.latitude,place.longitude));
 function emitError(error){
  window.dispatchEvent(new CustomEvent('softm:sync-error',{detail:{siteId:SITE,policy:POLICY,error:String(error?.message||error)}}));
 }
 async function synchronize(uid,client){
  const before=localPlaces(),beforeKeys=new Set(before.map(place=>placeKey(place.lat,place.lon)));
  const deletedKeys=lastDeviceKeys?new Set([...lastDeviceKeys].filter(key=>!beforeKeys.has(key))):new Set();
  const response=await client.requestPersonal('/api/personal/places');
  if(activeUid!==uid||context()?.currentUser?.uid!==uid)return;
  let remote=remotePlaces(response);
  for(const place of remote.filter(item=>deletedKeys.has(placeKey(item.latitude,item.longitude)))){
   await client.requestPersonal('/api/personal/places/'+encodeURIComponent(place.id),'DELETE');
  }
  remote=remote.filter(item=>!deletedKeys.has(placeKey(item.latitude,item.longitude)));
  const manager=window.WeatherLocationManager;
  if(typeof manager?.mergeCloudPlaces!=='function')throw Error('지역 관리 기능을 불러올 수 없습니다.');
  suppressPlaceEvent=true;
  try{
   const incoming=remote.map(place=>({name:String(place.label||'관심 지역'),lat:place.latitude,lon:place.longitude,source:'manual'}));
   const result=manager.mergeCloudPlaces(incoming);
   if(!result.ok)throw Error('계정 관심 지역을 기기에 저장하지 못했습니다.');
  }finally{suppressPlaceEvent=false;}
  if(activeUid!==uid||context()?.currentUser?.uid!==uid)return;
  const merged=localPlaces();
  const remoteByKey=new Map(remote.map(place=>[placeKey(place.latitude,place.longitude),place]));
  for(const [sortOrder,place] of merged.entries()){
   const existing=remoteByKey.get(placeKey(place.lat,place.lon));
   await client.requestPersonal('/api/personal/places','PUT',{place:{
    id:existing?.id||idFromPlace(place),label:String(place.name||place.address||'관심 지역').trim().slice(0,80),
    latitude:place.lat,longitude:place.lon,sortOrder,isDefault:false
   }});
  }
  lastDeviceKeys=new Set(merged.map(place=>placeKey(place.lat,place.lon)));
 }
 function schedule(){
  requested=true;
  if(running)return running;
  running=(async()=>{
   while(requested&&activeUid&&activeClient){
    requested=false;
    const uid=activeUid,client=activeClient;
    await synchronize(uid,client);
   }
  })().catch(emitError).finally(()=>{running=null;if(requested&&activeUid&&activeClient)schedule();});
  return running;
 }
 function register(account){
  if(!account||stopPolicy||typeof account.registerPolicy!=='function')return;
  stopPolicy=account.registerPolicy({
   id:POLICY,
   onLogin(user,{client}){
    activeUid=user?.uid||null;activeClient=client;lastDeviceKeys=null;
    return activeUid&&activeClient?schedule():undefined;
   },
   onLogout(){activeUid=null;activeClient=null;lastDeviceKeys=null;requested=false;}
  });
  account.ready().catch(emitError);
 }
 window.addEventListener('softm:account-ready',event=>{
  if(event.detail?.siteId===SITE)register(event.detail.account||context());
 });
 window.addEventListener('weatherhannun:places-changed',()=>{
  if(!suppressPlaceEvent&&activeUid&&activeClient)schedule();
 });
 register(context());
})();
