import {test,expect} from '@playwright/test';
import type {AddressRecord} from '../src/lib/demo-data';

test('real Kakao search for three addresses, map center and reference marker',async({page})=>{
  test.setTimeout(120000);
  const cases=['서울 중구 세종대로 110','서울 마포구 와우산로 94','서울 송파구 올림픽로 300'];
  const report:unknown[]=[];const errors:string[]=[];let secretHeader=false;page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/KakaoAK/i.test(request.headers().authorization??''))secretHeader=true;});
  for(let index=0;index<cases.length;index++){
    await page.setViewportSize(index===2?{width:390,height:844}:{width:1440,height:1000});
    await page.goto('/');await page.getByLabel('관심 있는 집 주소, 건물명 또는 지역').fill(cases[index]);
    const pending=page.waitForResponse(r=>r.url().includes('/api/locations/search?'));
    await page.getByRole('button',{name:'주소 검색',exact:true}).click();
    const response=await pending;expect(response.status()).toBe(200);
    const body=await response.json();const selected:AddressRecord=body.results[0];expect(selected.source).toBe('kakao');expect(selected.coordinates).toBeTruthy();
    await page.locator('.search-results .address-option').first().click();await expect(page).toHaveURL('/explore');
    const canvas=page.getByTestId('map-canvas');await expect(canvas).toHaveAttribute('data-map-ready','true',{timeout:30000});
    await expect(canvas).toHaveAttribute('data-marker-lat',/.+/);
    expect(Number(await canvas.getAttribute('data-marker-lat'))).toBeCloseTo(selected.coordinates!.lat,9);expect(Number(await canvas.getAttribute('data-marker-lng'))).toBeCloseTo(selected.coordinates!.lng,9);
    await expect(page.locator('.kakao-origin-label')).toHaveText(selected.label);await expect(page.locator('.selected-home-strip')).toContainText(selected.address);
    const centerValues=async()=>((await page.getByTestId('map-center').innerText()).match(/\d+\.\d+/g)??[]).map(Number);
    await expect.poll(async()=>Math.abs((await centerValues())[0]-selected.coordinates!.lat)).toBeLessThan(.00005);
    expect(Math.abs((await centerValues())[1]-selected.coordinates!.lng)).toBeLessThan(.00005);
    const originBefore=await page.getByTestId('facility-origin').getAttribute('data-origin-lng');
    const current=await canvas.getAttribute('data-map-level');await page.getByRole('button',{name:'＋ 확대',exact:true}).click();await expect(canvas).toHaveAttribute('data-map-level',String(Number(current)-1));
    const beforePan=await page.getByTestId('map-center').innerText();const bounds=(await canvas.boundingBox())!;
    await page.mouse.move(bounds.x+100,bounds.y+200);await page.mouse.down();await page.mouse.move(bounds.x+220,bounds.y+260,{steps:10});await page.mouse.up();
    await expect.poll(()=>page.getByTestId('map-center').innerText()).not.toBe(beforePan);
    await expect(page.getByTestId('selected-address')).toHaveAttribute('data-address-id',selected.id);expect(Number(await canvas.getAttribute('data-marker-lng'))).toBeCloseTo(selected.coordinates!.lng,9);
    await expect(page.getByTestId('facility-origin')).toHaveAttribute('data-origin-lng',originBefore!);
    await page.getByRole('button',{name:'선택 주소로 복귀'}).click();await expect.poll(async()=>Math.abs((await centerValues())[0]-selected.coordinates!.lat)).toBeLessThan(.00005);
    await page.screenshot({path:`test-results/kakao-live-${index+1}.png`,fullPage:true});
    report.push({query:cases[index],label:selected.label,address:selected.address,coordinates:selected.coordinates,mapReady:true,markerMatched:true,referencePreservedAfterPan:true});
  }
  expect(errors).toEqual([]);expect(secretHeader).toBe(false);await test.info().attach('live-kakao-results.json',{body:JSON.stringify(report,null,2),contentType:'application/json'});
});
