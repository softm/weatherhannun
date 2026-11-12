const allowedOrigins=new Set(['https://softm.github.io','http://localhost:8080','http://127.0.0.1:8080']);
const accountUrl='https://softm-hannun-account.softm.workers.dev/api/apps/weatherhannun/session';
const idPattern=/^[A-Za-z0-9_-]{1,80}$/;
function json(data,status=200,origin=''){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(allowedOrigins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 return new Response(JSON.stringify(data),{status,headers});
}
async function identity(request,origin,fetcher){
 const token=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(token))return null;
 const response=await fetcher(accountUrl,{headers:{Authorization:token,Origin:origin||'https://softm.github.io'},cache:'no-store'});
 if(!response.ok)return null;
 const data=await response.json();
 return data.site==='weatherhannun'&&typeof data.uid==='string'&&data.uid.length>0&&data.uid.length<=128?data.uid:null;
}
function validJSON(v,max=12000){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&JSON.stringify(v).length<=max;}
export async function handleRequest(request,env,dependencies={}){
 const origin=request.headers.get('Origin')||'';
 if(origin&&!allowedOrigins.has(origin))return json({error:'origin_not_allowed'},403,origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'null',
  'Access-Control-Allow-Headers':'Authorization,Content-Type',
  'Access-Control-Allow-Methods':'GET,PUT,DELETE,OPTIONS','Vary':'Origin'}});
 const path=new URL(request.url).pathname;
 if(path==='/health'&&request.method==='GET'){
  let ready=false;
  try{if(env.PERSONAL_DB){await env.PERSONAL_DB.prepare('SELECT 1 FROM user_preferences LIMIT 1').first();ready=true;}}catch{}
  return json({ok:ready,database:ready?'personal-d1':'unavailable',personalizationApi:'authenticated'},ready?200:503,origin);
 }
 if(!path.startsWith('/api/personal/'))return json({error:'not_found'},404,origin);
 if(!env.PERSONAL_DB)return json({error:'database_unavailable'},503,origin);
 let uid;
 try{uid=await identity(request,origin,dependencies.fetch||fetch);}
 catch{return json({error:'identity_service_unavailable'},503,origin);}
 if(!uid)return json({error:'unauthorized'},401,origin);
 const db=env.PERSONAL_DB;
 if(path==='/api/personal/preferences'){
  if(request.method==='GET'){
   const row=await db.prepare('SELECT settings_json,activities_json,alerts_json,updated_at FROM user_preferences WHERE user_id=?').bind(uid).first();
   return json({settings:JSON.parse(row?.settings_json||'{}'),activities:JSON.parse(row?.activities_json||'[]'),alerts:JSON.parse(row?.alerts_json||'[]'),updatedAt:row?.updated_at||null},200,origin);
  }
  if(request.method==='PUT'){
   let data;try{data=await request.json();}catch{return json({error:'invalid_json'},400,origin);}
   if(!validJSON(data)||!validJSON(data.settings)||!Array.isArray(data.activities)||!Array.isArray(data.alerts)||JSON.stringify(data).length>12000)return json({error:'invalid_preferences'},400,origin);
   await db.prepare("INSERT INTO user_preferences(user_id,settings_json,activities_json,alerts_json,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json,activities_json=excluded.activities_json,alerts_json=excluded.alerts_json,updated_at=CURRENT_TIMESTAMP")
    .bind(uid,JSON.stringify(data.settings),JSON.stringify(data.activities),JSON.stringify(data.alerts)).run();
   return json({ok:true},200,origin);
  }
 }
 if(path==='/api/personal/places'){
  if(request.method==='GET'){
   const result=await db.prepare('SELECT place_id,label,latitude,longitude,sort_order,is_default FROM user_places WHERE user_id=? ORDER BY sort_order,place_id LIMIT 100').bind(uid).all();
   return json({places:(result.results||[]).map(r=>({id:r.place_id,label:r.label,latitude:r.latitude,longitude:r.longitude,sortOrder:r.sort_order,isDefault:!!r.is_default}))},200,origin);
  }
  if(request.method==='PUT'){
   let data;try{data=await request.json();}catch{return json({error:'invalid_json'},400,origin);}
   const p=data?.place;
   if(!p||!idPattern.test(p.id)||typeof p.label!=='string'||p.label.length>80||!p.label.trim()||typeof p.latitude!=='number'||Math.abs(p.latitude)>90||typeof p.longitude!=='number'||Math.abs(p.longitude)>180||!Number.isInteger(p.sortOrder??0)||Math.abs(p.sortOrder??0)>100000)return json({error:'invalid_place'},400,origin);
   if(p.isDefault)await db.prepare('UPDATE user_places SET is_default=0 WHERE user_id=?').bind(uid).run();
   await db.prepare("INSERT INTO user_places(user_id,place_id,label,latitude,longitude,sort_order,is_default,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,place_id) DO UPDATE SET label=excluded.label,latitude=excluded.latitude,longitude=excluded.longitude,sort_order=excluded.sort_order,is_default=excluded.is_default,updated_at=CURRENT_TIMESTAMP")
    .bind(uid,p.id,p.label,p.latitude,p.longitude,p.sortOrder??0,p.isDefault?1:0).run();
   return json({ok:true},200,origin);
  }
 }
 const match=path.match(/^\/api\/personal\/places\/([A-Za-z0-9_-]{1,80})$/);
 if(match&&request.method==='DELETE'){
  await db.prepare('DELETE FROM user_places WHERE user_id=? AND place_id=?').bind(uid,match[1]).run();
  return json({ok:true},200,origin);
 }
 return json({error:'method_not_allowed_or_not_found'},405,origin);
}
export default {fetch:handleRequest};
