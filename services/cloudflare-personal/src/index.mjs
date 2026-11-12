// Fail closed until the common account service offers server-side token verification.
// Do not accept client-supplied UID or unverified bearer token claims.
const allowedOrigins = new Set(['https://softm.github.io','http://localhost:8080','http://127.0.0.1:8080']);
function json(data,status=200,origin='') {
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(allowedOrigins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 return new Response(JSON.stringify(data),{status,headers});
}
export default {
 async fetch(request,env) {
  const origin=request.headers.get('Origin')||'';
  if(origin&&!allowedOrigins.has(origin))return json({error:'origin_not_allowed'},403,origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
   'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'null',
   'Access-Control-Allow-Headers':'Authorization,Content-Type',
   'Access-Control-Allow-Methods':'GET,OPTIONS','Vary':'Origin'}});
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET') {
   let ready=false;
   try {if(env.PERSONAL_DB){await env.PERSONAL_DB.prepare('SELECT 1 FROM user_preferences LIMIT 1').first();ready=true;}}catch{}
   return json({ok:ready,database:ready?'personal-d1':'unavailable',personalizationApi:'pending_verified_auth'},ready?200:503,origin);
  }
  if(path.startsWith('/api/personal/'))return json({error:'verified_auth_not_configured',message:'공통 계정 서버의 토큰 검증 연결 전에는 개인화 데이터를 제공하지 않습니다.'},503,origin);
  return json({error:'not_found'},404,origin);
 }
};
