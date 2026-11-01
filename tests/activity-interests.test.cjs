const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../activity-interests-core.js');
const items=[{key:'harvest',data:{score:100}},{key:'walk',data:{score:40}},{key:'laundry',data:{score:30}},{key:'carwash',data:{score:null}}];
test('new users only receive everyday activities even when farming scores higher',()=>{
 assert.deepEqual(core.rank(items,null).map(x=>x.key),['walk','laundry','carwash']);
});
test('explicit farming selection, empty preferences, invalid values, and all-activity discovery',()=>{
 assert.deepEqual(core.rank(items,['harvest','walk']).map(x=>x.key),['harvest','walk']);
 assert.deepEqual(core.rank(items,[]),[]);
 assert.deepEqual(core.normalize(['bad','walk','walk']),['walk']);
 assert.equal(core.rank(items,[],true).length,4);
 assert.deepEqual(core.normalize('broken'),['walk','laundry','carwash']);
});
test('ties favor everyday activities and missing scores never outrank known conditions',()=>{
 const rows=[{key:'harvest',data:{score:80}},{key:'walk',data:{score:80}},{key:'laundry',data:{score:null}}];
 assert.deepEqual(core.rank(rows,['harvest','walk','laundry']).map(x=>x.key),['walk','harvest','laundry']);
 assert.equal(rows[0].key,'harvest');
});
