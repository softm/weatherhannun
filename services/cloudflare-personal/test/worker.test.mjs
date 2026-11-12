import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';
test('personal API fails closed without verified account token',async()=>{
 const res=await worker.fetch(new Request('https://example.com/api/personal/preferences',{headers:{Authorization:'Bearer forged'}}),{});
 assert.equal(res.status,503);
 assert.equal((await res.json()).error,'verified_auth_not_configured');
});
test('unapproved origins are rejected',async()=>{
 const res=await worker.fetch(new Request('https://example.com/api/personal/preferences',{headers:{Origin:'https://evil.example'}}),{});
 assert.equal(res.status,403);
});
test('health is unavailable without dedicated D1 binding',async()=>{
 const res=await worker.fetch(new Request('https://example.com/health'),{});
 assert.equal(res.status,503);
});
