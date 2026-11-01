import {test, expect} from '@playwright/test';
import fs from 'node:fs';
const forecast=JSON.parse(fs.readFileSync(new URL('../fixtures/mobile-weather.json',import.meta.url)));
async function start(page,missing=false){
 await page.route('**/weatherApi?**',r=>r.fulfill({status:503,body:'{}'}));
 await page.route('https://api.open-meteo.com/**',r=>{const data=structuredClone(forecast);if(missing)for(const key of ['temperature_2m','precipitation_probability','precipitation','wind_speed_10m','wind_gusts_10m'])data.hourly[key]=data.hourly.time.map(()=>null);return r.fulfill({json:data});});
 await page.route('https://air-quality-api.open-meteo.com/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.addInitScript(()=>{localStorage.setItem('weatherhannun_geo_intro_v1','done');sessionStorage.setItem('weatherhannun:startup-briefing:session:v1','shown');localStorage.setItem('weatherhannun_location',JSON.stringify({name:'서울',lat:37.5665,lon:126.978,source:'manual'}));});
 await page.goto('/');
 await expect(page.locator('#stitch-live-dashboard [data-official-temp]')).not.toHaveText('--');
 await expect(page.locator('.explorer-hour')).toHaveCount(24);
}
async function view(page,name){if(!await page.locator(`button[data-view="${name}"]:visible`).count())await page.locator('#headerMenuButton').click();await page.locator(`button[data-view="${name}"]:visible`).first().click();await expect(page.locator('#view-'+name)).toHaveClass(/active/);}
for(const width of [320,360,375,390,430,768,1280])test(`responsive ${width}px: all primary views`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await start(page);
 for(const name of ['today','hourly','weekly','activity','map']){
  await view(page,name);
  await expect(page.locator('#toast')).toBeHidden({timeout:10000});await expect(page.locator('.action-progress')).toBeHidden({timeout:10000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath(`${name}-${width}.png`),fullPage:true});
  if(width<768){const box=await page.locator('.mobile-nav').boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);}
 }
 await view(page,'hourly');
 await page.evaluate(()=>document.documentElement.dataset.weatherTheme='dark');
 expect(await page.locator('.explorer-hour').first().evaluate(e=>e.clientWidth)).toBeGreaterThan(70);
 await page.screenshot({path:info.outputPath(`dark-hourly-${width}.png`),fullPage:true});
});
test('timeline, chart, keyboard, ranges, details and weekly selection',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await page.locator('#stitchHourlyTrack button').nth(2).click();
 await expect(page.locator('#view-hourly')).toHaveClass(/active/);
 await expect(page.locator('[data-explorer-hour="2"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-explorer-hour="2"]').press('ArrowRight');
 await expect(page.locator('[data-explorer-hour="3"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#hourlySelectedLine')).toHaveAttribute('x1','280');
 await page.locator('rect[data-chart-hour="1"]').click();
 await expect(page.locator('[data-explorer-hour="1"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#hourlyExtra summary').click();await expect(page.locator('.selected-hour-extra')).toBeVisible();
 await page.locator('[data-rain-period="48"]').click();await expect(page.locator('.explorer-hour')).toHaveCount(48);
 await page.locator('[data-rain-period="168"]').click();expect(await page.locator('.explorer-hour').count()).toBeGreaterThan(48);
 await page.locator('#hourlyAll summary').click();await expect(page.locator('#hourlyAllRows tr')).toHaveCount(await page.locator('.explorer-hour').count());
 await page.locator('[data-table-hour="30"]').click();await expect(page.locator('[data-explorer-hour="30"]')).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('#hourlyScroll').evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
 await page.locator('#hourlyNow').click();await expect(page.locator('[data-explorer-hour="0"]')).toHaveAttribute('aria-pressed','true');
 await view(page,'weekly');await page.locator('[data-week-index="1"]').click();await expect(page.locator('[data-week-index="1"]')).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('.week-row-detail').nth(1)).toBeVisible();
 expect(errors).toEqual([]);
});
test('missing metrics never become zero or a continuous chart',async({page})=>{
 await start(page,true);await view(page,'hourly');
 await expect(page.locator('.hour-temp').first()).toHaveText('--');await expect(page.locator('.hour-rain').first()).toHaveText('--');
 await expect(page.locator('#hourlyChart')).toContainText('기온 정보 없음');await page.locator('#hourlyExtra summary').click();
 await expect(page.locator('.selected-hour-extra dd').first()).toHaveText('--');
});
test('visible narrator, 10/30-second modes, saved region and temporary map selection',async({page})=>{
 await start(page);const short=await page.locator('.stitch-caster-briefing').textContent();
 await page.locator('[data-brief-mode="detail"]').click();await expect(page.locator('[data-brief-mode="detail"]')).toHaveAttribute('aria-pressed','true');
 expect((await page.locator('.stitch-caster-briefing').textContent()).length).toBeGreaterThan(short.length);
 await page.evaluate(()=>{window.WeatherHannunCloudTTS={configured:()=>true,stop(){},play:async text=>{window.testSpoken=text;}};});
 await page.locator('[data-stitch-brief-play]').click();expect(await page.evaluate(()=>window.testSpoken)).toContain('서울');
 await page.locator('[data-location-save-current]').click();
 const saved=await page.evaluate(()=>localStorage.getItem('weatherhannun_location'));
 await view(page,'map');await page.locator('[data-national-city="1"]').click();
 await expect(page.locator('#view-today')).toHaveClass(/active/);
 expect(await page.evaluate(()=>localStorage.getItem('weatherhannun_location'))).toBe(saved);
 await page.locator('[data-location-manage]').click();await page.locator('[data-location-select]').first().click();
 await expect(page.locator('.header-current-button strong')).toHaveText('서울');
});

test('address search, GPS, refresh loading, custom dates and details links',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:37.5665,longitude:126.978});await start(page);
 await page.locator('[data-location-manage]').click();await page.locator('#locationSearch').fill('옥길동');
 await expect(page.locator('[data-region-choice]').first()).toBeVisible();await page.locator('[data-region-choice]').first().click();
 await expect(page.locator('.header-current-button strong')).toContainText('옥길');
 await page.locator('#dialogClose').click();await page.locator('[data-geo-quick]').click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('weatherhannun_location')).source)).toBe('gps');
 await page.route('**/weatherApi?**',async r=>{await new Promise(resolve=>setTimeout(resolve,1000));await r.fulfill({status:503,body:'{}'});});
 await page.locator('#headerMenuButton').click();await page.locator('#refreshButton').click();await expect(page.locator('#refreshButton')).toBeDisabled();await expect(page.locator('#refreshButton')).toBeEnabled({timeout:20000});
 await page.locator('.rain-decision-link').click();await expect(page.locator('#view-hourly')).toHaveClass(/active/);
 await page.locator('[data-rain-period="custom"]').click();const day=await page.locator('#rainDateStart').inputValue();await page.locator('#rainDateEnd').fill(day);await page.locator('#applyRainDates').click();
 expect(await page.locator('.explorer-hour').count()).toBeLessThanOrEqual(24);
 await view(page,'today');await page.locator('.stitch-week-row').nth(1).click();await expect(page.locator('[data-week-index="1"]')).toHaveAttribute('aria-expanded','true');
 await view(page,'today');await page.locator('.air-quality-glance').click();await expect(page.locator('#view-air')).toHaveClass(/active/);
});
test('active official warning stays exposed with original source link',async({page})=>{
 await page.route('**/data/official/latest.json?**',r=>r.fulfill({json:{schemaVersion:1,status:'ready',generatedAt:new Date().toISOString(),rights:[{verified:true}],kma:{observations:{current:[],previous:[]},warnings:[{upperRegionName:'서울특별시',regionName:'서울',warningCode:'RAIN'}]},airKorea:{measurements:[]}}}));
 await start(page);const warning=page.locator('#stitch-live-dashboard .official-glance-line');
 await expect(warning).toHaveAttribute('data-warning-state','local');await expect(warning).toBeVisible();
 expect(await warning.evaluate(e=>e.parentElement.classList.contains('stitch-dashboard-hero'))).toBe(true);
 await expect(warning.locator('a')).toHaveAttribute('href',/weather\.go\.kr/);
});
test('mobile reading contrast, touch targets and navigation clearance',async({page})=>{
 await start(page);
 const contrast=await page.locator('.quick-badge').first().evaluate(e=>{const c=getComputedStyle(e);const lum=s=>{const rgb=s.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const a=lum(c.color),b=lum(c.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
 expect(contrast).toBeGreaterThanOrEqual(4.5);
 for(const selector of ['[data-brief-mode="detail"]','[data-stitch-brief-play]','.mobile-nav button'])expect((await page.locator(selector).first().boundingBox()).height).toBeGreaterThanOrEqual(44);
 await view(page,'hourly');await page.locator('.hourly-alert').scrollIntoViewIfNeeded();const box=await page.locator('.hourly-alert').boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(nav.y);
});
