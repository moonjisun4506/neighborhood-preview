import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {inspectSafetyRaster} from '../src/lib/safety-raster';
test.use({actionTimeout:10000});

test('synthetic pixel diagnostics distinguish transparency and official colors without inferring crimes',()=>{
  expect(inspectSafetyRaster([0,0,0,0],[{color:'#ff0000'}]).status).toBe('transparent');
  expect(inspectSafetyRaster([255,0,0,255],[{color:'#ff0000'}]).status).toBe('legend_colors');
  expect(inspectSafetyRaster([0,0,255,255],[{color:'#ff0000'}]).status).toBe('unclassified');
});

test('LIVE colored, transparent and sparse official WMS images display, toggle and align on PC/mobile',async({page,request},info)=>{
  test.setTimeout(180000);const report=[];
  // ODsay is unrelated and quota-limited; it is deliberately mocked, not claimed as verified.
  await page.route('**/api.odsay.com/**',r=>r.fulfill({json:{error:[{code:'429',message:'Daily quota exceeded'}]}}));
  for(const [index,q] of ['서울 중구 세종대로 110','한라산 성판악탐방안내소','강원특별자치도 평창군 대관령면 올림픽로 715'].entries()){
    const search=await request.get('/api/locations/search',{params:{q}});expect(search.ok()).toBe(true);const address=(await search.json()).results[0];expect(address.coordinates).toBeTruthy();
    const response=await request.get('/api/safety',{params:address.coordinates});const result=await response.json();expect(result.status).toBe('available');expect(result.legend.length).toBe(10);
    await page.addInitScript(address=>localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[address],selectedId:address.id,saved:[],compare:[],notes:{},layers:[],facilityLayerVersion:1,radius:300,commuteDays:20})),address);
    await page.setViewportSize(index===1?{width:390,height:844}:{width:1440,height:1000});await page.goto('/transport');await page.locator('.safety-disclosure>summary').click();
    const toggle=page.getByRole('checkbox',{name:'치안 정보 지도 표시'});await expect(toggle).toBeEnabled({timeout:30000});await expect(toggle).not.toBeChecked();await expect(page.locator('[data-raster-status]')).toHaveAttribute('data-raster-status','off');
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready','true',{timeout:30000});await toggle.check();
    const image=page.locator('.safety-wms-image'),overlay=page.locator('.safety-overlay');await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(512);
    const raster=await image.evaluate((img:HTMLImageElement,legend)=>{const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d')!;x.drawImage(img,0,0);const data=x.getImageData(0,0,512,512).data,colors=new Set(legend.map((v:{color:string})=>parseInt(v.color.slice(1),16)));let visible=0,colored=0;for(let i=0;i<data.length;i+=4)if(data[i+3]){visible++;if(colors.has((data[i]<<16)|(data[i+1]<<8)|data[i+2]))colored++;}return {visible,colored,opacity:getComputedStyle(img).opacity};},result.legend);
    expect(raster.opacity).toBe('1');if(index===1)expect(raster.visible).toBe(0);else expect(raster.colored).toBeGreaterThan(0);
    await expect(page.locator('[data-raster-status]')).toHaveAttribute('data-raster-status',index===1?'transparent':'legend_colors');await expect(page.getByRole('group',{name:'범죄주의구간 공식 범례'})).toBeVisible();expect(Number(await overlay.getAttribute('data-projection-error'))).toBeLessThan(1);await expect(overlay).toHaveAttribute('data-radius','1000');
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('official-'+index+'.png'),fullPage:true});
    const transform=await image.getAttribute('style');await page.getByRole('button',{name:/축소/}).click();await expect.poll(()=>image.getAttribute('style')).not.toBe(transform);
    const box=(await page.getByTestId('map-canvas').boundingBox())!;await page.mouse.move(box.x+50,box.y+150);await page.mouse.down();await page.mouse.move(box.x+130,box.y+210,{steps:8});await page.mouse.up();await expect(overlay).toHaveAttribute('data-origin-lat',String(address.coordinates.lat));expect(Number(await overlay.getAttribute('data-projection-error'))).toBeLessThan(1);
    await toggle.uncheck();await expect(overlay).toHaveCount(0);await expect(page.getByRole('group',{name:'범죄주의구간 공식 범례'})).toHaveCount(0);await toggle.check();await expect(overlay).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    report.push({query:q,address:address.address,origin:address.coordinates,status:result.status,raster,bounds:result.bounds,catalog:result.catalog});
  }
  await writeFile(info.outputPath('official-raster-results.json'),JSON.stringify(report,null,2));
});
