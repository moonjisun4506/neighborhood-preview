import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {facilityCategories,nearestFacilities,type FacilityResponse,type FacilityPlace} from '../src/lib/facilities';
import type {Coordinates,AddressRecord} from '../src/lib/demo-data';
// Independent spherical distance calculation for comparing the returned API coordinates.
function distance(a:Coordinates,b:Coordinates){const rad=Math.PI/180;const x=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;return 12742017.6*Math.asin(Math.min(1,Math.sqrt(x)));}
test('nearest facilities use house coordinates, ignore incoming distances and handle duplicates or empty results',()=>{
  const origin={lat:37.55,lng:126.91};const places:FacilityPlace[]=[3,1,4,2].map(i=>({id:String(i),name:'검증 시설 '+i,address:'검증 주소',jibunAddress:'',category:'cafe',categoryName:'일반 카페',distanceMeters:999-i,coordinates:{lat:origin.lat+i*.0001,lng:origin.lng}}));
  const original=JSON.stringify(places);expect(nearestFacilities(origin,[...places,places[1]],'cafe',500).map(p=>p.id)).toEqual(['1','2']);expect(JSON.stringify(places)).toBe(original);expect(nearestFacilities(origin,places.slice(0,1),'cafe',500)).toHaveLength(1);expect(nearestFacilities(origin,places,'park',500)).toEqual([]);expect(nearestFacilities(origin,places,'cafe',1)).toEqual([]);
  const moved={lat:origin.lat+.0005,lng:origin.lng};expect(nearestFacilities(moved,places,'cafe',500).map(p=>p.id)).toEqual(['4','3']);
});
test('LIVE three selected houses show the same nearest two per category in the list and map',async({page},info)=>{
  test.setTimeout(180000);const report:unknown[]=[];
  for(const [index,q] of ['서울 중구 세종대로 110','서울 마포구 와우산로 94','서울 송파구 올림픽로 300'].entries()){
    await page.setViewportSize(index===2?{width:390,height:844}:{width:1440,height:1000});if(index===0)await page.goto('/explore');
    const responses=new Map<string,FacilityResponse>();const listener=async(response:import('@playwright/test').Response)=>{if(!response.url().includes('/api/facilities?')||!response.ok())return;try{const result:FacilityResponse=await response.json();responses.set(result.category,result);}catch{}};page.on('response',listener);
    await page.getByLabel('관심 있는 집 주소, 건물명 또는 지역').fill(q);const search=page.waitForResponse(r=>r.url().includes('/api/locations/search?'));await page.getByRole('button',{name:'주소 검색',exact:true}).click();const address:AddressRecord=(await (await search).json()).results[0];await page.locator('.address-search .address-option').first().click();await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',address.id);await expect.poll(()=>responses.size,{timeout:45000}).toBe(10);await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});
    if(index===2){await page.getByRole('button',{name:'− 축소',exact:true}).click();await page.getByRole('button',{name:'− 축소',exact:true}).click();}
    const details=page.locator('.facility-list-disclosure');if(await details.getAttribute('open')===null)await details.locator('summary').click();
    const categories=[];
    for(const [category,label] of facilityCategories){const response=responses.get(category)!;expect(response.source).toBe('kakao');expect(response.origin).toEqual(address.coordinates);const expected=response.places.map(p=>({...p,distanceMeters:distance(address.coordinates!,p.coordinates)})).filter(p=>p.distanceMeters<=500).sort((a,b)=>a.distanceMeters-b.distanceMeters||a.id.localeCompare(b.id)).slice(0,2);const ids=expected.map(p=>p.id).sort();const rows=page.locator(`.nearest-facility-group[data-category="${category}"] .facility-result`);await expect(rows).toHaveCount(expected.length);expect((await rows.evaluateAll(nodes=>nodes.map(n=>(n as HTMLElement).dataset.placeId!))).sort()).toEqual(ids);
      const markers=page.locator(`.facility-map-marker[data-category="${category}"]`);const markerIds=()=>markers.evaluateAll(nodes=>nodes.flatMap(n=>((n as HTMLElement).dataset.placeIds??'').split(' ').filter(Boolean)).sort());await expect.poll(markerIds).toEqual(ids);const rowIds=await rows.evaluateAll(nodes=>nodes.map(n=>(n as HTMLElement).dataset.placeId));expect(rowIds).toEqual(expected.map(p=>p.id));for(const place of expected){const row=page.locator(`.facility-result[data-category="${category}"][data-place-id="${place.id}"]`);await expect(row).toHaveAttribute('data-distance',String(Math.round(place.distanceMeters)));await expect(row).not.toContainText('직선');}
      if(!expected.length)await expect(page.locator(`.nearest-facility-group[data-category="${category}"]`)).toContainText('검색 결과 없음');categories.push({category,label,returned:response.places.length,displayed:expected.map(p=>({id:p.id,name:p.name,distanceMeters:p.distanceMeters})),mapMatches:true});
    }
    if(index===2)await page.getByRole('button',{name:'시설 필터',exact:true}).click();await page.getByRole('checkbox',{name:'편의점',exact:true}).uncheck();await expect(page.locator('.facility-map-marker[data-category=convenience]')).toHaveCount(0);await expect(page.locator('.nearest-facility-group[data-category=convenience]')).toHaveCount(0);await page.getByRole('checkbox',{name:'편의점',exact:true}).check();await expect.poll(()=>page.locator('.facility-map-marker[data-category=convenience]').evaluateAll(nodes=>nodes.flatMap(n=>((n as HTMLElement).dataset.placeIds??'').split(' ')).length)).toBe(Math.min(2,responses.get('convenience')!.places.length));
    if(index===2)await page.getByRole('button',{name:'필터 닫기'}).click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('nearest-house-'+(index+1)+'.png'),fullPage:true});report.push({query:q,address:address.address,origin:address.coordinates,radius:500,categories});page.off('response',listener);
  }
  const output=info.outputPath('nearest-three-houses.json');await writeFile(output,JSON.stringify(report,null,2));await info.attach('nearest-three-houses.json',{path:output,contentType:'application/json'});
});

// Existing facility tests isolate pedestrian calls; actual TMAP is tested only with RUN_TMAP_LIVE=1.
test.beforeEach(async({page})=>{await page.route('**/api/tmap/walk',r=>r.fulfill({status:503,json:{code:'TEST_ISOLATED',error:'도보 API 실검증은 별도 TMAP 검사에서 실행합니다.'}}));});
