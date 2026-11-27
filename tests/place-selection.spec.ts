import {test,expect,type Page} from '@playwright/test';
test.use({actionTimeout:10000});
// MOCK: every Kakao/bus/TMAP response below is a fixture. No real TMAP request is made by this file.
const a={id:'select-a',label:'선택 검증 집 A',address:'선택 검증 집 A 주소',source:'kakao',coordinates:{lat:37.55,lng:126.91}},b={...a,id:'select-b',label:'선택 검증 집 B',address:'선택 검증 집 B 주소',coordinates:{lat:37.56,lng:126.92}};
const route=(distanceMeters:number,seconds:number)=>({provider:'tmap',status:'ok',distanceMeters,seconds,fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const near=(lat:number,lng:number)=>(p:{lat:number;lng:number})=>Math.abs(p.lat-lat)<1e-9&&Math.abs(p.lng-lng)<1e-9;
async function setup(page:Page,width:number){
  const calls:{lat:number;lng:number}[]=[],peeks:number[]=[];let release:()=>void=()=>{};const slow=new Promise<void>(r=>release=r);
  await page.setViewportSize({width,height:950});
  await page.addInitScript(({a,b})=>{if(!localStorage.getItem('neighborhood-preview-v2'))localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[a,b],selectedId:a.id,saved:[],compare:[],notes:{},layers:['convenience','medical'],facilityLayerVersion:1,radius:500}));},{a,b});
  await page.route('**/api/locations/search?**',r=>r.fulfill({json:{results:[b]}}));
  await page.route('**/api/facilities?**',r=>{const p=new URL(r.request().url()).searchParams,category=p.get('category')!,origin={lat:Number(p.get('lat')),lng:Number(p.get('lng'))},step=category==='medical'?-.0012:.0012;
    return r.fulfill({json:{source:'kakao',origin,category,radius:500,limited:false,fetchedAt:new Date().toISOString(),places:[1,2,3].map(i=>({id:category+'-'+i,name:(category==='medical'?'검증 약국 ':'검증 편의점 ')+i,address:'검증 주소',jibunAddress:'',category,categoryName:category,coordinates:{lat:origin.lat+step*i,lng:origin.lng+.0006*i},distanceMeters:1}))}});});
  await page.route('**/api/transit/nearby?**',r=>{const p=new URL(r.request().url()).searchParams,origin={lat:Number(p.get('lat')),lng:Number(p.get('lng'))};return r.fulfill({json:{provider:'public',origin,radius:500,fetchedAt:new Date().toISOString(),stations:[{id:'seoul-bus-1',name:'검증 버스정류장',kind:'bus',coordinates:{lat:origin.lat+.002,lng:origin.lng-.002},distanceMeters:280,lineName:null,arsId:'01234'},{id:'kakao-subway-1',name:'검증 지하철역',kind:'subway',coordinates:{lat:origin.lat-.002,lng:origin.lng-.002},distanceMeters:280,lineName:null,arsId:null}]}});});
  // Server cache fixture: only the first convenience store of house A has a cached route.
  await page.route('**/api/walking/cached',r=>{const body=r.request().postDataJSON();peeks.push(body.destinations.length);return r.fulfill({json:{results:body.destinations.map((d:{lat:number;lng:number})=>near(a.coordinates.lat+.0012,a.coordinates.lng+.0006)(d)&&near(a.coordinates.lat,a.coordinates.lng)(body.origin)?route(130,110):null)}});});
  await page.route('**/api/tmap/walk',async r=>{const {destination}=r.request().postDataJSON();calls.push(destination);
    if(near(a.coordinates.lat-.0012,a.coordinates.lng+.0006)(destination)){await slow;return r.fulfill({json:route(290,230)});}
    if(near(a.coordinates.lat+.0024,a.coordinates.lng+.0012)(destination))return r.fulfill({status:502,json:{code:'UPSTREAM',error:'모의 실패'}});
    return r.fulfill({json:route(410,330)});});
  return {calls,peeks,release};
}
for(const width of [1440,390])test(`MOCK shared selectedPlaceId between list and map markers at ${width}px`,async({page},info)=>{
  const {calls,peeks,release}=await setup(page,width);
  await page.goto('/explore');await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});
  await expect(page.locator('.facility-map-marker')).toHaveCount(4);await expect(page.locator('.transit-map-marker')).toHaveCount(2);
  await page.locator('.facility-list-disclosure>summary').click();
  const row=(id:string)=>page.locator(`.facility-result[data-place-id="${id}"]`),marker=(id:string)=>page.locator(`.facility-map-marker[data-place-id="${id}"]`);
  // Cached route is displayed immediately; nothing else is queried by loading the map/list.
  await expect(row('convenience-1')).toContainText('도보 약 2분 · 130m');await expect(row('convenience-2')).toContainText('선택 시 도보 확인');
  await expect(page.locator('.facility-result-list')).not.toContainText('직선');expect(calls).toHaveLength(0);expect(peeks.length).toBeGreaterThan(0);
  // List → marker. A cached place does not call TMAP.
  await row('convenience-1').click();await expect(marker('convenience-1')).toHaveClass(/is-selected/);await expect(row('convenience-1')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('dialog',{name:'시설 상세 정보'})).toContainText('도보 130m · 예상 2분');expect(calls).toHaveLength(0);
  await expect(marker('convenience-1')).toHaveCSS('background-color','rgb(12, 42, 30)');await expect(marker('convenience-1')).toHaveCSS('transform','matrix(1.25, 0, 0, 1.25, 0, 0)');
  // Pending request: repeated clicks reuse one request, the row shows loading, then the real (mock) value.
  await row('medical-1').click();await expect(row('medical-1')).toContainText('도보 조회 중…');await row('medical-1').click();await marker('medical-1').click();
  await expect(marker('convenience-1')).not.toHaveClass(/is-selected/);await expect(row('convenience-1')).toHaveAttribute('aria-pressed','false');
  await expect(marker('medical-1')).toHaveClass(/is-selected/);await expect(marker('medical-1')).toHaveCSS('background-color','rgb(111, 35, 41)');await expect(marker('convenience-1')).toHaveCSS('transform','none');
  release();await expect(row('medical-1')).toContainText('도보 약 4분 · 290m');await expect(page.getByRole('dialog',{name:'시설 상세 정보'})).toContainText('도보 290m · 예상 4분');expect(calls).toHaveLength(1);
  // Failure: label and popup say unavailable; marker stays on the map.
  await row('convenience-2').click();await expect(row('convenience-2')).toContainText('도보 정보 확인 불가');await expect(page.getByRole('dialog',{name:'시설 상세 정보'})).toContainText('도보 정보 확인 불가');await expect(marker('convenience-2')).toBeVisible();expect(calls).toHaveLength(2);
  // Map → list for bus stop and subway station; the transit list opens and highlights the row.
  await page.locator('.transit-map-marker[data-kind=bus]').click();const bus=page.locator('.transit-station-list [data-station-id="seoul-bus-1"]');
  await expect(bus).toHaveAttribute('aria-pressed','true');await expect(bus).toBeVisible();await expect(page.locator('.transit-map-marker[data-kind=bus]')).toHaveClass(/is-selected/);await expect(marker('convenience-2')).not.toHaveClass(/is-selected/);await expect(row('convenience-2')).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('dialog',{name:'정류장 상세 정보'})).toContainText('도보 410m · 예상 6분');await expect(bus).toContainText('도보 약 6분 · 410m');expect(calls).toHaveLength(3);
  await page.locator('.transit-station-list [data-station-id="kakao-subway-1"]').click();await expect(page.locator('.transit-map-marker[data-kind=subway]')).toHaveClass(/is-selected/);await expect(page.locator('.transit-map-marker[data-kind=bus]')).not.toHaveClass(/is-selected/);await expect(page.getByRole('dialog',{name:'정류장 상세 정보'})).toContainText('역 대표 위치 기준');expect(calls).toHaveLength(4);
  await page.locator('.transit-map-marker[data-kind=bus]').click();await expect(page.getByRole('dialog',{name:'정류장 상세 정보'})).toContainText('도보 410m');expect(calls).toHaveLength(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('selection-'+width+'.png'),fullPage:true});
  // Filter OFF releases a hidden selection (bus filter, then a facility category).
  if(width===390)await page.getByRole('button',{name:'시설 필터',exact:true}).click();
  await page.locator('.station-layer-filters').getByRole('checkbox',{name:'버스정류장 표시'}).uncheck();await expect(page.getByRole('dialog')).toHaveCount(0);await page.locator('.station-layer-filters').getByRole('checkbox',{name:'버스정류장 표시'}).check();await expect(page.locator('.transit-map-marker[data-kind=bus]')).not.toHaveClass(/is-selected/);
  if(width===390)await page.getByRole('button',{name:'필터 닫기',exact:true}).click();
  await row('medical-1').click();await expect(marker('medical-1')).toHaveClass(/is-selected/);
  if(width===390)await page.getByRole('button',{name:'시설 필터',exact:true}).click();
  await page.getByRole('checkbox',{name:'병원·약국',exact:true}).uncheck();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('checkbox',{name:'병원·약국',exact:true}).check();await expect(marker('medical-1')).toBeVisible();await expect(marker('medical-1')).not.toHaveClass(/is-selected/);await expect(row('medical-1')).toHaveAttribute('aria-pressed','false');
  if(width===390)await page.getByRole('button',{name:'필터 닫기',exact:true}).click();
  // Selecting a facility while a stop is selected, then changing the house, resets everything.
  await row('convenience-1').click();await expect(marker('convenience-1')).toHaveClass(/is-selected/);
  await page.getByLabel('관심 있는 집 주소, 건물명 또는 지역').fill('선택 검증 집 B');await page.getByRole('button',{name:'주소 검색',exact:true}).click();await page.locator('.address-option').first().click();
  await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',b.id);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.facility-map-marker.is-selected,.transit-map-marker.is-selected')).toHaveCount(0);
  await expect(row('convenience-1')).toHaveAttribute('aria-pressed','false');await expect(row('convenience-1')).toContainText('선택 시 도보 확인');expect(calls).toHaveLength(4);
});

test('LIVE selection: real Kakao places, real TMAP walking values in list/popup, cache reuse after reload',async({page,browser},info)=>{
  test.skip(process.env.RUN_SELECTION_LIVE!=='1','Explicit opt-in: at most four real TMAP pedestrian requests');test.setTimeout(240000);
  await page.setViewportSize({width:1440,height:950});await page.goto('/explore');
  await page.getByLabel('관심 있는 집 주소, 건물명 또는 지역').fill('서울 관악구 관악로 1');await page.getByRole('button',{name:'주소 검색',exact:true}).click();await page.locator('.address-search .address-option').first().click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});await expect(page.locator('.facility-result[data-place-id]').first()).toBeAttached({timeout:45000});await expect(page.locator('.transit-station-list .facility-result').first()).toBeAttached({timeout:45000});
  const walks:{destination:unknown;body:{distanceMeters:number;seconds:number;status:string}}[]=[];page.on('response',async r=>{if(r.url().endsWith('/api/tmap/walk')&&r.ok())walks.push({destination:r.request().postDataJSON().destination,body:await r.json()});});
  await page.waitForTimeout(1500);expect(walks).toHaveLength(0);
  const facility=page.locator('.facility-result[data-place-id]'),stations=page.locator('.transit-station-list .facility-result');
  if(await page.locator('.facility-list-disclosure').getAttribute('open')===null)await page.locator('.facility-list-disclosure>summary').click();
  if(await page.locator('.transit-disclosure').getAttribute('open')===null)await page.locator('.transit-disclosure>summary').click();
  const targets=[facility.nth(0),facility.nth(1),stations.and(page.locator('[data-kind=bus]')).first(),stations.and(page.locator('[data-kind=subway]')).first()];
  const observations:unknown[]=[];
  for(const row of targets){
    if(!await row.count())continue;const name=(await row.locator('strong').textContent())!;const id=await row.getAttribute('data-place-id')??await row.getAttribute('data-station-id');
    await row.click();const marker=id&&await row.getAttribute('data-place-id')?page.locator(`.facility-map-marker[data-place-ids~="${id}"]`):page.locator(`.transit-map-marker[data-station-id="${id}"]`);
    await expect(marker).toHaveClass(/is-selected/);await expect(row).toHaveAttribute('aria-pressed','true');
    const label=row.locator('.walking-label');await expect(label).not.toHaveAttribute('data-walking','loading',{timeout:60000});await expect(label).not.toHaveAttribute('data-walking','idle');
    const text=(await label.textContent())!,popup=(await page.getByRole('dialog').textContent())!;observations.push({name,id,list:text,popup});
    const match=text.match(/도보 약 (\d+)분 · (\d+)m/);if(match){const hit=walks.find(w=>Math.round(w.body.distanceMeters)===Number(match[2]));if(hit){expect(Number(match[1])).toBe(Math.max(1,Math.ceil(hit.body.seconds/60)));expect(popup).toContain(`도보 ${match[2]}m · 예상 ${Math.ceil(hit.body.seconds/60)}분`);}}
    else expect(text).toBe('도보 정보 확인 불가');
  }
  expect(walks.length).toBeLessThanOrEqual(4);
  // New tab (empty sessionStorage): values come back from the server cache without a new TMAP request.
  const context=await browser.newContext({viewport:{width:390,height:900}}),second=await context.newPage();const state=await page.evaluate(()=>localStorage.getItem('neighborhood-preview-v2'));
  await second.addInitScript(v=>localStorage.setItem('neighborhood-preview-v2',v!),state);let secondWalks=0;second.on('request',r=>{if(r.url().endsWith('/api/tmap/walk'))secondWalks++;});
  await second.goto('/explore');await second.locator('.facility-list-disclosure>summary').click();await expect(second.locator('.walking-label[data-walking=ok]').first()).toBeVisible({timeout:30000});
  const reused=await second.locator('.walking-label[data-walking=ok]').allTextContents();expect(secondWalks).toBe(0);await second.screenshot({path:info.outputPath('live-cache-390.png'),fullPage:true});await context.close();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('live-selection-1440.png'),fullPage:true});
  await info.attach('live-selection.json',{body:JSON.stringify({walks:walks.map(w=>({destination:w.destination,distanceMeters:w.body.distanceMeters,seconds:w.body.seconds,status:w.body.status})),observations,reusedAfterReload:reused},null,2),contentType:'application/json'});
  console.log(JSON.stringify({walks:walks.map(w=>({distanceMeters:w.body.distanceMeters,seconds:w.body.seconds,status:w.body.status})),observations,reusedAfterReload:reused},null,1));
});
