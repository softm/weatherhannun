const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('personal sync is mounted in the weather web entrypoint', () => {
  const html = read('index.html');
  assert.match(html, /<script\s+defer\s+src="\.\/personal-sync\.js\?v=\d+"/);
  assert.match(html, /cloudflare-weather-boot\.mjs/);
});

test('saved places use the per-service Cloudflare personal API automatically after login', () => {
  const source = read('personal-sync.js');
  assert.match(source, /requestPersonal\('\/api\/personal\/places'\)/);
  assert.match(source, /requestPersonal\('\/api\/personal\/places','PUT'/);
  assert.match(source, /requestPersonal\('\/api\/personal\/places\/'\+encodeURIComponent\(place\.id\),'DELETE'\)/);
  assert.match(source, /registerPolicy\(\{/);
  assert.match(source, /onLogin\(user,\{client\}\)/);
  assert.match(source, /weatherhannun:places-changed/);
  assert.match(source, /place\.source!=='gps'/);
  assert.match(source, /mergeCloudPlaces\(incoming\)/);
});

test('manual account sync controls and confirmation prompts are removed', () => {
  const source = read('personal-sync.js');
  assert.doesNotMatch(source, /weatherPersonalSync|weatherPersonalRestore/);
  assert.doesNotMatch(source, /confirm\s*\(/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /setTimeout\s*\(/);
});

test('login merges account places and uploads only non-GPS saved places', async () => {
  const source = read('personal-sync.js');
  const events = {};
  const user = {uid:'account-user'};
  const remote = [{id:'loc_35_180_129_076',label:'부산',latitude:35.18,longitude:129.076,sortOrder:0,isDefault:false}];
  const local = [
    {id:'place:37.567:126.978',name:'서울',lat:37.567,lon:126.978,source:'manual'},
    {id:'place:37.500:127.100',name:'GPS 현재위치',lat:37.5,lon:127.1,source:'gps'}
  ];
  const writes = [];
  const client = {requestPersonal:async (url,method='GET',body)=>{
    if(method==='GET')return {places:remote};
    writes.push({url,method,body});
    if(method==='PUT'){
      const index=remote.findIndex(place=>place.id===body.place.id);
      if(index>=0)remote[index]=body.place;else remote.push(body.place);
    }
    if(method==='DELETE'){
      const id=decodeURIComponent(url.split('/').pop());
      const index=remote.findIndex(place=>place.id===id);
      if(index>=0)remote.splice(index,1);
    }
    return {ok:true};
  }};
  let policy;
  const account = {
    currentUser:user,
    ready:async()=>client,
    registerPolicy(value){policy=value;return ()=>{};}
  };
  const sandbox = {
    localStorage:{
      getItem:key=>key==='weatherhannun_places_v2'?JSON.stringify(local):null,
      setItem(key,value){if(key==='weatherhannun_places_v2'){local.splice(0,local.length,...JSON.parse(value));}}
    },
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}},
    window:{
      SoftmAccounts:new Map([['weatherhannun',account]]),
      addEventListener(type,handler){events[type]=handler;},
      dispatchEvent(){},
      WeatherLocationManager:{mergeCloudPlaces(incoming){
        for(const place of incoming){
          if(!local.some(item=>item.lat.toFixed(3)===place.lat.toFixed(3)&&item.lon.toFixed(3)===place.lon.toFixed(3)))local.push(place);
        }
        return {ok:true};
      }}
    }
  };
  vm.runInNewContext(source,sandbox,{filename:'personal-sync.js'});
  await policy.onLogin(user,{client});
  assert.deepEqual(local.map(place=>place.name).sort(),['GPS 현재위치','부산','서울']);
  const uploaded = writes.filter(call=>call.method==='PUT').map(call=>call.body.place.label).sort();
  assert.deepEqual(uploaded,['부산','서울']);
  local.splice(local.findIndex(place=>place.name==='서울'),1);
  events['weatherhannun:places-changed']();
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(writes.some(call=>call.method==='DELETE'&&call.url.endsWith('/loc_37_567_126_978')));
});
