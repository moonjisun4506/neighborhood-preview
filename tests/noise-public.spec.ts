import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import proj4 from 'proj4';
import csvData from '../src/data/noise-csv-2025.json';
import {csvPoints,eiaBounds,eiaFeatures,publicNoiseFailure,railPoints} from '../src/lib/noise-public.server';
import type {NoiseResult} from '../src/lib/noise';
import {rentMonths} from '../src/lib/rent';
const {csv:parseCsv}=require('../scripts/prepare-noise-csv.cjs') as {csv:(s:string)=>string[][]};

test('actual CSV checksum, fields and unique official coordinate joins are preserved',async()=>{
 const raw=await readFile('data/noise/environment-2025.csv');expect(createHash('sha256').update(raw).digest('hex')).toBe(csvData.sha256);const rows=parseCsv(new TextDecoder(csvData.encoding).decode(raw));expect(rows.length-1).toBe(5880);expect(csvData.matchedRows+csvData.unmatchedRows).toBe(csvData.rawRows);expect(rows[0]).toContain('주간평균');expect(rows[0]).toContain('야간평균');expect(rows[0]).not.toContain('위도');
 const station=csvData.records.find(r=>r.name==='조계사 후문 앞')!,original=rows.find(r=>r[2]===station.name&&r[4]===station.year&&r[5]===station.quarter)!;
 const point=csvPoints(station.coordinates,300).find(p=>p.name===station.name)!;expect(point.metrics).toEqual([{label:'주간 평균',db:Number(original[10])},{label:'야간 평균',db:Number(original[13])}]);expect(point.sourceUrl).toContain('15065396');expect(point.measuredPeriod).toContain('2025년 4분기');expect(parseCsv('a,b\r\n"c,d","e""f"\r\n')).toEqual([['a','b'],['c,d','e"f']]);
});

test('rail adapter rejects ambiguous positions, preserves 22h instead of inventing a night average',()=>{
 const origin={lat:37.5,lng:127},spot={spotCode:'r',spotName:'측정지점',lineName:'노선',divName:'주소',wgs84Lat:37.5,wgs84Lon:127};const row={msrmtBrnchNm:'측정지점',rprsRteNm:'노선',msrmtYr:'2025',frhfyrShyrSeNm:'하반기',grondDdtmAvgNvl:65,grond22pmMsrmtNvl:63,hnefDdtmAvgNvl:null,hnef22pmMsrmtNvl:-1};
 expect(railPoints([row],[spot],origin,300).points[0].metrics).toEqual([{label:'지면 위 주간 평균',db:65},{label:'지면 위 야간 22시',db:63}]);expect(railPoints([row],[spot,{...spot,spotCode:'duplicate'}],origin,300)).toEqual({points:[],unmatched:1});expect(railPoints([row],[{...spot,wgs84Lat:37.6}],origin,300).points).toHaveLength(0);
 expect(publicNoiseFailure(401,'')).toBe('auth_error');expect(publicNoiseFailure(200,'30')).toBe('auth_error');expect(publicNoiseFailure(429,'')).toBe('rate_limited');expect(publicNoiseFailure(200,'22')).toBe('rate_limited');expect(publicNoiseFailure(500,'99')).toBe('error');
});

test('EIA WFS uses its explicit CRS and house radius; unrelated geometry never supplies household noise',()=>{
 const origin={lat:37.56637,lng:126.977918},utm='+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs',position=proj4('EPSG:4326',utm,[origin.lng,origin.lat]);
 const feature={USE_YN:'Y',MGTNO:'official-project',IVSTG_GB:'IV01',IVSTG_SPOT:'조사지점',the_geom:{Point:{'@_srsName':'http://www.opengis.net/gml/srs/epsg.xml#32652',pos:position.join(' ')}}};const root={FeatureCollection:{'@_numberOfFeatures':'1',featureMembers:{NOISEVIBRATION_POINT:feature}}};const result=eiaFeatures(root,origin,500);expect(result.points).toHaveLength(1);expect(result.points[0].coordinates.lat).toBeCloseTo(origin.lat,8);expect(result.points[0].coordinates.lng).toBeCloseTo(origin.lng,8);expect(result.points[0]).not.toHaveProperty('metrics');expect(eiaFeatures(root,{lat:37.6,lng:127},500).points).toHaveLength(0);expect(eiaBounds(origin,500).split(',').map(Number).every(Number.isFinite)).toBe(true);
});

test('MOCK source authentication, quota and missing survey attributes remain separate from no data',async({page})=>{
 const house={id:'source-errors',label:'집',address:'검증 주소',source:'kakao',coordinates:{lat:37.5,lng:127}};await page.addInitScript(house=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[house],selectedId:house.id,saved:[],compare:[],notes:{},layers:[],radius:500,facilityLayerVersion:1})),house);
 await page.route('**/api/noise?**',r=>r.fulfill({json:{origin:house.coordinates,radius:500,points:[],warnings:[],period:'과거 자료',limited:false,fetchedAt:new Date().toISOString(),sources:[{id:'rail_api',name:'철도소음 API',status:'auth_error',message:'인증 실패 검증',sourceUrl:'https://www.data.go.kr/data/15164190/openapi.do'},{id:'assessment_api',name:'환경영향평가 조사 API',status:'rate_limited',message:'호출 제한 검증',sourceUrl:'https://www.data.go.kr/data/15142831/openapi.do'},{id:'environment_csv',name:'환경소음 측정망 CSV',status:'empty',message:'범위 내 자료 없음 검증',sourceUrl:'https://www.data.go.kr/data/15065396/fileData.do'}]}}));
 await page.goto('/transport');await page.locator('.noise-disclosure>summary').click();const panel=page.getByRole('region',{name:'공식 소음 측정자료'});await expect(panel).toContainText('선택한 주소 반경 1km 이내에 확인 가능한 공식 소음 측정자료가 없습니다.');await expect(panel).toContainText('인증·이용 권한 확인 필요');await expect(panel).toContainText('호출 제한');await panel.locator('.noise-source-details>summary').click();await expect(panel.locator('[data-source-id=rail_api]')).toHaveAttribute('data-source-status','auth_error');await expect(panel.locator('[data-source-id=environment_csv]')).toHaveAttribute('data-source-status','empty');await expect(panel.getByRole('checkbox')).toHaveCount(0);
});

test('LIVE three Seoul addresses: authorized APIs, CSV archive, real coordinates, AI and PC/mobile',async({page,request},info)=>{
 test.setTimeout(180000);loadEnvConfig(process.cwd(),false,{info(){},error(){}});let key=process.env.MOLIT_API_KEY?.trim();expect(Boolean(key)).toBe(true);if(/%[0-9a-f]{2}/i.test(key!))key=decodeURIComponent(key!);
 const safeJson=async(endpoint:string,params:Record<string,string>)=>{try{const response=await fetch(endpoint+'?'+new URLSearchParams(params),{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('upstream');return await response.json();}catch{throw Error('Official API validation failed; request credentials withheld.');}};
 const rail=await safeJson('https://apis.data.go.kr/B552584/rnmsManualDataService/getRnmsInfo',{serviceKey:key!,pageNo:'1',numOfRows:'1000',returnType:'json'});expect(rail.header.resultCode).toBe('200');expect(rail.body.items.length).toBe(rail.body.totalCount);
 const assessment=await safeJson('https://apis.data.go.kr/1480523/NoiseVibrationService/getInfo',{ServiceKey:key!,mgtNo:'JJ2005E006',type:'json'});expect(assessment.response.header.resultCode).toBe('00');
 const report=[];for(const [index,q]of ['서울 종로구 우정국로 55','서울 용산구 녹사평대로 136','서울 영등포구 경인로82길 3-4'].entries()){
 const lookup=await request.get('/api/locations/search',{params:{q}});expect(lookup.ok()).toBe(true);const address=(await lookup.json()).results[0];const response=await request.get('/api/noise',{params:{...address.coordinates,radius:1000}});expect(response.ok()).toBe(true);const result:NoiseResult=await response.json();expect(result.sources?.every(s=>!['config','auth_error','error','rate_limited'].includes(s.status))).toBe(true);expect(result.points.length).toBeGreaterThan(0);
 for(const points of [result.points,result.historicalPoints??[]])for(const point of points){expect(point.distanceMeters).toBeLessThanOrEqual(1000);expect(point.coordinates.lat).toBeGreaterThan(33);expect(point.coordinates.lng).toBeGreaterThan(124);}
 if(index===2){const historical=result.historicalPoints!.find(p=>p.id.startsWith('RAILAPI')&&p.measuredPeriod.includes('하반기'))!;const original=rail.body.items.find((r:{msrmtBrnchNm:string;frhfyrShyrSeNm:string})=>r.msrmtBrnchNm===historical.name&&r.frhfyrShyrSeNm==='하반기');expect(historical.metrics[0].db).toBe(original.grondDdtmAvgNvl);expect(historical.metrics[1]).toEqual({label:'지면 위 야간 22시',db:original.grond22pmMsrmtNvl});}
 await page.addInitScript(address=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[address],selectedId:address.id,saved:[],compare:[],notes:{},layers:[],facilityLayerVersion:1,radius:500})),address);await page.goto('/transport');await page.locator('.noise-disclosure>summary').click();const panel=page.getByRole('region',{name:'공식 소음 측정자료'});await expect(panel).toContainText(result.points[0].name);await expect(panel).toContainText(result.points[0].measuredPeriod);await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});await panel.locator('.noise-historical>summary').click();
 for(const point of result.historicalPoints??[]){const card=panel.locator('[data-noise-id="'+point.id+'"]');await expect(card).toContainText(point.measuredPeriod);for(const metric of point.metrics)await expect(card).toContainText(String(metric.db));}
 for(const width of [1440,390]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath(`noise-public-${index}-${width}.png`),fullPage:true});}
 if(index===2){await page.request.get('/api/saved');const ai=await page.request.post('/api/ai/summary',{headers:{Origin:'http://localhost:3000'},timeout:120000,data:{addresses:[address],radius:500,destination:null,days:20,roundTrip:true,month:rentMonths()[0],type:'sh',min:0,max:null,transit:[]}});const body=await ai.json();expect(ai.ok(),body.error??'AI result').toBe(true);const fact=body.summary.sections.flatMap((s:{items:{text:string;source:string}[]})=>s.items).find((item:{source:string})=>item.source.includes('공식 소음 측정자료'));expect(fact.text).toContain(result.points[0].measuredPeriod);expect(fact.text).toContain(result.points[0].name);for(const metric of result.points[0].metrics)expect(fact.text).toContain(metric.db+' dB(A)');expect(fact.text).toContain('집 내부나 현재 소음이 아닙니다');}
 report.push({address:address.address,result});
 }
 await writeFile(info.outputPath('noise-public-three-seoul.json'),JSON.stringify(report,null,2));
});
