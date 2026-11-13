import {test,expect} from '@playwright/test';

const SITE='https://softm.github.io/weatherhannun/';
const PERSONAL='https://weatherhannun-personal.softm.workers.dev';
const ACCOUNT='https://softm-hannun-account.softm.workers.dev';
const TOKEN='A'.repeat(43);
const nowUser=()=>({uid:'playwright-only-test-user',token:TOKEN,provider:'google',displayName:'테스트',providers:['google'],expiresAt:Date.now()+3_600_000});
const sdkSessionKey='softm-cloudflare:weatherhannun:softm-hannun-account.softm.workers.dev';

async function load(page,{places=[],signedIn=false,native=false}={}){
  await page.addInitScript(({places,signedIn,key,user,native})=>{
    localStorage.setItem('weatherhannun_geo_intro_v1','done');
    sessionStorage.setItem('weatherhannun:startup-briefing:session:v1','shown');
    localStorage.setItem('weatherhannun_location',JSON.stringify({name:'서산',lat:36.7845,lon:126.4503,source:'manual'}));
    localStorage.setItem('weatherhannun_places_v2',JSON.stringify(places));
    if(signedIn)sessionStorage.setItem(key,JSON.stringify(user));
    if(native){
      window.WeatherHannunAndroid={
        startCloudflareLogin(url){window.__playwrightNativeLoginUrl=url;return true;},
        takeCloudflareLoginResult(){return '';}
      };
      const prior=window.fetch.bind(window);
      window.fetch=(input,init)=>String(input).includes('/api/connect/exchange')
        ?Promise.resolve(new Response(JSON.stringify({
          accessToken:'T'.repeat(43),uid:'native-test-user',
          expiresIn:3600,displayName:'Android 테스트',providers:['google']
        }),{status:200,headers:{'Content-Type':'application/json'}}))
        :prior(input,init);
    }
  },{places,signedIn,key:sdkSessionKey,user:nowUser(),native});
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('softm-site-account[data-site="weatherhannun"]')).toBeVisible({timeout:30000});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.SoftmAccounts?.get('weatherhannun')))).toBe(true);
}
async function enterPlaces(page){
  const manage=page.locator('[data-location-manage]').first();
  await expect(manage).toBeVisible({timeout:20000});
  await manage.click();
  await expect(page.locator('#weatherPersonalSync')).toBeVisible();
  await expect(page.locator('#weatherPersonalRestore')).toBeVisible();
}
async function emulateCloud(context,rows){
  await context.route('**/api/personal/places',async route=>{
    const request=route.request(),method=request.method(),url=new URL(request.url());
    if(url.origin!==PERSONAL)return route.continue();
    const headers={
      'Access-Control-Allow-Origin':'https://softm.github.io',
      'Access-Control-Allow-Headers':'Authorization,Content-Type',
      'Access-Control-Allow-Methods':'GET,PUT,DELETE,OPTIONS',
      'Content-Type':'application/json'
    };
    if(method==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    if(!request.headers().authorization?.startsWith('Bearer '))
      return route.fulfill({status:401,headers,json:{error:'unauthorized'}});
    if(method==='GET')return route.fulfill({status:200,headers,json:{places:[...rows.values()]}});
    if(method==='PUT'){
      const place=request.postDataJSON()?.place;
      if(!place||!place.id)return route.fulfill({status:400,headers,json:{error:'invalid_place'}});
      rows.set(place.id,place);
      return route.fulfill({status:200,headers,json:{ok:true}});
    }
    return route.fulfill({status:405,headers,json:{error:'method_not_allowed'}});
  });
}

test('operational guest page imports account SDK without previous syntax errors',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await load(page);
  const result=await page.evaluate(async()=>{
    const account=window.SoftmAccounts.get('weatherhannun');
    const sdk=await account.ready();
    return {siteId:sdk.siteId,loggedIn:!!account.currentUser};
  });
  expect(result).toEqual({siteId:'weatherhannun',loggedIn:false});
  expect(errors.filter(message=>/Invalid regular expression flags|Unexpected token '\)'/.test(message))).toEqual([]);
  await page.locator('softm-site-account[data-site="weatherhannun"] #profile').click();
  await expect(page.locator('softm-account-popover[data-site="weatherhannun"] #login')).toBeVisible();
});

test('production D1 and common account APIs reject unauthenticated or foreign-origin requests',async({request})=>{
  const health=await request.get(PERSONAL+'/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ok:true,database:'personal-d1',personalizationApi:'authenticated'});
  const missing=await request.get(PERSONAL+'/api/personal/places',{headers:{Origin:'https://softm.github.io'}});
  expect(missing.status()).toBe(401);
  const foreign=await request.get(PERSONAL+'/api/personal/places',{headers:{Origin:'https://not-softm.example'}});
  expect(foreign.status()).toBe(403);
  const unauthorized=await request.get(ACCOUNT+'/api/apps/weatherhannun/session',{headers:{Origin:'https://softm.github.io'}});
  expect(unauthorized.status()).toBe(401);
});

test('simulated native Android browser login completes same-UID session without WebView popup',async({page})=>{
  await load(page,{native:true});
  await page.locator('softm-site-account[data-site="weatherhannun"] #profile').click();
  await page.locator('softm-account-popover[data-site="weatherhannun"] #login').click();
  await expect.poll(()=>page.evaluate(()=>window.__playwrightNativeLoginUrl||'')).toContain('/connect?');
  const callback=await page.evaluate(()=>{
    const u=new URL(window.__playwrightNativeLoginUrl);
    return {request:u.searchParams.get('request'),site:u.searchParams.get('site'),
      origin:u.searchParams.get('origin'),challenge:u.searchParams.get('challenge')};
  });
  expect(callback.site).toBe('weatherhannun');
  expect(callback.origin).toBe('https://softm.github.io');
  expect(callback.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await page.evaluate(request=>{
    window.dispatchEvent(new CustomEvent('weatherhannun:auth-return',
      {detail:{request,code:'C'.repeat(43)}}));
  },callback.request);
  await expect.poll(()=>page.evaluate(()=>window.SoftmAccounts.get('weatherhannun').currentUser?.uid)).toBe('native-test-user');
  await expect(page.locator('softm-site-account[data-site="weatherhannun"]')).toHaveAttribute('data-auth-state','authenticated');
});

test('two devices manually upload and restore places; local regions stay intact and GPS is not uploaded',async({browser})=>{
  const cloud=new Map();
  const pc=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const android=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  try{
    await emulateCloud(pc,cloud);
    await emulateCloud(android,cloud);
    const first=await pc.newPage();
    await load(first,{signedIn:true,places:[
      {name:'서울',lat:37.5665,lon:126.978,source:'manual'},
      {name:'GPS 현재위치',lat:37.5,lon:127.1,source:'gps'}
    ]});
    await enterPlaces(first);
    first.once('dialog',dialog=>dialog.accept());
    await first.locator('#weatherPersonalSync').click();
    await expect(first.locator('#weatherPersonalSyncStatus')).toContainText('1개 추가 완료',{timeout:15000});
    expect(cloud.size).toBe(1);
    expect([...cloud.values()][0]).toMatchObject({label:'서울',isDefault:false});

    const second=await android.newPage();
    await load(second,{signedIn:true,places:[{name:'부산',lat:35.1796,lon:129.0756,source:'manual'}]});
    await enterPlaces(second);
    second.once('dialog',dialog=>dialog.accept());
    await second.locator('#weatherPersonalRestore').click();
    await expect(second.locator('#weatherPersonalSyncStatus')).toContainText('1개 추가',{timeout:15000});
    let saved=await second.evaluate(()=>JSON.parse(localStorage.getItem('weatherhannun_places_v2')));
    expect(saved.map(p=>p.name)).toEqual(expect.arrayContaining(['부산','서울']));
    expect(saved).toHaveLength(2);
    expect(cloud.size).toBe(1);

    second.once('dialog',dialog=>dialog.accept());
    await second.locator('#weatherPersonalRestore').click();
    await expect(second.locator('#weatherPersonalSyncStatus')).toContainText('0개 추가',{timeout:15000});
    saved=await second.evaluate(()=>JSON.parse(localStorage.getItem('weatherhannun_places_v2')));
    expect(saved).toHaveLength(2);
  }finally{
    await pc.close();
    await android.close();
  }
});
