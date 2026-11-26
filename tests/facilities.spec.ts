import {test,expect,type Page} from '@playwright/test';
import {facilityCategories,straightLineDistance,type FacilityResponse} from '../src/lib/facilities';
import type {AddressRecord} from '../src/lib/demo-data';
import {writeFile} from 'node:fs/promises';
test.use({actionTimeout:10000});

async function seed(page:Page,address:AddressRecord,layers:string[]){await page.addInitScript(({address,layers})=>{
  if(!localStorage.getItem('neighborhood-preview-v2'))localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[address],selectedId:address.id,saved:[],compare:[],notes:{},layers,radius:500,facilityLayerVersion:1}));
},{address,layers});}

test('real API returns only in-radius Kakao facilities for all ten types and three radii',async({request},testInfo)=>{
  test.setTimeout(120000);
  const lookup=await request.get('/api/locations/search',{params:{q:'서울 마포구 와우산로 94'}});expect(lookup.ok()).toBe(true);
  const address:AddressRecord=(await lookup.json()).results[0];const origin=address.coordinates!;const report:unknown[]=[];
  for(const radius of [300,500,1000]){
    const queue=[...facilityCategories];
    await Promise.all(Array.from({length:3},async()=>{while(queue.length){const [category,label]=queue.shift()!;
      const response=await request.get('/api/facilities',{params:{...origin,radius,category}});expect(response.status(),`${label} ${radius}m`).toBe(200);
      const body:FacilityResponse=await response.json();expect(body.source).toBe('kakao');expect(body.origin).toEqual(origin);expect(body.radius).toBe(radius);
      expect(new Set(body.places.map(p=>p.id)).size).toBe(body.places.length);
      for(const place of body.places){expect(place.id).toBeTruthy();expect(place.name).toBeTruthy();expect(place.address).toBeTruthy();expect(place.category).toBe(category);expect(place.distanceMeters).toBeLessThanOrEqual(radius);expect(place.distanceMeters).toBeCloseTo(straightLineDistance(origin,place.coordinates),5);}
      if(category==='cafe')for(const place of body.places)expect(place.name+' '+place.categoryName).not.toMatch(/스터디|독서실|프린트|인쇄|출력/);
      report.push({radius,category,label,count:body.places.length,limited:body.limited,partial:Boolean(body.warning),example:body.places[0]});
    }}));
  }
  expect(report).toHaveLength(30);const reportPath=testInfo.outputPath('real-facility-results.json');await writeFile(reportPath,JSON.stringify({address,results:report},null,2));await testInfo.attach('real-facility-results.json',{path:reportPath,contentType:'application/json'});
});

test('real facility markers, individual filters, popup, radius and fixed address origin',async({page,request})=>{
  test.setTimeout(90000);
  const search=await request.get('/api/locations/search',{params:{q:'서울 마포구 와우산로 94'}});const address:AddressRecord=(await search.json()).results[0];const origin=address.coordinates!;
  await seed(page,address,['cafe']);const calls:string[]=[];page.on('request',r=>{if(r.url().includes('/api/facilities?'))calls.push(r.url());});
  await page.setViewportSize({width:1440,height:1000});const responsePromise=page.waitForResponse(r=>r.url().includes('/api/facilities?'),{timeout:30000});
  await page.goto('/explore',{waitUntil:'domcontentloaded'});const response:FacilityResponse=await (await responsePromise).json();expect(response.places.length).toBeGreaterThan(0);
  const canvas=page.getByTestId('map-canvas');await expect(canvas).toHaveAttribute('data-map-ready','true',{timeout:30000});
  const markers=page.locator('.facility-map-marker');const represented=()=>markers.evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number((node as HTMLElement).dataset.count),0));await expect.poll(represented).toBe(Math.min(2,response.places.length));
  expect(await markers.evaluateAll(nodes=>nodes.every(node=>(node as HTMLElement).dataset.category==='cafe'))).toBe(true);
  const topMarker=markers.last();const placeId=await topMarker.getAttribute('data-place-id');const place=response.places.find(p=>p.id===placeId)!;
  await topMarker.click();await expect(page.getByRole('dialog',{name:'시설 상세 정보'})).toContainText(place.name);await expect(page.getByRole('dialog',{name:'시설 상세 정보'})).not.toContainText('도보 시간 확인 불가');await expect(page.getByRole('dialog',{name:'시설 상세 정보'})).toContainText(`직선거리 약 ${Math.round(place.distanceMeters)}m`);
  await page.getByRole('button',{name:'시설 상세 닫기'}).click();
  const beforeCalls=calls.length;const beforeCenter=await page.getByTestId('map-center').innerText();const bounds=(await canvas.boundingBox())!;
  await page.mouse.move(bounds.x+80,bounds.y+180);await page.mouse.down();await page.mouse.move(bounds.x+180,bounds.y+240,{steps:8});await page.mouse.up();
  await expect.poll(()=>page.getByTestId('map-center').innerText()).not.toBe(beforeCenter);expect(calls.length).toBe(beforeCalls);await expect(page.getByTestId('facility-origin')).toHaveAttribute('data-origin-lng',String(origin.lng));
  await page.getByRole('checkbox',{name:'일반 카페',exact:true}).uncheck();await expect(markers).toHaveCount(0);await expect(canvas).toHaveAttribute('data-marker-lat',/.+/);
  await page.getByRole('checkbox',{name:'일반 카페',exact:true}).check();await expect.poll(represented).toBe(Math.min(2,response.places.length));expect(calls.length).toBe(beforeCalls);
  const nearResponse=page.waitForResponse(r=>r.url().includes('/api/facilities?')&&new URL(r.url()).searchParams.get('radius')==='300');await page.getByRole('button',{name:'300m',exact:true}).click();
  const nearby:FacilityResponse=await (await nearResponse).json();await expect.poll(represented).toBe(Math.min(2,nearby.places.length));expect(await markers.evaluateAll(nodes=>nodes.every(n=>Number((n as HTMLElement).dataset.distance)<=300))).toBe(true);
  expect(calls.every(url=>new URL(url).searchParams.get('lat')===String(origin.lat)&&new URL(url).searchParams.get('lng')===String(origin.lng))).toBe(true);
  await page.getByRole('checkbox',{name:'편의점',exact:true}).check();await expect.poll(()=>page.locator('.facility-map-marker[data-category="convenience"]').count()).toBeGreaterThan(0);
  await page.screenshot({path:'test-results/facilities-live-desktop.png',fullPage:true});
  const camera=async()=>((await page.getByTestId('map-center').innerText()).match(/\d+\.\d+/g)??[]).map(Number);const beforeResize=await camera();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(async()=>Math.abs((await camera())[0]-beforeResize[0])).toBeLessThan(.0001);await expect.poll(async()=>Math.abs((await camera())[1]-beforeResize[1])).toBeLessThan(.0001);
  await page.getByRole('button',{name:'시설 필터',exact:true}).click();await expect(page.getByRole('checkbox',{name:'일반 카페',exact:true})).toBeChecked();await page.getByRole('checkbox',{name:'일반 카페',exact:true}).uncheck();await expect(page.locator('.facility-map-marker[data-category="cafe"]')).toHaveCount(0);
  await page.getByRole('button',{name:'필터 닫기'}).click();await page.getByRole('button',{name:'선택 주소로 복귀'}).click();await expect.poll(async()=>Math.abs((await camera())[0]-origin.lat)).toBeLessThan(.00005);await page.screenshot({path:'test-results/facilities-live-mobile.png',fullPage:true});
});

test('mocked empty, error, retry and stale facility responses are distinguishable',async({page})=>{
  const address:AddressRecord={id:'test',label:'테스트 주소',address:'테스트용 주소',coordinates:{lat:37.5525,lng:126.925},source:'kakao'};
  await seed(page,address,['cafe']);let fail=true;let delayed=false;
  await page.route('**/api/facilities?*',async route=>{
    const radius=Number(new URL(route.request().url()).searchParams.get('radius'));
    if(fail){await route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'시설 검색 요청 한도를 초과했습니다.'})});return;}
    if(radius===1000){delayed=true;await new Promise(resolve=>setTimeout(resolve,600));}
    await route.fulfill({contentType:'application/json',body:JSON.stringify({source:'kakao',origin:address.coordinates,radius,category:'cafe',places:radius===1000?[{id:'stale',name:'오래된 결과',address:'테스트',coordinates:address.coordinates,category:'cafe',distanceMeters:0}]:[],limited:false,fetchedAt:new Date().toISOString()})}).catch(()=>{});
  });
  await page.goto('/explore');await page.locator('.facility-list-disclosure>summary').click();await expect(page.locator('.facility-errors')).toContainText('요청 한도를 초과');await expect(page.locator('.facility-map-marker')).toHaveCount(0);
  fail=false;await page.getByRole('button',{name:'실패한 시설 다시 조회'}).click();await expect(page.getByText('이 반경에서 선택한 시설의 검색 결과가 없습니다.')).toBeVisible();
  await page.getByRole('button',{name:'1km',exact:true}).click();await expect.poll(()=>delayed).toBe(true);await page.getByRole('button',{name:'300m',exact:true}).click();await page.waitForTimeout(800);
  await expect(page.getByText('오래된 결과',{exact:true})).toHaveCount(0);await expect(page.locator('.facility-map-marker')).toHaveCount(0);await expect(page.getByRole('button',{name:'300m',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('facility endpoint validates origin, category and exact supported radii',async({request})=>{
  for(const params of [{lat:'',lng:'126.9',radius:'500',category:'cafe'},{lat:'91',lng:'126.9',radius:'500',category:'cafe'},{lat:'37.5',lng:'126.9',radius:'400',category:'cafe'},{lat:'37.5',lng:'126.9',radius:'500',category:'unknown'}])expect((await request.get('/api/facilities',{params})).status()).toBe(400);
});

test('all ten facility toggles independently hide and restore mocked marker results',async({page})=>{
  const address:AddressRecord={id:'filter-test',label:'필터 테스트 주소',address:'필터 테스트용 주소',coordinates:{lat:37.5525,lng:126.925},source:'kakao'};
  await seed(page,address,facilityCategories.map(c=>c[0]));
  await page.route('**/api/facilities?*',async route=>{
    const category=new URL(route.request().url()).searchParams.get('category');const index=facilityCategories.findIndex(c=>c[0]===category);
    await route.fulfill({contentType:'application/json',body:JSON.stringify({source:'kakao',origin:address.coordinates,radius:500,category,places:[{id:'test-'+category,name:'시설 '+category,address:'테스트 주소',jibunAddress:'테스트 주소',coordinates:{lat:37.5525+(index+1)*.0001,lng:126.925},category,distanceMeters:(index+1)*11}],limited:false,fetchedAt:new Date().toISOString()})});
  });
  await page.goto('/explore',{waitUntil:'domcontentloaded'});await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});await expect(page.locator('.facility-map-marker')).toHaveCount(10);
  for(const [id,label] of facilityCategories){await page.getByRole('checkbox',{name:label,exact:true}).uncheck();await expect(page.locator(`.facility-map-marker[data-category="${id}"]`)).toHaveCount(0);}
  await expect(page.locator('.facility-map-marker')).toHaveCount(0);
  for(const [id,label] of facilityCategories){await page.getByRole('checkbox',{name:label,exact:true}).check();await expect(page.locator(`.facility-map-marker[data-category="${id}"]`)).toHaveCount(1);}
  await expect(page.locator('.facility-map-marker')).toHaveCount(10);
});

// Existing facility tests isolate pedestrian calls; actual TMAP is tested only with RUN_TMAP_LIVE=1.
test.beforeEach(async({page})=>{await page.route('**/api/tmap/walk',r=>r.fulfill({status:503,json:{code:'TEST_ISOLATED',error:'도보 API 실검증은 별도 TMAP 검사에서 실행합니다.'}}));});
