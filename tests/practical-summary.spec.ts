import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {addressSummarySections,renderAddressPlan,type AiSummary} from '../src/lib/ai-summary';
import {practicalEvidence,verifiedWalkingGroups} from '../src/lib/practical-evidence.server';
import type {SummaryRequest} from '../src/lib/ai-summary';
import type {TransitRoutes} from '../src/lib/transit';
import type {WalkingRoute} from '../src/lib/tmap';
import type {NoiseResult} from '../src/lib/noise';

test('MOCK noise uses nearest coordinates within 1km and never relabels 22h rail measurements',async()=>{
  const address={id:'noise-house',label:'집',address:'테스트 주소',source:'kakao' as const,coordinates:{lat:37.5,lng:127}};
  const input:SummaryRequest={addresses:[address],destination:null,radius:500,days:20,roundTrip:true,month:'202610',type:'sh',min:0,max:null,transit:[]};
  const point={id:'near',kind:'rail' as const,name:'실제 좌표 검증용 모의 측정소',address:'모의 주소',coordinates:{lat:37.501,lng:127},distanceMeters:9000,measuredPeriod:'2025년 4분기',metrics:[{label:'22시 측정값',db:60}],source:'모의 공식 출처',sourceUrl:'https://example.com/noise'};
  const noise:NoiseResult={origin:address.coordinates,radius:1000,points:[{...point,id:'far',name:'범위 밖 모의 지점',coordinates:{lat:37.52,lng:127},distanceMeters:1},point],warnings:[],fetchedAt:new Date().toISOString(),period:'2025년',limited:false};
  const facts=await practicalEvidence(input,address,[],null,null,noise),text=facts.find(f=>f.section==='noise')!.text;
  expect(text).toContain(point.name);expect(text).toContain(point.measuredPeriod);expect(text).toContain('22시 측정값 60 dB(A)');expect(text).not.toContain('야간 평균');expect(text).not.toContain('범위 밖');
  noise.points.shift();noise.points[0].coordinates={lat:37.52,lng:127};
  expect((await practicalEvidence(input,address,[],null,null,noise)).find(f=>f.section==='noise')!.text).toContain('측정자료가 없습니다');
});

test('MOCK verified walking buckets use seconds, deduplicate categories and exclude expired cache',()=>{
  const walk=(seconds:number,expired=false):WalkingRoute=>({provider:'tmap',status:'ok',seconds,distanceMeters:100,fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+(expired?-1000:60000)).toISOString()});
  const groups=verifiedWalkingGroups([{label:'편의점',walks:[walk(300),walk(600)]},{label:'약국',walks:[walk(600)]},{label:'세탁소',walks:[walk(601)]},{label:'카페',walks:[walk(60,true),null]}]);
  expect(groups.map(g=>g.entries.map(e=>e.label))).toEqual([['편의점'],['약국'],['세탁소']]);
});

test('MOCK monthly fare requires explicit calculation and matching selected route IDs',async()=>{
  const address={id:'house',label:'집',address:'서울 테스트 주소',source:'kakao' as const,coordinates:{lat:37.5,lng:127}};
  const destination={...address,id:'school',label:'등록 학교'};
  const input:SummaryRequest={addresses:[address],destination,radius:500,days:20,roundTrip:true,month:'202610',type:'sh',min:0,max:null,transit:[]};
  const routes:TransitRoutes={provider:'odsay',origin:address.coordinates,destination:destination.coordinates,fetchedAt:new Date().toISOString(),outbound:{status:'ok',paths:[{id:'out',minutes:35,fare:1500,transfers:1,legs:[]}]},inbound:{status:'ok',paths:[{id:'back',minutes:40,fare:1600,transfers:0,legs:[]}]}};
  const generate=async()=> (await practicalEvidence(input,address,[],null,routes)).filter(f=>f.section==='commute').map(f=>f.text).join(' ');
  expect(await generate()).not.toContain('62,000원');
  input.monthlyCalculation={addressId:address.id,destinationId:destination.id,outboundId:'out',inboundId:'back',days:20};
  expect(await generate()).toContain('62,000원');expect(await generate()).toContain('등록 학교');
  input.monthlyCalculation.inboundId='wrong';expect(await generate()).not.toContain('62,000원');
  input.monthlyCalculation.addressId='old-house';expect(await generate()).not.toContain('62,000원');
});

test('seven cards reject invented facts and keep contract checks short',()=>{
  const facts=Object.keys(addressSummarySections).map((section,i)=>({id:String(i),section:section as keyof typeof addressSummarySections,text:'확인된 자료',source:'주소 카드 · 공식 자료'}));
  const plan=Object.fromEntries(facts.map(f=>[f.section,[f.id]]));
  expect(renderAddressPlan(plan,facts)).toHaveLength(7);
  expect(()=>renderAddressPlan({...plan,facilities:['invented']},facts)).toThrow('근거');
  expect(()=>renderAddressPlan({...plan,checks:['1','2','3']},facts)).toThrow();
});

test('LIVE three Seoul addresses: grounded seven cards, no additional routing, responsive readability',async({page},info)=>{
  test.setTimeout(300000);const report:unknown[]=[];let routes=0;
  page.on('request',r=>{if(/\/api\/(tmap\/(walk|routes)|transit\/routes)/.test(r.url()))routes++;});
  for(const [index,q] of ['서울 중구 세종대로 110','서울 마포구 와우산로 94','서울 송파구 올림픽로 300'].entries()){
    await page.setViewportSize(index===1?{width:390,height:844}:{width:1440,height:1000});
    await page.emulateMedia({colorScheme:index===1?'dark':'light'});
    if(!index)await page.goto('/');else{await page.getByRole('tab',{name:'주변 시설',exact:true}).click();await expect(page).toHaveURL(/\/explore$/);await expect(page.getByRole('tab',{name:'주변 시설',exact:true})).toHaveAttribute('aria-selected','true');}
    await page.getByLabel('관심 있는 집 주소, 건물명 또는 지역').fill(q);
    const lookup=page.waitForResponse(r=>r.url().includes('/api/locations/search?'));
    await page.getByRole('button',{name:'주소 검색',exact:true}).click();
    const address=(await (await lookup).json()).results[0];
    await page.locator('.address-search .address-option').first().click();
    await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',address.id);
    await page.getByRole('tab',{name:'AI 요약',exact:true}).click();
    await expect(page.locator('.summary-card')).toHaveCount(0);
    const response=page.waitForResponse(r=>r.url().endsWith('/api/ai/summary'),{timeout:160000});
    await page.getByRole('button',{name:'AI 요약하기',exact:true}).click();
    const raw=await response,body=await raw.json();expect(raw.ok(),body.error).toBe(true);
    const summary:AiSummary=body.summary;
    expect(summary.addressIds).toEqual([address.id]);expect(summary.sections.map(s=>s.title)).toEqual(Object.values(addressSummarySections));
    for(const section of summary.sections){expect(section.items.length).toBeLessThanOrEqual(section.key==='checks'?2:3);for(const item of section.items)expect(summary.evidence.some(e=>e.id===item.evidenceId&&e.text===item.text&&e.section===section.key)).toBe(true);}
    const text=summary.sections.flatMap(s=>s.items.map(i=>i.text)).join(' ');
    expect(text).not.toMatch(/안전한 동네|조용한 동네|추천 순위|야간 평균 22/);
    expect(summary.sections.find(s=>s.key==='commute')!.items.map(i=>i.text).join(' ')).not.toMatch(/교통비는 [\d,]+원/);
    await expect(page.locator('.summary-card')).toHaveCount(7);
    const noiseResponse=await page.request.get('/api/noise',{params:{...address.coordinates,radius:1000}});
    expect(noiseResponse.ok()).toBe(true);const noise=await noiseResponse.json();
    const noiseText=summary.sections.find(s=>s.key==='noise')!.items.map(i=>i.text).join(' ');
    if(noise.points.length){const nearest=noise.points[0];expect(noiseText).toContain(nearest.name);expect(noiseText).toContain(nearest.measuredPeriod);for(const metric of nearest.metrics)expect(noiseText).toContain(`${metric.label} ${metric.db} dB(A)`);}else expect(noiseText).toContain('측정자료가 없습니다');
    if(index===0){
      await page.getByRole('button',{name:'관심 주소에 AI 요약 저장',exact:true}).click();
      await expect(page.getByRole('button',{name:'관심 주소에 요약 저장됨',exact:true})).toBeVisible();
      const stored=await (await page.request.get('/api/saved')).json();
      expect(stored.entries.find((e:{address:{id:string}})=>e.address.id===address.id).ai_summary.addressIds).toEqual([address.id]);
      await page.reload();await expect(page.locator('.summary-card')).toHaveCount(0);
      const reloaded=await (await page.request.get('/api/saved')).json();
      expect(reloaded.entries.find((e:{address:{id:string}})=>e.address.id===address.id).ai_summary.id).toBe(summary.id);
      expect((await page.request.delete('/api/saved',{headers:{Origin:'http://localhost:3000'},data:{id:address.id}})).ok()).toBe(true);
    }
    const colors=await page.locator('.summary-card li').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).color));
    expect(colors).not.toContain('rgb(255, 255, 255)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`address-${index+1}.png`),fullPage:true});
    report.push({address:address.address,summary});
  }
  expect(routes).toBe(0);await writeFile(info.outputPath('actual-summaries.json'),JSON.stringify(report,null,2));
});
