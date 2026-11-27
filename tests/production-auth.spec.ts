import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {loadEnvConfig} from '@next/env';
import {neon} from '@neondatabase/serverless';
import {createHash} from 'node:crypto';
// PRODUCTION: real deployment + its Neon DB. Only map-data endpoints are short-circuited to keep the run light.
const production=process.env.PRODUCTION_URL?.replace(/\/$/,'');
test.skip(!production,'PRODUCTION_URL을 지정한 경우에만 실제 배포 환경을 검증합니다.');
loadEnvConfig(process.cwd());
const run=Date.now().toString(36).slice(-7),user='prdu'+run,pass='prod-check-'+run+'!';
const address=(n:number)=>({id:`prod-auth-${run}-${n}`,label:`운영 인증 검증 ${n}`,address:`서울 운영 인증 검증 주소 ${n}`,source:'kakao',coordinates:{lat:37.56+n/1000,lng:126.97+n/1000}});
const A1=address(1),A2=address(2),sha=(v:string)=>createHash('sha256').update(v).digest('hex');
test.afterAll(async()=>{
  // Same Neon DB as local (verified before this run): remove only this run's synthetic account and guest rows.
  if(!process.env.DATABASE_URL)return;const sql=neon(process.env.DATABASE_URL);
  await sql`DELETE FROM np_users WHERE username=${user}`;await sql`DELETE FROM np_saved_addresses WHERE address_id LIKE ${'prod-auth-'+run+'-%'}`;
});
async function quiet(context:BrowserContext){
  await context.route('**/api/facilities?**',r=>r.fulfill({json:{source:'kakao',origin:{lat:0,lng:0},radius:500,category:new URL(r.request().url()).searchParams.get('category'),places:[],limited:false,fetchedAt:new Date().toISOString()}}));
  await context.route('**/api/transit/nearby?**',r=>r.fulfill({json:{provider:'public',origin:{lat:0,lng:0},radius:500,stations:[],fetchedAt:new Date().toISOString()}}));
}
const authCookie=async(c:BrowserContext)=>(await c.cookies()).find(x=>x.name==='__Host-np-auth');
async function login(page:Page,remember:boolean,next='/saved'){
  await page.goto(production+'/login?next='+encodeURIComponent(next));await page.getByLabel('아이디').fill(user);await page.getByLabel('비밀번호',{exact:true}).fill(pass);
  if(remember)await page.getByRole('checkbox',{name:/로그인 상태 유지/}).check();await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page).toHaveURL(production+next);await expect(page.locator('.user-menu-button')).toContainText(user);
}
test('PRODUCTION sign-up, guest import, PC→mobile address and memo sync, remember-me, logout and wrong password',async({browser},info)=>{
  test.setTimeout(180000);const errors:string[]=[];
  const pcContext=await browser.newContext({viewport:{width:1440,height:950}}),mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const c of [pcContext,mobileContext])await quiet(c);
  const pc=await pcContext.newPage(),mobile=await mobileContext.newPage();for(const p of [pc,mobile])p.on('pageerror',e=>errors.push(e.message));
  try{
    // Guest save on PC, then sign up from the header (remember OFF).
    await pc.addInitScript(({a,b})=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses:[a,b],selectedId:a.id,saved:[],compare:[],notes:{},radius:500,layers:[],facilityLayerVersion:1}));}},{a:A1,b:A2});
    await pc.goto(production+'/explore');await pc.getByRole('button',{name:'주소 저장',exact:true}).click();await expect(pc.locator('.toast')).toContainText('로그인하면');
    await pc.getByRole('link',{name:'회원가입',exact:true}).click();await pc.getByLabel('아이디').fill(user);await pc.getByRole('button',{name:'중복 확인'}).click();await expect(pc.locator('#username-help')).toContainText('사용할 수 있는');
    await pc.getByLabel('비밀번호',{exact:true}).fill(pass);await pc.getByLabel('비밀번호 확인').fill(pass);await pc.getByRole('button',{name:'가입하고 시작하기'}).click();
    await expect(pc).toHaveURL(production+'/explore');const pcCookie=(await authCookie(pcContext))!;expect(pcCookie.httpOnly&&pcCookie.secure).toBe(true);expect(pcCookie.sameSite).toBe('Lax');expect(pcCookie.expires).toBe(-1);
    const dialog=pc.getByRole('dialog',{name:'이 기기의 비회원 보관함을 가져올까요?'});await expect(dialog).toContainText('1곳');await pc.screenshot({path:info.outputPath('prod-import-1440.png')});
    await dialog.getByRole('button',{name:'계정으로 가져오기'}).click();await expect(dialog).toHaveCount(0);
    // Duplicate sign-up is rejected by the live API.
    expect((await pc.request.post(production+'/api/auth/signup',{headers:{Origin:production!},data:{username:user,password:pass}})).status()).toBe(409);
    // Save A2 + memo on PC (account box).
    await pc.evaluate(id=>{const v=JSON.parse(localStorage.getItem('neighborhood-preview-v2')!);v.selectedId=id;localStorage.setItem('neighborhood-preview-v2',JSON.stringify(v));},A2.id);
    await pc.goto(production+'/explore');await pc.getByRole('button',{name:'주소 저장',exact:true}).click();await expect(pc.locator('.toast')).toContainText('계정 보관함');
    await pc.goto(production+'/saved');const pcCard=pc.getByTestId('card-'+A2.id);await pcCard.getByLabel('나의 임장 메모').fill('운영 PC 메모');await pcCard.getByRole('button',{name:'메모 저장',exact:true}).click();await expect(pc.locator('.toast')).toContainText('계정 DB');
    // Wrong password on mobile, then remember-me login: same addresses and memo.
    await mobile.goto(production+'/login');await mobile.getByLabel('아이디').fill(user);await mobile.getByLabel('비밀번호',{exact:true}).fill('wrong-password-1');await mobile.getByRole('button',{name:'로그인',exact:true}).click();await expect(mobile.locator('.auth-error')).toContainText('올바르지 않습니다');
    await login(mobile,true);const mobileCookie=(await authCookie(mobileContext))!;expect(mobileCookie.expires-Date.now()/1000).toBeGreaterThan(29*86400);
    await expect(mobile.getByTestId('card-'+A1.id)).toBeVisible();const mobileCard=mobile.getByTestId('card-'+A2.id);await expect(mobileCard.getByLabel('나의 임장 메모')).toHaveValue('운영 PC 메모');
    await mobileCard.getByLabel('나의 임장 메모').fill('운영 모바일 수정 메모');await mobileCard.getByRole('button',{name:'메모 저장',exact:true}).click();await expect(mobile.locator('.toast')).toContainText('계정 DB');
    await mobile.locator('.user-menu-button').click();await mobile.screenshot({path:info.outputPath('prod-menu-390.png')});await mobile.keyboard.press('Escape');
    expect(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    // PC refresh shows the mobile edit.
    await pc.reload();await expect(pcCard.getByLabel('나의 임장 메모')).toHaveValue('운영 모바일 수정 메모');await pc.screenshot({path:info.outputPath('prod-saved-1440.png')});
    // Logout on PC revokes only the PC session; mobile stays signed in.
    await pc.locator('.user-menu-button').click();await pc.getByRole('menuitem',{name:'로그아웃'}).click();await expect(pc.getByRole('link',{name:'로그인',exact:true})).toBeVisible();
    await expect(pc.getByTestId('card-'+A2.id)).toHaveCount(0);expect((await (await pc.request.get(production+'/api/auth/me')).json()).user).toBeNull();
    await mobile.reload();await expect(mobile.locator('.user-menu-button')).toContainText(user);
    await mobile.locator('.user-menu-button').click();await mobile.getByRole('menuitem',{name:'로그아웃'}).click();await expect(mobile.getByRole('link',{name:'로그인',exact:true})).toBeVisible();
    await mobile.goto(production+'/login');await mobile.screenshot({path:info.outputPath('prod-login-390.png'),fullPage:true});
    expect(errors).toEqual([]);
  }finally{await pcContext.close();await mobileContext.close();}
});
