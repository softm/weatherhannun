import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.mjs';
const token='A'.repeat(43);
const request=(path,method='GET',body)=>new Request('https://example.com'+path,{method,headers:{Origin:'https://softm.github.io',Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
const fakeFetch=async()=>new Response(JSON.stringify({uid:'user-1',site:'weatherhannun'}),{status:200});
test('rejects missing or invalid bearer',async()=>{
 const res=await handleRequest(new Request('https://example.com/api/personal/preferences'),{PERSONAL_DB:{}});
 assert.equal(res.status,401);
});
test('rejects other origins',async()=>{
 const res=await handleRequest(new Request('https://example.com/api/personal/preferences',{headers:{Origin:'https://evil.example'}}),{});
 assert.equal(res.status,403);
});
test('rejects unverified token',async()=>{
 const res=await handleRequest(request('/api/personal/preferences'),{PERSONAL_DB:{}},{fetch:async()=>new Response('{}',{status:401})});
 assert.equal(res.status,401);
});
test('reads preferences scoped to verified UID',async()=>{
 let bound;
 const db={prepare:()=>({bind:(...args)=>{bound=args;return {first:async()=>({settings_json:'{"theme":"dark"}',activities_json:'[]',alerts_json:'[]',updated_at:'now'})};}})};
 const res=await handleRequest(request('/api/personal/preferences'),{PERSONAL_DB:db},{fetch:fakeFetch});
 assert.equal(res.status,200);
 assert.deepEqual(bound,['user-1']);
 assert.equal((await res.json()).settings.theme,'dark');
});
test('health unavailable without dedicated D1',async()=>{
 const res=await handleRequest(new Request('https://example.com/health'),{});
 assert.equal(res.status,503);
});
