import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {renderPlan,summarySections,type AiSummary,type Evidence,type SectionKey} from '../src/lib/ai-summary';
import {rentMonths} from '../src/lib/rent';
const origin='http://localhost:3000';
test('grounding rejects invented facts, numbers, cross-section claims and duplicate claims',()=>{
  const evidence:Evidence[]=(Object.keys(summarySections) as SectionKey[]).map((section,i)=>({id:'e'+i,section,text:section==='facilities'?'편의점 조회 3곳, 직선 120m':'정보 없음 · 확인 필요',source:'검증용 응답'}));
  const plan=Object.fromEntries(evidence.map(e=>[e.section,[e.id]]));expect(renderPlan(plan,evidence)[1].items[0].text).toBe('편의점 조회 3곳, 직선 120m');
  expect(()=>renderPlan({...plan,facilities:['편의점 99곳']},evidence)).toThrow('근거');expect(()=>renderPlan({...plan,facilities:['e0']},evidence)).toThrow('근거');expect(()=>renderPlan({...plan,checks:['e5','e5']},evidence)).toThrow('항목');
});
test('LIVE OpenAI comparison explains grounded differences without recommending an address',async({request},info)=>{
  test.setTimeout(180000);expect((await request.get('/api/saved')).ok()).toBe(true);const addresses=[];
  for(const q of ['서울 마포구 월드컵로13길 19','서울 은평구 은평로 195']){const response=await request.get('/api/locations/search',{params:{q}});expect(response.ok()).toBe(true);addresses.push((await response.json()).results[0]);}
  const response=await request.post('/api/ai/summary',{headers:{Origin:origin},timeout:150000,data:{addresses,radius:500,destination:null,days:20,roundTrip:true,month:rentMonths()[0],type:'sh',min:0,max:null,transit:[]}});const body=await response.json();expect(response.ok(),body.error??'AI comparison').toBe(true);const summary:AiSummary=body.summary;
  expect(summary.mode).toBe('compare');expect(summary.addressIds).toEqual(addresses.map(a=>a.id));expect(summary.sections[0].items[0].source).toBe('공통 비교 조건');expect(summary.sections.find(s=>s.key==='facilities')!.items.every(i=>i.source==='카카오 동일 조건 비교')).toBe(true);
  for(const section of summary.sections)for(const item of section.items)expect(summary.evidence.find(e=>e.id===item.evidenceId)?.text).toBe(item.text);
  await writeFile(info.outputPath('ai-live-comparison.json'),JSON.stringify(summary,null,2));
});
test('AI UI handles provider errors and clears stale summaries when conditions change',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[{id:'ai-ui',address:'서울 마포구 검증 기록',label:'AI UI 검증',source:'kakao',coordinates:{lat:37.55,lng:126.91}}],selectedId:'ai-ui',saved:[],compare:[],notes:{},layers:[],facilityLayerVersion:1,radius:500})));
  await page.route('**/api.odsay.com/**',r=>r.fulfill({json:{error:[{code:'429',message:'Daily quota exceeded'}]}}));let fail=true;
  await page.route('**/api/ai/summary',route=>route.fulfill(fail?{status:429,json:{error:'OpenAI 요청 한도 검증'}}:{json:{summary:{id:'test-id',mode:'address',generatedAt:new Date().toISOString(),conditions:{radius:500,destination:null,days:20,roundTrip:true,month:rentMonths()[0],type:'sh',min:0,max:null},sections:[{key:'overview',title:'검증용 응답',items:[{evidenceId:'e1',text:'테스트용 요약 문장',source:'테스트 응답'}]}],evidence:[]}}}));
  await page.goto('/summary');const button=page.getByRole('button',{name:'AI 요약하기',exact:true});await expect(button).toBeEnabled({timeout:30000});await button.click();await expect(page.locator('.ai-panel [role="alert"]')).toContainText('OpenAI 요청 한도 검증');fail=false;await button.click();await expect(page.locator('.ai-summary-content')).toContainText('테스트용 요약 문장');await page.locator('.ai-options>summary').click();await page.getByLabel('AI 요약 주택 유형').selectOption('offi');await expect(page.locator('.ai-summary-content')).toHaveCount(0);
});
test('AI endpoints reject cross-origin, invalid addresses and forged saved summaries',async({request})=>{
  expect((await request.post('/api/ai/summary',{headers:{Origin:'https://other.example'},data:{}})).status()).toBe(403);
  expect((await request.post('/api/ai/summary',{headers:{Origin:origin},data:{addresses:[]}})).status()).toBe(400);
  expect((await request.post('/api/ai/summary/save',{headers:{Origin:origin},data:{id:'invented',addressId:'x',summary:'false'}})).status()).toBe(400);
});
test('LIVE OpenAI: real address evidence, five cards, Neon save/restore and private memo separation',async({page,request},info)=>{
  test.setTimeout(180000);const search=await request.get('/api/locations/search',{params:{q:'서울 마포구 월드컵로13길 19'}});expect(search.ok()).toBe(true);const address=(await search.json()).results[0];
  await page.addInitScript(address=>{if(!sessionStorage.getItem('ai-test-seeded')){sessionStorage.setItem('ai-test-seeded','1');localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[address],selectedId:address.id,saved:[],compare:[],notes:{[address.id]:'개인 메모 전송 금지 검증'},radius:500,layers:[],facilityLayerVersion:1,commuteDays:20,commuteRoundTrip:true}));}},address);
  // Transit quota is independently tested; no invented transit facts are supplied to AI.
  await page.route('**/api.odsay.com/**',route=>route.fulfill({json:{error:[{code:'429',message:'Daily quota exceeded'}]}}));
  await page.goto('/summary');const button=page.getByRole('button',{name:'AI 요약하기',exact:true});await expect(button).toBeEnabled({timeout:30000});
  const resultPromise=page.waitForResponse(r=>r.url().endsWith('/api/ai/summary')&&r.request().method()==='POST',{timeout:120000});await button.click();const response=await resultPromise,body=await response.json();expect(response.ok(),JSON.stringify(body.error??'AI response')).toBe(true);const summary:AiSummary=body.summary;
  expect(summary.style).toBe('cards');expect(summary.sections).toHaveLength(5);expect(summary.sections[0].items.length).toBeGreaterThanOrEqual(2);expect(summary.sections[0].items.length).toBeLessThanOrEqual(3);for(const section of summary.sections)for(const item of section.items){const evidence=summary.evidence.find(e=>e.id===item.evidenceId);expect(evidence?.text).toBe(item.text);expect(evidence?.section).toBe(section.key);}
  expect(summary.evidence.some(e=>e.source==='카카오 실제 시설 조회'&&/조회 \d+곳/.test(e.text))).toBe(true);expect(summary.evidence.some(e=>e.section==='rent'&&e.source==='국토교통부 실제 월세 통계')).toBe(true);expect(summary.sections.find(s=>s.key==='transit')!.items.every(i=>i.text.includes('정보 없음'))).toBe(true);
  const requestBody=response.request().postData()!;expect(requestBody).not.toContain('개인 메모 전송 금지 검증');
  for(const fact of summary.evidence.filter(e=>e.source==='카카오 실제 시설 조회')){const match=fact.text.match(/^(.+?) 조회 (\d+)곳/);if(!match)continue;const names:Record<string,string>={'편의점':'convenience','마트·슈퍼':'market','다이소':'daiso','올리브영':'oliveyoung','일반 카페':'cafe','스터디카페':'study','프린트카페':'print','세탁소':'laundry','공원':'park','병원·약국':'medical'};const raw=await request.get('/api/facilities',{params:{lat:address.coordinates.lat,lng:address.coordinates.lng,radius:500,category:names[match[1]]}});expect(raw.ok()).toBe(true);expect((await raw.json()).places.length).toBe(Number(match[2]));}
  await page.getByRole('button',{name:'관심 주소에 AI 요약 저장',exact:true}).click();await expect(page.getByRole('button',{name:'관심 주소에 요약 저장됨'})).toBeVisible({timeout:30000});
  try{await page.goto('/saved');await expect(page.getByTestId('card-'+address.id)).toBeVisible();await page.evaluate(()=>localStorage.clear());await page.reload();const card=page.getByTestId('card-'+address.id);await expect(card.locator('.saved-ai-summary')).toBeVisible({timeout:30000});await card.locator('.saved-ai-summary>summary').click();await expect(card).toContainText(summary.sections[0].items[0].text);await expect(card.getByLabel('나의 임장 메모')).toHaveValue('개인 메모 전송 금지 검증');
    await writeFile(info.outputPath('ai-live-summary.json'),JSON.stringify(summary,null,2));await page.screenshot({path:'test-results/ai-summary-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'test-results/ai-summary-mobile.png',fullPage:true});
    const other=await request.post('/api/ai/summary/save',{headers:{Origin:origin},data:{id:summary.id,addressId:address.id}});expect([401,404]).toContain(other.status());
    await card.getByRole('button',{name:'지도에서 주소 확인'}).click();await page.getByRole('button',{name:'저장됨',exact:true}).click();const saveAgain=page.getByRole('button',{name:'주소 저장',exact:true});await expect(saveAgain).toBeEnabled();await saveAgain.click();await expect(page.getByRole('button',{name:'저장됨',exact:true})).toBeVisible();await page.goto('/saved');await expect(card.locator('.saved-ai-summary')).toHaveCount(0);
  }finally{await page.request.delete('/api/saved',{headers:{Origin:origin},data:{id:address.id}});}
});
