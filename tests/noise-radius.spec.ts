import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {noisePointsWithinRadius,fixedNoiseResult,noiseRadiusMeters,noiseEmptyMessage,type NoisePoint,type NoiseResult} from '../src/lib/noise';
import {straightLineDistance} from '../src/lib/facilities';
import {addressEvidence} from '../src/lib/address-evidence.server';
import {rentMonths} from '../src/lib/rent';
const origin={lat:37.55,lng:126.91};
function point(id:string,meters:number):NoisePoint{return {id,name:id,kind:'environment',coordinates:{lat:origin.lat+meters/6371008.8*180/Math.PI,lng:origin.lng},distanceMeters:0,address:'모의 측정지점',metrics:[{label:'주간 평균',db:63},{label:'야간 평균',db:51}],measuredPeriod:'2026년 2분기',source:'경계 모의자료',sourceUrl:'https://www.noiseinfo.or.kr/noise/data.do'};}

test('1km boundary uses actual coordinates before rounding, including history and AI evidence',()=>{
 const inside=point('inside',999.99),outside=point('outside',1000.01),near=point('near',20);expect(noiseRadiusMeters).toBe(1000);expect(straightLineDistance(origin,inside.coordinates)).toBeLessThan(1000);expect(straightLineDistance(origin,outside.coordinates)).toBeGreaterThan(1000);
 expect(noisePointsWithinRadius(origin,[outside,inside,near,{...near,id:'invalid',coordinates:{lat:NaN,lng:127}}]).map(p=>p.id)).toEqual(['near','inside']);
 const result=fixedNoiseResult(origin,{origin,radius:300,points:[outside,inside,near],historicalPoints:[outside,inside],references:[],warnings:[],period:'검증',limited:false,fetchedAt:new Date().toISOString()});expect(result.radius).toBe(1000);expect(result.historicalPoints!.map(p=>p.id)).toEqual(['inside']);
 const house={id:'boundary-home',label:'집',address:'경계 검증 집',source:'kakao' as const,coordinates:origin},input={addresses:[house],destination:null,radius:300,days:20,roundTrip:true,type:'sh',month:rentMonths()[0],min:0,max:null,transit:[]};
 expect(addressEvidence(input,house,[],undefined,null,null,outside).some(f=>f.text.includes('outside'))).toBe(false);expect(addressEvidence(input,house,[],undefined,null,null,inside).some(f=>f.text.includes('inside')&&f.text.includes('반경 1km'))).toBe(true);
});

for(const width of [1440,390])test(`MOCK fixed noise radius remains independent from facilities at ${width}px`,async({page},info)=>{
 const house={id:'fixed-house',label:'검증 집',address:'검증 집 주소',source:'kakao',coordinates:origin},points=[point('near',20),point('edge-inside',999.99),point('edge-outside',1000.01)];let calls=0;
 await page.setViewportSize({width,height:1000});await page.addInitScript(house=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[house],selectedId:house.id,saved:[],compare:[],notes:{},layers:[],radius:300,facilityLayerVersion:1})),house);
 await page.route('**/api/noise?**',r=>{calls++;expect(new URL(r.request().url()).searchParams.get('radius')).toBe('1000');return r.fulfill({json:{origin,radius:1000,points,historicalPoints:[{...points[2],id:'past-outside'}],references:[],warnings:[],period:'모의 기간',limited:false,fetchedAt:new Date().toISOString()}});});
 await page.route('**/api/transit/nearby?**',r=>r.fulfill({json:{provider:'public',origin,radius:300,stations:[],fetchedAt:new Date().toISOString()}}));
 await page.goto('/transport');await page.locator('.noise-disclosure>summary').click();const panel=page.getByRole('region',{name:'공식 소음 측정자료'});await expect(panel).toContainText('반경 1km');await expect(panel.locator('.noise-measurement')).toHaveCount(2);await expect(panel.locator('.noise-measurement').first()).toHaveAttribute('data-noise-id','near');await expect(panel.locator('.noise-measurement').first()).toHaveAttribute('open','');await expect(panel.locator('[data-noise-id=edge-inside]')).not.toHaveAttribute('open');await expect(panel).not.toContainText('outside');await expect(panel.getByRole('button',{name:/300m|500m|1km/})).toHaveCount(0);
 await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});for(let i=0;i<2;i++)await page.getByRole('button',{name:'− 축소',exact:true}).click();await expect(page.locator('.noise-map-marker')).toHaveCount(2);await expect(page.locator('.noise-map-marker[data-noise-id=edge-outside]')).toHaveCount(0);
 await page.getByRole('tab',{name:'주변 시설',exact:true}).click();await expect(page).toHaveURL('/explore');if(width===390)await page.getByRole('button',{name:'시설 필터',exact:true}).click();await page.getByRole('button',{name:'500m',exact:true}).click();if(width===390)await page.getByRole('button',{name:'필터 닫기',exact:true}).click();await page.getByRole('tab',{name:'교통·소음·치안',exact:true}).click();await expect(page).toHaveURL('/transport');await page.locator('.noise-disclosure>summary').click();await expect.poll(()=>calls).toBe(2);await expect(panel.locator('.noise-measurement')).toHaveCount(2);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('fixed-noise-'+width+'.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('API rejects changing the fixed 1km range without requesting upstream noise data',async({request})=>{
 for(const radius of [300,500,1001,2000])expect((await request.get('/api/noise',{params:{...origin,radius}})).status()).toBe(400);
});

test('LIVE three Seoul addresses: fixed cards, map and AI share the same 1km data',async({page,request},info)=>{
 test.setTimeout(180000);const reports=[];
 for(const [index,q] of ['서울 종로구 우정국로 55','서울 영등포구 경인로82길 3-4','서울 마포구 하늘공원로 95'].entries()){
 const search=await request.get('/api/locations/search',{params:{q}});expect(search.ok()).toBe(true);const address=(await search.json()).results[0],origin=address.coordinates;const response=await request.get('/api/noise',{params:{...origin,radius:1000}});expect(response.ok()).toBe(true);const result:NoiseResult=await response.json();expect(result.radius).toBe(1000);
 for(const point of [...result.points,...result.historicalPoints??[],...result.references??[]]){const distance=straightLineDistance(origin,point.coordinates);expect(distance).toBeLessThanOrEqual(1000);expect(point.distanceMeters).toBeCloseTo(distance,5);}expect(result.points.map(p=>p.distanceMeters)).toEqual([...result.points.map(p=>p.distanceMeters)].sort((a,b)=>a-b));
 await page.addInitScript(address=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[address],selectedId:address.id,saved:[],compare:[],notes:{},layers:[],facilityLayerVersion:1,radius:300})),address);await page.setViewportSize({width:index===1?390:1440,height:1000});await page.goto('/transport');await page.locator('.noise-disclosure>summary').click();const panel=page.getByRole('region',{name:'공식 소음 측정자료'});await expect(panel).toContainText('반경 1km');
 await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});for(let i=0;i<2;i++)await page.getByRole('button',{name:'− 축소',exact:true}).click();await expect(page.locator('.noise-map-marker')).toHaveCount(result.points.length);
 if(index===2){expect(result.points).toHaveLength(0);await expect(panel).toContainText(noiseEmptyMessage);}else{expect(result.points.length).toBeGreaterThan(0);await expect(panel.locator('.noise-measurement').first()).toHaveAttribute('data-noise-id',result.points[0].id);for(const point of result.points){const card=panel.locator('.noise-measurement[data-noise-id="'+point.id+'"]');await expect(card).toContainText(point.measuredPeriod);for(const metric of point.metrics)await expect(card).toContainText(String(metric.db));}}
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('live-fixed-noise-'+index+'.png'),fullPage:true});
 await page.request.get('/api/saved');const ai=await page.request.post('/api/ai/summary',{headers:{Origin:'http://localhost:3000'},timeout:120000,data:{addresses:[address],radius:300,destination:null,days:20,roundTrip:true,month:rentMonths()[0],type:'sh',min:0,max:null,transit:[]}});const body=await ai.json();expect(ai.ok(),body.error??'AI query').toBe(true);const facts=body.summary.sections.flatMap((s:{items:{text:string;source:string}[]})=>s.items).filter((fact:{source:string})=>fact.source.includes('공식 소음 측정자료'));
 if(!result.points.length)expect(facts).toHaveLength(0);else{expect(facts.length).toBeGreaterThan(0);for(const fact of facts){expect(fact.text).toContain('반경 1km');expect(result.points.some(p=>fact.text.includes(p.name)&&fact.text.includes(p.measuredPeriod)&&p.metrics.every(m=>fact.text.includes(m.db+' dB(A)')))).toBe(true);}}
 reports.push({address:address.address,result});
 }
 await writeFile(info.outputPath('fixed-noise-three-seoul.json'),JSON.stringify(reports,null,2));
});
