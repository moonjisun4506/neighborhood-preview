import {test,expect,request as newRequest} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import type {AddressRecord} from '../src/lib/demo-data';
const origin='http://localhost:3000';
test('LIVE Neon: anonymous isolation, cookie flags, CRUD, CSRF and validation',async()=>{
  test.setTimeout(90000);const a=await newRequest.newContext({baseURL:origin}),b=await newRequest.newContext({baseURL:origin});const id='db-api-test-'+randomUUID();
  try{
    const session=await a.get('/api/saved');expect(session.ok()).toBe(true);expect(session.headers()['set-cookie']).toMatch(/HttpOnly/i);expect(session.headers()['set-cookie']).toMatch(/SameSite=strict/i);expect(session.headers()['cache-control']).toContain('no-store');expect((await b.get('/api/saved')).ok()).toBe(true);
    const address:AddressRecord={id,label:'DB 동작 검증용 기록',address:'테스트 작성 기록 · 실제 조회 주소 아님',source:'manual',coordinates:null};
    const put=await a.put('/api/saved',{headers:{Origin:origin},data:{address,memo:"개인 메모 ' ; SELECT 1; --"}});expect(put.ok()).toBe(true);
    expect((await (await a.get('/api/saved')).json()).entries.find((e:{address:AddressRecord})=>e.address.id===id).memo).toContain('SELECT 1');
    expect((await (await b.get('/api/saved')).json()).entries).toEqual([]);
    expect((await a.get('/api/saved',{headers:{'Sec-Fetch-Site':'cross-site'}})).status()).toBe(403);
    expect((await b.delete('/api/saved',{headers:{Origin:origin},data:{id}})).ok()).toBe(true);expect((await (await a.get('/api/saved')).json()).entries).toHaveLength(1);
    expect((await a.put('/api/saved',{headers:{Origin:'https://foreign.example'},data:{address,memo:'bad'}})).status()).toBe(403);
    expect((await a.put('/api/saved',{headers:{Origin:origin},data:{address,memo:'x'.repeat(4001)}})).status()).toBe(400);
    expect((await a.put('/api/saved',{headers:{Origin:origin},data:{address,memo:''}})).ok()).toBe(true);expect((await (await a.get('/api/saved')).json()).entries[0].memo).toBe('');
    expect((await a.delete('/api/saved',{headers:{Origin:origin},data:{id}})).ok()).toBe(true);expect((await (await a.get('/api/saved')).json()).entries).toEqual([]);
  }finally{await a.delete('/api/saved',{headers:{Origin:origin},data:{id}});await a.dispose();await b.dispose();}
});
test('LIVE Neon UI: save, edit/delete memo, restore without localStorage, open map and remove',async({page,request})=>{
  test.setTimeout(90000);const search=await request.get('/api/locations/search',{params:{q:'서울 마포구 월드컵로13길 19'}});expect(search.ok()).toBe(true);const address:AddressRecord=(await search.json()).results[0];
  await page.addInitScript(address=>{if(!sessionStorage.getItem('db-seeded')){sessionStorage.setItem('db-seeded','1');localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[address],selectedId:address.id,saved:[],compare:[],notes:{},radius:500,layers:[],facilityLayerVersion:1}));}},address);
  await page.goto('/explore');const save=page.getByRole('button',{name:'주소 저장',exact:true});await expect(save).toBeEnabled({timeout:30000});await save.click();await expect(page.getByRole('button',{name:'저장됨',exact:true})).toBeVisible();
  try{
    await page.getByRole('button',{name:'메모',exact:true}).click();const popup=page.getByRole('dialog',{name:'집 주소 메모'});await popup.getByLabel('나의 임장 메모').fill('지도 팝업에서 DB에 저장한 메모');await popup.getByRole('button',{name:'메모 저장',exact:true}).click();await expect(page.locator('.toast')).toContainText('DB에 저장');await page.reload();await page.getByRole('button',{name:'메모',exact:true}).click();await expect(popup.getByLabel('나의 임장 메모')).toHaveValue('지도 팝업에서 DB에 저장한 메모');await popup.getByRole('button',{name:'메모장 닫기'}).click();
    await page.goto('/saved');const card=page.getByTestId('card-'+address.id);await expect(card).toBeVisible();await expect(card).toContainText('익명 DB 보관함');await card.getByLabel('나의 임장 메모').fill('내가 직접 기록한 메모');await card.getByRole('button',{name:'메모 저장',exact:true}).click();await expect(page.locator('.toast')).toContainText('DB에 저장');
    await page.evaluate(()=>localStorage.clear());await page.reload();await expect(card.getByLabel('나의 임장 메모')).toHaveValue('내가 직접 기록한 메모',{timeout:30000});
    await card.getByLabel('나의 임장 메모').fill('수정한 개인 메모');await card.getByRole('button',{name:'메모 저장',exact:true}).click();await expect(page.locator('.toast')).toContainText('DB에 저장');await page.reload();await expect(card.getByLabel('나의 임장 메모')).toHaveValue('수정한 개인 메모');
    await card.getByRole('button',{name:'메모 삭제',exact:true}).click();await expect(card.getByLabel('나의 임장 메모')).toHaveValue('');await page.reload();await expect(card.getByLabel('나의 임장 메모')).toHaveValue('');
    await card.getByRole('button',{name:'지도에서 주소 확인'}).click();await expect(page).toHaveURL('/explore');await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',address.id);
    await page.goto('/saved');await card.getByRole('button',{name:'저장됨',exact:true}).click();await expect(card).toHaveCount(0);await page.reload();await expect(card).toHaveCount(0);
  }finally{await page.request.delete('/api/saved',{headers:{Origin:origin},data:{id:address.id}});}
});
test('comparison uses identical facility, destination, days and rent criteria and hides stale data',async({page})=>{
  const addresses:AddressRecord[]=[0,1,2].map(i=>({id:'comparison-'+i,label:'비교 검증 '+i,address:'테스트 주소 '+i,source:'kakao',coordinates:{lat:37.55+i/100,lng:126.91}}));
  await page.addInitScript(addresses=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses,selectedId:addresses[0].id,saved:addresses.map(a=>a.id),compare:addresses.map(a=>a.id),notes:{[addresses[0].id]:'사용자가 적은 개인 메모'},radius:500,destinationLocation:addresses[2],commuteDays:20,commuteRoundTrip:true})),addresses);
  const facilityCalls:URL[]=[],rentCalls:URL[]=[],transitCalls:URL[]=[];
  await page.route('**/api/facilities?**',route=>{const url=new URL(route.request().url());facilityCalls.push(url);return route.fulfill({json:{source:'kakao',places:[],limited:false,category:url.searchParams.get('category')}});});
  await page.route('**/api/rent?**',route=>{const url=new URL(route.request().url());rentCalls.push(url);return route.fulfill({json:{region:{name:'테스트 지역',code:'11440'},month:url.searchParams.get('month'),type:url.searchParams.get('type'),statistics:{count:2,medianRent:55,medianDeposit:2000,smallSample:true}}});});
  await page.route('**/api.odsay.com/**',route=>{const url=new URL(route.request().url());transitCalls.push(url);return route.fulfill({json:url.pathname.includes('pointSearch')?{result:{station:[]}}:{result:{searchType:0,path:[{info:{totalTime:25,payment:1500},subPath:[{trafficType:2,lane:[{busNo:'검증 노선'}]}]}]}}});});
  await page.goto('/compare');await page.getByLabel('비교 검색 반경').selectOption('1000');await page.getByLabel('비교 주택 유형').selectOption('offi');await page.getByLabel('비교 최소 보증금 (만원)').fill('1000');await page.getByLabel('비교 최대 보증금 (만원)').fill('5000');await page.getByRole('button',{name:'같은 조건으로 비교 조회',exact:true}).click();await expect(page.getByRole('button',{name:'같은 조건으로 비교 조회',exact:true})).toBeEnabled({timeout:30000});
  expect(facilityCalls).toHaveLength(30);expect(facilityCalls.every(u=>u.searchParams.get('radius')==='1000')).toBe(true);expect(rentCalls).toHaveLength(3);expect(rentCalls.every(u=>u.searchParams.get('type')==='offi'&&u.searchParams.get('minDeposit')==='1000'&&u.searchParams.get('maxDeposit')==='5000')).toBe(true);
  const routeCalls=transitCalls.filter(u=>u.pathname.includes('searchPubTransPathT'));expect(routeCalls).toHaveLength(6);expect(routeCalls.filter(u=>u.searchParams.get('EX')===String(addresses[2].coordinates!.lng))).toHaveLength(6);
  await expect(page.locator('.comparison-matrix')).toContainText('60,000원');await expect(page.locator('.comparison-matrix')).toContainText('월세 중앙값 55만원');await expect(page.locator('.comparison-note').first()).toContainText('사용자가 적은 개인 메모');
  await page.route('**/api/ai/summary',route=>route.fulfill({json:{summary:{id:'audit-summary',mode:'compare',generatedAt:new Date().toISOString(),conditions:{radius:1000,destination:null,days:20,roundTrip:true,month:'202610',type:'offi',min:1000,max:5000},sections:[{key:'overview',title:'비교 상태 검증',items:[{evidenceId:'e1',text:'이전 비교 요약 고유문구',source:'테스트 응답'}]}],evidence:[]}}}));
  await page.getByRole('button',{name:'AI 차이점 요약하기'}).click();await expect(page.locator('.ai-summary-content')).toContainText('이전 비교 요약 고유문구');await page.getByRole('button',{name:'같은 조건으로 비교 조회',exact:true}).click();await expect(page.getByRole('button',{name:'같은 조건으로 비교 조회',exact:true})).toBeEnabled();await expect(page.locator('.ai-summary-content')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.getByLabel('비교 검색 반경').selectOption('300');await expect(page.locator('.comparison-matrix')).not.toContainText('55만원');await page.getByLabel('비교 검색 반경').selectOption('1000');await expect(page.locator('.comparison-matrix')).not.toContainText('55만원');
});
test('LIVE comparison: two real addresses use Kakao facilities and ODsay responses',async({page,request},info)=>{
  test.skip(process.env.RUN_LIVE_COMPARISON!=='1','실제 비교는 제공사 한도 확인 후 RUN_LIVE_COMPARISON=1로 실행합니다.');test.setTimeout(180000);const addresses:AddressRecord[]=[];
  for(const q of ['서울 마포구 월드컵로13길 19','서울 은평구 은평로 195','서울 서대문구 연세로 50']){const response=await request.get('/api/locations/search',{params:{q}});expect(response.ok()).toBe(true);addresses.push((await response.json()).results[0]);}
  await page.addInitScript(addresses=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses,saved:addresses.slice(0,2).map(a=>a.id),compare:addresses.slice(0,2).map(a=>a.id),notes:{},radius:500,destinationLocation:addresses[2],commuteDays:20,commuteRoundTrip:true})),addresses);
  const facilities:{origin:unknown;category:string;count:number}[]=[];const transit:{endpoint:string;success:boolean}[]=[];
  page.on('response',async response=>{try{if(response.url().includes('/api/facilities?')){const body=await response.json();if(response.ok())facilities.push({origin:body.origin,category:body.category,count:body.places.length});}if(response.url().includes('api.odsay.com')){const body=await response.json();transit.push({endpoint:new URL(response.url()).pathname.split('/').pop()!,success:!body.error});}}catch{}});
  await page.goto('/compare');await page.getByRole('button',{name:'같은 조건으로 비교 조회',exact:true}).click();await expect(page.getByRole('button',{name:'같은 조건으로 비교 조회',exact:true})).toBeEnabled({timeout:150000});
  await expect.poll(()=>facilities.length).toBe(20);expect(transit).toHaveLength(6);expect(transit.every(t=>t.success)).toBe(true);await expect(page.locator('.comparison-matrix')).toContainText('직선');await expect(page.locator('.comparison-matrix')).toContainText('원');
  await page.screenshot({path:'test-results/comparison-live-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'test-results/comparison-live-mobile.png',fullPage:true});
  await writeFile(info.outputPath('comparison-live-results.json'),JSON.stringify({addresses:addresses.slice(0,2).map(a=>a.address),radius:500,destination:addresses[2].address,facilities,transit},null,2));
});
test('failed DB writes never appear as saved addresses',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[{id:'failed-write',label:'저장 오류 검증',address:'테스트 기록',source:'manual',coordinates:null}],selectedId:'failed-write',saved:[],compare:[],notes:{},layers:[]})));
  await page.route('**/api/saved',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'DB 저장 실패 검증'}}):route.continue());
  await page.goto('/explore');const save=page.getByRole('button',{name:'주소 저장',exact:true});await expect(save).toBeEnabled({timeout:30000});await save.click();await expect(page.locator('.storage-notice')).toContainText('DB 저장 실패 검증');await expect(page.getByRole('button',{name:'저장됨',exact:true})).toHaveCount(0);await page.goto('/saved');await expect(page.getByTestId('card-failed-write')).toHaveCount(0);
});
