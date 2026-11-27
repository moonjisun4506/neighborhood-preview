import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

for(const width of [1440,390])test(`MOCK walking details: pending reuse, failures and stale selection at ${width}px`,async({page},info)=>{
  const a={id:'walk-a',label:'집 A',address:'집 A',source:'kakao',coordinates:{lat:37.55,lng:126.91}},b={...a,id:'walk-b',label:'집 B',address:'집 B',coordinates:{lat:37.56,lng:126.92}};
  let calls=0,release:()=>void=()=>{};const pending=new Promise<void>(r=>release=r);
  await page.setViewportSize({width,height:900});
  await page.addInitScript(a=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[a],selectedId:a.id,saved:[],compare:[],notes:{},layers:['convenience'],facilityLayerVersion:1,radius:500})),a);
  await page.route('**/api/transit/nearby?**',r=>r.fulfill({json:{stations:[],provider:'public',origin:a.coordinates,radius:500,fetchedAt:new Date().toISOString()}}));
  await page.route('**/api/locations/search?**',r=>r.fulfill({json:{results:[b]}}));
  await page.route('**/api/facilities?**',r=>{const p=new URL(r.request().url()).searchParams,origin={lat:Number(p.get('lat')),lng:Number(p.get('lng'))};return r.fulfill({json:{source:'kakao',origin,radius:500,category:'convenience',places:[0,1].map(i=>({id:'walk-'+i,name:'시설 '+i,category:'convenience',coordinates:{lat:origin.lat+.001*(i+1),lng:origin.lng},distanceMeters:111*(i+1)}))}});});
  await page.route('**/api/tmap/walk',async r=>{calls++;const target=r.request().postDataJSON().destination;if(Math.abs(target.lat-37.551)<1e-8){await pending;await r.fulfill({json:{provider:'tmap',status:'ok',distanceMeters:321,seconds:125,fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}});}else await r.fulfill({status:429,json:{code:'QUOTA',error:'quota'}});});
  await page.goto('/explore');await page.locator('.facility-list-disclosure>summary').click();expect(calls).toBe(0);
  const first=page.locator('.facility-result[data-place-id="walk-0"]');await first.click();await expect.poll(()=>calls).toBe(1);await first.click();expect(calls).toBe(1);
  await page.locator('.facility-result[data-place-id="walk-1"]').click();await expect(page.getByRole('dialog')).toContainText('도보 정보 확인 불가');release();await expect(page.getByRole('dialog')).not.toContainText('321m');await expect(page.getByRole('dialog')).not.toContainText('직선거리');
  await first.click();await expect(page.getByRole('dialog')).toContainText('도보 321m · 예상 3분');expect(calls).toBe(2);
  await page.getByLabel('관심 있는 집 주소, 건물명 또는 지역').fill('집 B');await page.getByRole('button',{name:'주소 검색',exact:true}).click();await page.locator('.address-option').first().click();await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',b.id);await expect(page.getByRole('dialog')).toHaveCount(0);expect(calls).toBe(2);
  await page.locator('.facility-result[data-place-id="walk-0"]').click();await expect(page.getByRole('dialog')).toContainText('도보 정보 확인 불가');await expect(page.getByRole('dialog')).not.toContainText('321m');expect(calls).toBe(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('walking-'+width+'.png'),fullPage:true});
});

test('LIVE eight walking destinations: two stores, pharmacies, bus stops and stations',async({page,request},info)=>{
  test.skip(process.env.RUN_WALKING_LIVE!=='1','Explicit opt-in for eight real walking requests');test.setTimeout(240000);
  const lookup=await request.get('/api/locations/search',{params:{q:'서울 중구 세종대로 110'}});expect(lookup.ok()).toBe(true);const house=(await lookup.json()).results[0],origin=house.coordinates;
  const fetchPlaces=async(category:string)=>{const r=await request.get('/api/facilities',{params:{...origin,radius:1000,category}});expect(r.ok()).toBe(true);return (await r.json()).places;};
  const stores=(await fetchPlaces('convenience')).slice(0,2),pharmacies=(await fetchPlaces('medical')).filter((p:{categoryName?:string})=>p.categoryName?.includes('약국')).slice(0,2);
  const nearby=await request.get('/api/transit/nearby',{params:{...origin,radius:1000}});expect(nearby.ok()).toBe(true);const stations=(await nearby.json()).stations,buses=stations.filter((s:{kind:string})=>s.kind==='bus').slice(0,2),subways=stations.filter((s:{kind:string})=>s.kind==='subway').slice(0,2);
  for(const group of [stores,pharmacies,buses,subways])expect(group).toHaveLength(2);
  // The UI fixtures contain only the real records just returned above; walking calls are not mocked.
  await page.addInitScript(house=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[house],selectedId:house.id,saved:[],compare:[],notes:{},layers:['convenience','medical'],facilityLayerVersion:1,radius:1000})),house);
  await page.route('**/api/facilities?**',r=>{const category=new URL(r.request().url()).searchParams.get('category');return r.fulfill({json:{source:'kakao',origin,radius:1000,category,places:category==='medical'?pharmacies:stores}});});
  await page.route('**/api/transit/nearby?**',r=>r.fulfill({json:{provider:'public',origin,radius:1000,stations:[...buses,...subways],fetchedAt:new Date().toISOString()}}));
  // Server-cache lookup is disabled here so every click is observed as its own pedestrian request.
  await page.route('**/api/walking/cached',r=>r.fulfill({json:{results:[]}}));
  let calls=0;page.on('request',r=>{if(r.url().includes('/api/tmap/walk'))calls++;});
  await page.goto('/explore');await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});expect(calls).toBe(0);
  await page.locator('.facility-list-disclosure>summary').click();await page.locator('.transit-disclosure>summary').click();
  const observations=[];
  for(const [i,place] of [...stores,...pharmacies,...buses,...subways].entries()){
    await page.setViewportSize({width:i%2?390:1440,height:950});
    const button=i<4?page.locator('.facility-result[data-place-id="'+place.id+'"]'):page.locator('.transit-station-list [data-station-id="'+place.id+'"]');
    const responsePromise=page.waitForResponse(r=>r.url().includes('/api/tmap/walk'));await button.click();const response=await responsePromise,body=await response.json();expect(response.ok(),body.code??'walking API').toBe(true);expect(body.status).toBe('ok');expect(response.request().postDataJSON()).toEqual({origin,destination:place.coordinates});
    const popup=page.getByRole('dialog');await expect(popup).toContainText(place.name);await expect(popup).toContainText('도보 '+Math.round(body.distanceMeters)+'m · 예상 '+Math.ceil(body.seconds/60)+'분');await expect(popup).not.toContainText('직선거리');
    if(i>=6)await expect(popup).toContainText('역 대표 위치 기준');
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('real-walking-'+i+'.png'),fullPage:true});await popup.getByRole('button',{name:/상세 닫기/}).click();await button.click();await expect(popup).toContainText(Math.round(body.distanceMeters)+'m');expect(calls).toBe(i+1);await popup.getByRole('button',{name:/상세 닫기/}).click();
    observations.push({name:place.name,coordinates:place.coordinates,distanceMeters:body.distanceMeters,seconds:body.seconds});
  }
  const report=info.outputPath('actual-walking-results.json');await writeFile(report,JSON.stringify({origin,observations},null,2));await info.attach('actual-walking-results.json',{path:report,contentType:'application/json'});
});
