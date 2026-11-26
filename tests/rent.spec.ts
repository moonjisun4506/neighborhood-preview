import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {summarizeRent,rentMonths,type RentTrade} from '../src/lib/rent';
import {parseRentXml} from '../src/lib/molit-xml';
import {GET} from '../src/app/api/rent/route';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());
const month=rentMonths()[0];
function item(deposit:string,rent:string,code='11110'){return `<item><sggCd>${code}</sggCd><dealYear>${month.slice(0,4)}</dealYear><dealMonth>${Number(month.slice(4))}</dealMonth><dealDay>15</dealDay><deposit>${deposit}</deposit><monthlyRent>${rent}</monthlyRent></item>`;}
const xml=(items:string,total:number,code='000')=>`<response><header><resultCode>${code}</resultCode></header><body><items>${items}</items><totalCount>${total}</totalCount></body></response>`;
test('rent XML and statistics exclude jeonse, missing amounts and wrong regions',()=>{
  const parsed=parseRentXml(xml(item('1,000','30')+item('2,000','50')+item('3,000','70')+item('4,000','90')+item('50,000','0')+item('','80')+item('1,000','999','99999'),7),'11110',month);
  expect(parsed.excluded).toBe(2);expect(summarizeRent(parsed.trades,0,null)).toEqual({count:4,meanRent:60,medianRent:60,medianDeposit:2500,smallSample:true});
  expect(summarizeRent(parsed.trades,2000,3000)).toMatchObject({count:2,meanRent:60,medianRent:60,medianDeposit:2500});
  expect(summarizeRent(parsed.trades,60000,null)).toMatchObject({count:0,meanRent:null,medianRent:null,medianDeposit:null,smallSample:false});
  expect(parseRentXml(xml('',0,'03'),'11110',month).total).toBe(0);
  expect(()=>parseRentXml(xml('',0,'30'),'11110',month)).toThrow('인증');
  expect(()=>parseRentXml('<!DOCTYPE response><response/>','11110',month)).toThrow('응답');
  expect(rentMonths(new Date('2026-01-01T00:00:00+09:00'))[0]).toBe('202512');
});
test('server resolves legal district and aggregates every page; failed pages never produce partial statistics',async()=>{
  const savedFetch=global.fetch,savedKey=process.env.MOLIT_API_KEY,savedKakao=process.env.KAKAO_REST_API_KEY;
  process.env.MOLIT_API_KEY='test-server-secret';process.env.KAKAO_REST_API_KEY='test-kakao-secret';let calls=0,fail=false,invalid=false;
  global.fetch=async(input)=>{const url=new URL(String(input));if(url.hostname==='dapi.kakao.com')return Response.json({documents:[{region_type:'H',code:'9999900000'},{region_type:'B',code:'1111000000',region_1depth_name:'서울특별시',region_2depth_name:'종로구'}]});
    calls++;if(invalid)return new Response(xml(item('',''),1));expect(url.searchParams.get('serviceKey')).toBe('test-server-secret');if(url.searchParams.get('pageNo')==='1')return new Response(xml(item('1000','30')+item('2000','50'),3));if(fail)return new Response('down',{status:503});return new Response(xml(item('3000','70'),3));};
  try{
    const response=await GET(new Request(`http://localhost/api/rent?lat=37.57&lng=126.98&month=${month}&type=sh&minDeposit=1000&maxDeposit=3000`));expect(response.status).toBe(200);const body=await response.json();expect(body.region).toEqual({code:'11110',name:'서울특별시 종로구'});expect(body.statistics).toMatchObject({count:3,meanRent:50,medianRent:50,medianDeposit:2000});expect(calls).toBe(2);expect(JSON.stringify(body)).not.toContain('test-server-secret');
    fail=true;const failed=await GET(new Request(`http://localhost/api/rent?lat=37.57&lng=126.98&month=${month}&type=rh`));expect(failed.status).toBe(502);expect((await failed.json()).statistics).toBeUndefined();
    invalid=true;const invalidFields=await GET(new Request(`http://localhost/api/rent?lat=37.57&lng=126.98&month=${month}&type=offi`));expect(invalidFields.status).toBe(502);expect((await invalidFields.json()).code).toBe('FIELDS');
    process.env.MOLIT_API_KEY='';const unconfigured=await GET(new Request(`http://localhost/api/rent?lat=37.57&lng=126.98&month=${month}&type=sh`));expect(unconfigured.status).toBe(503);expect((await unconfigured.json()).code).toBe('CONFIG');
  }finally{global.fetch=savedFetch;if(savedKey===undefined)delete process.env.MOLIT_API_KEY;else process.env.MOLIT_API_KEY=savedKey;if(savedKakao===undefined)delete process.env.KAKAO_REST_API_KEY;else process.env.KAKAO_REST_API_KEY=savedKakao;}
});
test('rent endpoint rejects invalid coordinates, type, period and reversed deposit bounds',async({request})=>{
  for(const suffix of ['lat=&lng=127&type=sh','lat=37.5&lng=127&type=apartment',`lat=37.5&lng=127&type=sh&month=${month}&minDeposit=2000&maxDeposit=1000`])expect((await request.get(`/api/rent?month=${month}&${suffix}`)).status()).toBe(400);
});
test('rent card filters, empty/error states and small samples on desktop and mobile',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[{id:'rent-test',label:'검증 주소',address:'서울 종로구 세종로',source:'kakao',coordinates:{lat:37.57,lng:126.98}}],selectedId:'rent-test',layers:[],facilityLayerVersion:1,saved:[],compare:[],notes:{},radius:500})));
  await page.route('**/api.odsay.com/**',route=>route.fulfill({json:{result:{station:[]}}}));
  let mode='ok';await page.route('**/api/rent?**',route=>{
    const q=new URL(route.request().url()).searchParams;expect(q.get('lat')).toBe('37.57');
    if(mode==='error')return route.fulfill({status:502,json:{error:'실거래 조회 실패'}});
    return route.fulfill({json:{region:{name:'서울특별시 종로구',code:'11110'},type:q.get('type'),month:q.get('month'),minDeposit:Number(q.get('minDeposit')),maxDeposit:null,fetchedCount:2,excludedCount:0,retrievedAt:new Date().toISOString(),statistics:mode==='empty'?{count:0,meanRent:null,medianRent:null,medianDeposit:null,smallSample:false}:{count:2,meanRent:60,medianRent:60,medianDeposit:1500,smallSample:true}}});
  });
  await page.goto('/summary');await page.locator('.rent-disclosure>summary').click();const panel=page.getByRole('region',{name:'지역 월세 실거래 참고 통계'});await panel.getByLabel('주택 유형').selectOption('offi');await panel.getByLabel('최소 보증금 (만원)').fill('1000');await panel.getByRole('button',{name:'월세 통계 조회'}).click();await expect(panel).toContainText('60만원');await expect(panel).toContainText('표본 부족');
  await page.setViewportSize({width:390,height:844});expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  mode='empty';await panel.getByLabel('주택 유형').selectOption('rh');await expect(panel).not.toContainText('60만원');await panel.getByRole('button',{name:'월세 통계 조회'}).click();await expect(panel).toContainText('월세 거래가 없습니다');
  mode='error';await panel.getByRole('button',{name:'월세 통계 조회'}).click();await expect(panel.getByRole('alert')).toContainText('실거래 조회 실패');await expect(panel).not.toContainText('60만원');
});
test('LIVE MOLIT: three housing types, full XML responses and independent arithmetic',async({},info)=>{
  test.skip(!process.env.MOLIT_API_KEY?.trim(),'MOLIT_API_KEY 미설정: 실제 응답 검증 대기');test.setTimeout(180000);
  let key=process.env.MOLIT_API_KEY!.trim();if(key.includes('%'))key=decodeURIComponent(key);const results=[];
  for(const [type,svc] of [['sh','SHRent'],['rh','RHRent'],['offi','OffiRent']]){
    const rows:RentTrade[]=[];let total=0,received=0;
    for(let page=1;page<=100;page++){
      const url=new URL(`https://apis.data.go.kr/1613000/RTMSDataSvc${svc}/getRTMSDataSvc${svc}`);url.search=new URLSearchParams({serviceKey:key,LAWD_CD:'11440',DEAL_YMD:month,numOfRows:'1000',pageNo:String(page)}).toString();
      const response=await fetch(url,{signal:AbortSignal.timeout(15000)});expect(response.ok,'MOLIT HTTP success').toBe(true);const body=parseRentXml(await response.text(),'11440',month);total=body.total;received+=body.itemsCount;rows.push(...body.trades);if(received===total)break;expect(body.itemsCount).toBeGreaterThan(0);
    }
    expect(received).toBe(total);const monthly=rows.filter(t=>t.monthlyRent>0),sorted=monthly.map(t=>t.monthlyRent).sort((a,b)=>a-b),stats=summarizeRent(rows,0,null);
    expect(stats.count).toBe(monthly.length);expect(stats.meanRent).toBe(monthly.length?monthly.reduce((sum,t)=>sum+t.monthlyRent,0)/monthly.length:null);expect(stats.medianRent).toBe(sorted.length?(sorted[Math.floor(sorted.length/2)]+sorted[Math.ceil(sorted.length/2)-1])/2:null);
    const app=await GET(new Request(`http://localhost/api/rent?lat=37.5555&lng=126.9091&month=${month}&type=${type}`));expect(app.ok).toBe(true);const actual=await app.json();expect(actual.region.code).toBe('11440');expect(actual.statistics).toEqual(stats);results.push({type,month,total,statistics:stats});
  }
  await writeFile(info.outputPath('molit-live-statistics.json'),JSON.stringify(results,null,2));
  await info.attach('molit-live-statistics.json',{body:JSON.stringify(results,null,2),contentType:'application/json'});
});
