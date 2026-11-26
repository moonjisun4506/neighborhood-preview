import {test,expect,type Page} from '@playwright/test';
import {demoAddresses} from '../src/lib/demo-data';
async function seed(page:Page){await page.addInitScript(({addresses})=>{
  if(!localStorage.getItem('neighborhood-preview-v2'))localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses,selectedId:addresses[0].id,saved:addresses.map(a=>a.id),compare:[addresses[0].id,addresses[2].id],notes:{}}));
},{addresses:demoAddresses});}
test('six screens stay responsive with Kakao map and no recommendation UI',async({page})=>{
  test.setTimeout(90000);await seed(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:375,height:812},{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(viewport);
    for(const route of ['/','/explore','/transport','/summary','/saved','/compare']){
      expect((await page.goto(route))?.status()).toBe(200);await expect(page.getByRole('main')).toBeVisible();
      await expect(page.locator('.demo-banner')).toContainText('카카오맵에서 조회');
      if(route==='/explore')await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} at ${viewport.width}`).toBe(true);
      await expect(page.locator('main')).not.toContainText(/추천|적합도|매칭|\d위|안전 등급/);
      await page.screenshot({path:`test-results/screens/${viewport.width}-${route==='/'?'home':route.slice(1)}.png`,fullPage:true});
    }
  }expect(errors).toEqual([]);
});
test('empty results and API errors never become fabricated addresses',async({page})=>{
  let fail=false;await page.route('**/api/locations/search?*',route=>route.fulfill({status:fail?429:200,contentType:'application/json',body:JSON.stringify(fail?{error:'검색 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'}:{results:[],hasMore:false})}));
  await page.goto('/');await page.getByLabel('관심 있는 집 주소, 건물명 또는 지역').fill('검색 결과 없는 주소');await page.getByRole('button',{name:'주소 검색',exact:true}).click();
  await expect(page.getByText('검색 결과가 없습니다.',{exact:false})).toBeVisible();await expect(page.locator('.address-option')).toHaveCount(0);
  fail=true;await page.getByRole('button',{name:'주소 검색',exact:true}).click();await expect(page.locator('.address-search [role="alert"]')).toContainText('요청 한도를 초과');await expect(page.locator('.address-option')).toHaveCount(0);
});
test('memo, saved filters, comparison selection and row ordering persist',async({page})=>{
  await seed(page);await page.goto('/saved');const card=page.getByTestId('card-demo-mangwon');
  await card.getByLabel('나의 임장 메모').fill('직접 확인할 창문 방향');await card.getByRole('button',{name:'메모 저장',exact:true}).click();await page.reload();await expect(card.getByLabel('나의 임장 메모')).toHaveValue('직접 확인할 창문 방향');
  await page.getByRole('button',{name:'메모 작성 완료',exact:true}).click();await expect(page.locator('.dossier-card')).toHaveCount(1);await page.getByRole('button',{name:'전체 목록',exact:true}).click();
  await page.getByRole('button',{name:'선택 해제',exact:true}).click();await card.getByLabel('비교함 담기').check();await page.getByTestId('card-demo-yeonhui').getByLabel('비교함 담기').check();
  await page.goto('/compare');await expect(page.getByRole('columnheader',{name:/예시 주소 B/})).toBeVisible();await expect(page.getByRole('columnheader',{name:/예시 주소 C/})).toHaveCount(0);await expect(page.locator('.comparison-note').first()).toContainText('직접 확인할 창문 방향');
  await page.getByRole('button',{name:'저장한 주소 추가 (최대 3곳)'}).click();await page.getByRole('button',{name:'예시 주소 C 추가',exact:true}).click();await expect(page.getByRole('columnheader',{name:/예시 주소 C/})).toBeVisible();await expect(page.getByRole('button',{name:'저장한 주소 추가 (최대 3곳)'})).toBeDisabled();
  await page.getByLabel('비교 항목 순서').selectOption('rent');await expect(page.locator('tbody tr').first()).toContainText('지역별 월세 참고 통계');
  await page.goto('/saved');await card.getByRole('button',{name:'저장됨',exact:true}).click();await expect(card).toHaveCount(0);await page.goto('/compare');await expect(page.getByRole('columnheader',{name:/예시 주소 A/})).toHaveCount(0);
});
test('legacy records keep their notes and do not get a real-location marker',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('neighborhood-preview-v1',JSON.stringify({saved:['mangwon','yeonhui'],compare:['mangwon','yeonhui'],notes:{mangwon:'예전 임장 기록'},destination:'기존 학교'})));
  await page.goto('/saved');await expect(page.locator('.dossier-card')).toHaveCount(2);await expect(page.getByTestId('card-mangwon').getByLabel('나의 임장 메모')).toHaveValue('예전 임장 기록');
  await page.getByTestId('card-mangwon').getByRole('button',{name:'지도에서 주소 확인'}).click();await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-marker-lat','');
  await page.goto('/recommend');await expect(page).toHaveURL('/summary');
});
test('mobile filters, radius and detail controls share state with desktop',async({page})=>{
  await seed(page);await page.setViewportSize({width:390,height:844});await page.goto('/explore');await page.getByRole('button',{name:'시설 필터',exact:true}).click();const cafe=page.getByRole('checkbox',{name:'일반 카페',exact:true});await cafe.uncheck();
  await page.getByRole('button',{name:'1km',exact:true}).click();await page.getByRole('button',{name:'필터 닫기'}).click();await page.getByRole('tab',{name:'교통·소음·치안',exact:true}).click();await expect(page.getByRole('region',{name:'학교 직장 목적지 등록'})).toBeVisible();await page.getByRole('tab',{name:'주변 시설',exact:true}).click();
  await page.setViewportSize({width:1440,height:1000});await expect(cafe).not.toBeChecked();await page.reload();await expect(cafe).not.toBeChecked();await expect(page.getByRole('button',{name:'1km',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('search endpoint rejects invalid inputs before making upstream calls',async({request})=>{
  for(const query of ['','a'.repeat(101)])expect((await request.get('/api/locations/search',{params:{q:query}})).status()).toBe(400);
  for(const page of ['0','46','abc','1.5'])expect((await request.get('/api/locations/search',{params:{q:'서울시청',page}})).status()).toBe(400);
});
