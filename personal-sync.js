/* Explicit per-account D1 sync. No GPS uploads, automatic writes or silent local replacement. */
(function(){
 'use strict';
 const KEY='weatherhannun_places_v2',SITE='weatherhannun';
 let busy=false;
 const readLocal=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[];}catch{return [];}};
 const context=()=>window.SoftmAccounts?.get(SITE);
 function idFromPlace(p){return 'loc_'+p.lat.toFixed(3).replace('.', '_')+'_'+p.lon.toFixed(3).replace('.', '_');}
 async function client(){
  const ctx=context();
  if(!ctx?.currentUser)throw Error('먼저 공통 계정에 로그인해 주세요.');
  const sdk=await ctx.ready();
  if(typeof sdk?.requestPersonal!=='function')throw Error('계정 동기화 기능을 불러올 수 없습니다.');
  return sdk;
 }
 function init(){
  if(document.getElementById('weatherPersonalSync'))return;
  const holder=document.getElementById('favoriteLocations');
  if(!holder)return;
  const container=document.createElement('div');
  container.style.cssText='padding:12px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  const upload=document.createElement('button');
  upload.id='weatherPersonalSync';upload.type='button';upload.className='button';
  upload.textContent='이 기기의 관심 지역 계정에 저장';
  const restore=document.createElement('button');
  restore.id='weatherPersonalRestore';restore.type='button';restore.className='button';
  restore.textContent='계정에서 관심 지역 가져오기';
  const info=document.createElement('span');
  info.id='weatherPersonalSyncStatus';info.setAttribute('role','status');
  info.style.cssText='font-size:12px;flex-basis:100%';
  container.append(upload,restore,info);holder.after(container);
  async function execute(operation){
   if(busy)return;
   if(!context()?.currentUser){info.textContent='공통 계정으로 먼저 로그인해 주세요.';return;}
   const message=operation==='upload'
    ?'현재 기기의 저장 지역을 계정에 추가합니다. GPS 위치는 전송하지 않고 서버에 있는 지역을 덮어쓰지 않습니다. 계속할까요?'
    :'계정의 저장 지역을 이 기기에 추가합니다. 기존 지역은 유지되며, 가져온 지역도 이 기기에 저장되어 로그아웃 후 남습니다. 계속할까요?';
   if(!confirm(message))return;
   busy=true;upload.disabled=restore.disabled=true;info.textContent='계정 데이터를 확인 중…';
   try{
    const sdk=await client(),remote=await sdk.requestPersonal('/api/personal/places');
    if(operation==='upload'){
     const places=readLocal().filter(p=>p&&p.source!=='gps'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180).slice(0,10);
     const known=new Set((remote.places||[]).map(p=>p.id));
     let count=0;
     for(const [i,p] of places.entries()){
      const id=idFromPlace(p);
      if(known.has(id))continue;
      await sdk.requestPersonal('/api/personal/places','PUT',{place:{
       id,label:String(p.name||p.address||'관심 지역').trim().slice(0,80),
       latitude:p.lat,longitude:p.lon,sortOrder:i,isDefault:false
      }});
      known.add(id);count++;
     }
     info.textContent='계정에 '+count+'개 추가 완료. 기존 서버 지역은 유지했습니다.';
    }else{
     const manager=window.WeatherLocationManager;
     if(typeof manager?.mergeCloudPlaces!=='function')throw Error('지역 관리 기능을 다시 불러와 주세요.');
     const incoming=(remote.places||[]).filter(p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))
      .map(p=>({name:String(p.label||'관심 지역'),lat:p.latitude,lon:p.longitude,source:'manual'}));
     const result=manager.mergeCloudPlaces(incoming);
     if(!result.ok)throw Error('기기 저장소에 기록하지 못했습니다.');
     info.textContent='이 기기에 '+result.added+'개 추가했습니다 (총 '+result.total+'/10개). 기존 지역은 유지했습니다.';
    }
   }catch(e){info.textContent='동기화 실패: '+String(e.message||e);}
   finally{busy=false;upload.disabled=restore.disabled=false;}
  }
  upload.addEventListener('click',()=>execute('upload'));
  restore.addEventListener('click',()=>execute('restore'));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
