/* Explicit first-time sync: never upload GPS, never silently overwrite local places. */
(function(){
 'use strict';
 const KEY='weatherhannun_places_v2';
 const ACCOUNT='weatherhannun';
 let busy=false;
 const safePlaces=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return [];}};
 const account=()=>window.SoftmAccounts?.get(ACCOUNT);
 const ui=()=>{
  if(document.getElementById('weatherPersonalSync'))return;
  const holder=document.getElementById('favoriteLocations');
  if(!holder)return;
  const container=document.createElement('div');
  container.style.cssText='padding:12px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  const button=document.createElement('button');button.id='weatherPersonalSync';button.type='button';
  button.textContent='로그인 계정에 관심 지역 동기화';button.className='button';
  const info=document.createElement('span');info.id='weatherPersonalSyncStatus';info.setAttribute('role','status');
  info.style.fontSize='12px';
  container.append(button,info);holder.after(container);
  button.addEventListener('click',async()=>{
   if(busy)return;
   const client=account();
   if(!client?.currentUser||typeof client.requestPersonal!=='function'){
    info.textContent='공통 계정으로 먼저 로그인해 주세요.';return;
   }
   if(!confirm('이 기기의 저장 지역과 계정의 저장 지역을 병합합니다. GPS 현재 위치는 업로드하지 않습니다. 계속할까요?'))return;
   busy=true;button.disabled=true;info.textContent='동기화 중…';
   try{
    const remote=await client.requestPersonal('/api/personal/places');
    const local=safePlaces().filter(p=>p&&p.source!=='gps'&&p.id&&/^[A-Za-z0-9_-]{1,80}$/.test(p.id)&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    const existing=new Map((remote.places||[]).map(p=>[p.id,p]));
    for(const [i,p] of local.entries()){
     if(existing.has(p.id))continue; // server wins on same ID; never overwrite
     const place={id:p.id,label:String(p.name||p.address||'저장 지역').slice(0,80),latitude:p.lat,longitude:p.lon,sortOrder:i,isDefault:false};
     await client.requestPersonal('/api/personal/places','PUT',{place});
     existing.set(p.id,place);
    }
    const merged=await client.requestPersonal('/api/personal/places');
    // Keep the local list unchanged until a deliberate restore is implemented.
    info.textContent='계정 저장 완료 ('+merged.places.length+'개). 다른 기기 복원은 다음 단계에서 연결됩니다.';
   }catch(e){info.textContent='동기화 실패: '+String(e.message||e);}
   finally{busy=false;button.disabled=false;}
  });
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ui);else ui();
})();
