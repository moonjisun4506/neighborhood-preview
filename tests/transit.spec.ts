import {test,expect,type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {AddressRecord} from '../src/lib/demo-data';
import {monthlyTransportCost} from '../src/lib/transit';
import {normalizeDirection,normalizeStations,parseOdsayBody} from '../src/lib/odsay-data';

async function seed(page:Page,address:AddressRecord){await page.addInitScript(address=>{
  if(!localStorage.getItem('neighborhood-preview-v2'))localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[address],selectedId:address.id,saved:[],compare:[],notes:{},radius:500,layers:[],facilityLayerVersion:1}));
},address);}
test('normalize provider facts without inventing missing fares or transfer alternatives',()=>{
  const normalized=normalizeDirection({searchType:0,path:[{info:{totalTime:20,payment:1500},subPath:[{trafficType:3,sectionTime:3},{trafficType:2,lane:[{busNo:'7011'},{busNo:'7016'}],sectionTime:15},{trafficType:3,sectionTime:2}]}]},null);
  expect(normalized.paths[0]).toMatchObject({minutes:20,fare:1500,transfers:0});expect(normalized.paths[0].legs[1].lines).toEqual(['7011','7016']);
  expect(normalizeDirection({path:[{info:{totalTime:10},subPath:[]}]},null).paths[0].fare).toBeNull();
  expect(monthlyTransportCost(1500,1600,20,true)).toBe(62000);expect(monthlyTransportCost(1500,null,20,true)).toBeNull();expect(monthlyTransportCost(1500,null,20,false)).toBe(30000);expect(monthlyTransportCost(null,1600,0,true)).toBeNull();expect(monthlyTransportCost(1500,1600,32,true)).toBeNull();
  expect(parseOdsayBody({error:[{code:'-99',message:'no result'}]},'web').result).toBeNull();expect(()=>parseOdsayBody({error:[{code:'500',message:'[ApiKeyAuthFailed]'}]},'web')).toThrow('등록 URI');
  expect(normalizeStations({station:[{stationClass:1,stationID:1,stationName:'좌표 없음',x:null,y:null}]},{lat:37.5,lng:126.9},500)).toEqual([]);
});

const pairs=[
  {name:'망원시장 → 홍익대학교',origin:'서울 마포구 월드컵로13길 19',destination:'서울 마포구 와우산로 94',type:'school'},
  {name:'은평구청 → 연세대학교',origin:'서울 은평구 은평로 195',destination:'서울 서대문구 연세로 50',type:'school'},
  {name:'롯데월드타워 → 서울시청',origin:'서울 송파구 올림픽로 300',destination:'서울 중구 세종대로 110',type:'work'},
];
for(const [index,pair] of pairs.entries())test('real Web/URI transit '+pair.name,async({page,request},info)=>{
  test.skip(process.env.RUN_ODSAY_LIVE!=='1','ODsay 실제 호출은 일일 한도 보호를 위해 RUN_ODSAY_LIVE=1 설정 시에만 실행합니다.');
  test.setTimeout(90000);
  const response=await request.get('/api/locations/search',{params:{q:pair.origin}});expect(response.ok()).toBe(true);const origin:AddressRecord=(await response.json()).results[0];expect(origin.coordinates).toBeTruthy();await seed(page,origin);
  await page.setViewportSize(index===2?{width:390,height:844}:{width:1440,height:1000});
  const nearbyPromise=page.waitForResponse(r=>r.url().includes('api.odsay.com/v1/api/pointSearch'),{timeout:30000});
  await page.goto('/transport',{waitUntil:'domcontentloaded'});const rawNearby=await (await nearbyPromise).json();expect(rawNearby.error).toBeUndefined();expect(rawNearby.result.station.length).toBeGreaterThan(0);
  const canvas=page.getByTestId('map-canvas');await expect(canvas).toHaveAttribute('data-map-ready','true',{timeout:30000});await expect.poll(()=>page.locator('.transit-map-marker').count()).toBeGreaterThan(0);
  const form=page.getByRole('region',{name:'학교 직장 목적지 등록'});await page.getByLabel('목적지 종류').selectOption(pair.type);await page.getByLabel('학교 / 직장 목적지',{exact:true}).fill(pair.destination);
  const destPromise=page.waitForResponse(r=>r.url().includes('/api/locations/search?'));await form.getByRole('button',{name:'목적지 검색',exact:true}).click();const destination:AddressRecord=(await (await destPromise).json()).results[0];
  await page.locator('.destination-results .address-option').first().click();await expect(page.locator('.registered-destination')).toContainText(destination.address);await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',origin.id);
  const outboundPromise=page.waitForResponse(r=>r.url().includes('searchPubTransPathT')&&new URL(r.url()).searchParams.get('SX')===String(origin.coordinates!.lng),{timeout:30000});
  const inboundPromise=page.waitForResponse(r=>r.url().includes('searchPubTransPathT')&&new URL(r.url()).searchParams.get('SX')===String(destination.coordinates!.lng),{timeout:30000});
  await page.getByRole('button',{name:'대중교통 경로 조회',exact:true}).click();const rawOut=await (await outboundPromise).json(),rawBack=await (await inboundPromise).json();expect(rawOut.error).toBeUndefined();expect(rawBack.error).toBeUndefined();
  const out=rawOut.result.path[0],back=rawBack.result.path[0];expect(out.info.totalTime).toBeGreaterThan(0);expect(out.subPath.some((leg:{trafficType:number})=>[1,2].includes(leg.trafficType))).toBe(true);
  await expect(page.locator('.direction-paths').first()).toContainText(`${out.info.totalTime}분`);await expect(page.locator('.direction-paths').first()).toContainText(`${out.info.payment.toLocaleString()}원`);
  const boardings=out.subPath.filter((leg:{trafficType:number})=>[1,2].includes(leg.trafficType)).length;await expect(page.locator('.direction-paths').first()).toContainText(`${boardings-1}회`);
  await page.getByRole('button',{name:'1달 교통비 계산하기',exact:true}).click();await page.getByLabel('월 통학·출근 일수').fill('22');await expect(page.locator('.monthly-cost')).toContainText(`${((out.info.payment+back.info.payment)*22).toLocaleString()}원`);
  await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',origin.id);expect(Number(await canvas.getAttribute('data-marker-lng'))).toBeCloseTo(origin.coordinates!.lng,9);
  await page.screenshot({path:`test-results/transit-live-${index+1}.png`,fullPage:true});
  const report={pair:pair.name,mode:'web',origin:{address:origin.address,coordinates:origin.coordinates},destination:{address:destination.address,coordinates:destination.coordinates},stationCount:rawNearby.result.station.length,outbound:{minutes:out.info.totalTime,fare:out.info.payment,transfers:boardings-1,lines:out.subPath.flatMap((leg:{lane?:{name?:string;busNo?:string}[]})=>(leg.lane??[]).map(lane=>lane.name??lane.busNo))},inbound:{minutes:back.info.totalTime,fare:back.info.payment},monthlyDays:22,monthlyRoundTrip:(out.info.payment+back.info.payment)*22};
  const reportPath=info.outputPath('transit-live-result.json');await writeFile(reportPath,JSON.stringify(report,null,2));await info.attach('transit-live-result.json',{path:reportPath,contentType:'application/json'});
});

test('Web API errors, no-route and missing fare never generate transit data',async({page})=>{
  const origin:AddressRecord={id:'test-house',label:'테스트 집',address:'테스트 집 주소',coordinates:{lat:37.556,lng:126.903},source:'kakao'};await seed(page,origin);let stage=0;
  await page.route('https://api.odsay.com/v1/api/pointSearch?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(stage===0?{error:[{code:'500',message:'[ApiKeyAuthFailed]'}]}:{result:{station:[]}})}));
  await page.route('**/api/locations/search?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({results:[{id:'test-school',label:'테스트 학교',address:'테스트 학교 주소',coordinates:{lat:stage===2?37.5535:37.5525,lng:126.925},source:'kakao'}],hasMore:false})}));
  await page.route('https://api.odsay.com/v1/api/searchPubTransPathT?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(stage<2?{error:[{code:'-99',message:'no result'}]}:{result:{searchType:0,path:[{info:{totalTime:20},subPath:[{trafficType:2,lane:[{busNo:'테스트 노선'}]}]}]}})}));
  await page.goto('/transport',{waitUntil:'domcontentloaded'});await page.locator('.transit-disclosure>summary').click();await expect(page.locator('.transit-error').first()).toContainText('Web 인증');await expect(page.locator('.transit-map-marker')).toHaveCount(0);
  stage=1;await page.getByRole('button',{name:'정류장 다시 조회'}).click();await expect(page.getByText('이 반경에서 조회된 정류장·역이 없습니다.')).toBeVisible();
  await page.getByLabel('학교 / 직장 목적지',{exact:true}).fill('테스트 학교');await page.getByRole('button',{name:'목적지 검색',exact:true}).click();await page.locator('.destination-results .address-option').click();await page.getByRole('button',{name:'대중교통 경로 조회',exact:true}).click();await expect(page.locator('.direction-paths').first()).toContainText('조회된 대중교통 경로가 없습니다.');await expect(page.locator('.monthly-cost')).toContainText('월 예상 교통비: 정보 없음');
  stage=2;await page.getByLabel('학교 / 직장 목적지',{exact:true}).fill('다른 테스트 학교');await page.getByRole('button',{name:'목적지 검색',exact:true}).click();await page.locator('.destination-results .address-option').click();await page.getByRole('button',{name:'대중교통 경로 조회',exact:true}).click();await expect(page.locator('.direction-paths').first()).toContainText('20분');await expect(page.locator('.monthly-cost')).toContainText('월 예상 교통비: 정보 없음');
});

test('server transit endpoints reject invalid inputs without calling providers',async({request})=>{
  expect((await request.get('/api/transit/nearby',{params:{lat:'91',lng:'126.9',radius:'500'}})).status()).toBe(400);
  expect((await request.post('/api/transit/routes',{data:{origin:{lat:37.5,lng:126.9},destination:{lat:999,lng:127}}})).status()).toBe(400);
});
