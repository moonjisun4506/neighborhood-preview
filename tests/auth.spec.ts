import {test,expect,type Page,type BrowserContext,type APIRequestContext} from '@playwright/test';
import {loadEnvConfig} from '@next/env';
import {neon} from '@neondatabase/serverless';
import {createHash} from 'node:crypto';
// REAL: dev server + real Neon DB (accounts, sessions, saved rows). Only map-data APIs (facilities, stops, noise…) are mocked.
loadEnvConfig(process.cwd());
const sql=neon(process.env.DATABASE_URL!),origin='http://localhost:3000',sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const run=Date.now().toString(36).slice(-7),userA='e2ea'+run,userB='e2eb'+run,passA='first-pass-'+run,passB='second-pass-'+run;
const address=(n:number)=>({id:`auth-test-${run}-${n}`,label:`인증 검증 주소 ${n}`,address:`서울 인증 검증 주소 ${n}`,source:'kakao',coordinates:{lat:37.55+n/1000,lng:126.91+n/1000}});
const A1=address(1),A2=address(2),B1=address(3);
test.describe.configure({mode:'serial'});
test.use({actionTimeout:15000});
const limitKeys=()=>['signup-ip','login-ip','username-ip'].flatMap(k=>['::1','127.0.0.1','::ffff:127.0.0.1','local'].map(ip=>k+':'+sha('np-limit|'+ip))).concat([userA,userB,'e2e-missing-'+run].map(u=>'login-user:'+sha('np-limit|'+u)));
test.beforeAll(async()=>{await sql`DELETE FROM np_auth_limits WHERE key = ANY(${limitKeys()})`;});
test.afterAll(async()=>{
  // Only this run's synthetic accounts/rows are removed. Account rows cascade (sessions, addresses, summaries, settings, claims).
  await sql`DELETE FROM np_users WHERE username = ANY(${[userA,userB]})`;
  await sql`DELETE FROM np_saved_addresses WHERE address_id LIKE ${'auth-test-'+run+'-%'}`;
  await sql`DELETE FROM np_auth_limits WHERE key = ANY(${limitKeys()})`;
});
async function api(context:APIRequestContext,path:string,data?:unknown,method='POST'){const r=await context.fetch(path,{method,headers:{Origin:origin,'Content-Type':'application/json'},data});return {status:r.status(),body:await r.json().catch(()=>null),headers:r.headers()};}
async function quietMaps(context:BrowserContext){
  await context.route('**/api/facilities?**',r=>r.fulfill({json:{source:'kakao',origin:{lat:0,lng:0},radius:500,category:new URL(r.request().url()).searchParams.get('category'),places:[],limited:false,fetchedAt:new Date().toISOString()}}));
  await context.route('**/api/transit/nearby?**',r=>r.fulfill({json:{provider:'public',origin:{lat:0,lng:0},radius:500,stations:[],fetchedAt:new Date().toISOString()}}));
  for(const path of ['**/api/noise?**','**/api/safety?**','**/api/rent?**'])await context.route(path,r=>r.fulfill({status:503,json:{error:'테스트에서 지도 데이터는 생략합니다.'}}));
}
async function seed(page:Page,addresses:unknown[],selectedId:string){await page.addInitScript(({addresses,selectedId})=>{if(!sessionStorage.getItem('auth-seeded')){sessionStorage.setItem('auth-seeded','1');localStorage.setItem('neighborhood-preview-v2',JSON.stringify({addresses,selectedId,saved:[],compare:[],notes:{},radius:500,layers:[],facilityLayerVersion:1}));}},{addresses,selectedId});}
async function login(page:Page,username:string,password:string,remember:boolean,next='/saved'){
  await page.goto('/login?next='+encodeURIComponent(next));await page.getByLabel('아이디').fill(username);await page.getByLabel('비밀번호',{exact:true}).fill(password);
  if(remember)await page.getByRole('checkbox',{name:/로그인 상태 유지/}).check();await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page).toHaveURL(origin+next);await expect(page.locator('.user-menu-button')).toContainText(username);
}
const authCookie=async(context:BrowserContext)=>(await context.cookies()).find(c=>c.name==='np-auth');

test('REAL API: sign-up validation, duplicate block, Argon2id, login failure/lockout, CSRF, ownership and expiry',async({playwright})=>{
  const c=await playwright.request.newContext({baseURL:origin});
  expect((await api(c,'/api/auth/signup',{username:'1bad',password:'whatever-123'})).status).toBe(400);
  expect((await api(c,'/api/auth/signup',{username:userB,password:'short'})).status).toBe(400);
  expect((await api(c,'/api/auth/signup',{username:userB,password:userB+'xyz!'})).body.error).toContain('아이디를 포함');
  expect((await c.get('/api/auth/username',{params:{username:userB}})).ok()).toBe(true);
  const created=await api(c,'/api/auth/signup',{username:userB,password:passB});expect(created.status).toBe(201);
  const cookie=created.headers['set-cookie'];expect(cookie).toMatch(/HttpOnly/i);expect(cookie).toMatch(/SameSite=lax/i);expect(cookie).not.toMatch(/Max-Age/i);
  expect((await (await c.get('/api/auth/username',{params:{username:userB}})).json()).available).toBe(false);
  const other=await playwright.request.newContext({baseURL:origin});
  expect((await api(other,'/api/auth/signup',{username:userB.toUpperCase(),password:passB+'x'})).status).toBe(409);
  // DB-level uniqueness, independent of the API check.
  await expect(sql`INSERT INTO np_users(id,username,password_hash) VALUES(gen_random_uuid(),${userB},'$argon2id$v=19$dup')`).rejects.toThrow();
  const [row]=await sql`SELECT password_hash FROM np_users WHERE username=${userB}`;expect(row.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);expect(row.password_hash).not.toContain(passB);
  // CSRF: foreign Origin, missing Origin and form-encoded bodies are rejected before any credential check.
  expect((await other.post('/api/auth/login',{headers:{Origin:'https://evil.example','Content-Type':'application/json'},data:{username:userB,password:passB}})).status()).toBe(403);
  expect((await other.post('/api/auth/login',{headers:{'Content-Type':'application/json'},data:{username:userB,password:passB}})).status()).toBe(403);
  expect((await other.post('/api/auth/login',{headers:{Origin:origin},form:{username:userB,password:passB}})).status()).toBe(403);
  // Failures are generic for unknown accounts and wrong passwords.
  const unknown=await api(other,'/api/auth/login',{username:'e2e-missing-'+run,password:'nothing-here-1'}),wrong=await api(other,'/api/auth/login',{username:userB,password:'wrong-pass-1'});
  expect(unknown.status).toBe(401);expect(wrong.status).toBe(401);expect(wrong.body.error).toBe(unknown.body.error);
  for(let i=0;i<4;i++)expect((await api(other,'/api/auth/login',{username:userB,password:'wrong-pass-'+i})).status).toBe(401);
  const locked=await api(other,'/api/auth/login',{username:userB,password:passB});expect(locked.status).toBe(429);expect(locked.body.code).toBe('LOCKED');
  await sql`DELETE FROM np_auth_limits WHERE key=${'login-user:'+sha('np-limit|'+userB)}`;
  // Unauthenticated account endpoints.
  for(const path of ['/api/account/settings','/api/account/import'])expect((await other.get(path)).status()).toBe(401);
  expect((await api(other,'/api/account/import',{confirm:true})).status).toBe(401);
  // Ownership: B saves B1; a different signed-in session deleting the same id (with a forged user id) cannot touch it.
  expect((await api(c,'/api/saved',{address:B1,memo:'B 전용 메모'},'PUT')).status).toBe(200);
  const login=await api(other,'/api/auth/login',{username:userB,password:passB,remember:true});expect(login.status).toBe(200);expect(login.headers['set-cookie']).toMatch(/Max-Age=2592000/);
  const outsider=await playwright.request.newContext({baseURL:origin});expect((await (await outsider.get('/api/saved')).json()).entries.some((e:{address:{id:string}})=>e.address.id===B1.id)).toBe(false);
  expect((await api(outsider,'/api/saved',{id:B1.id,userId:'any',username:userB},'DELETE')).status).toBe(200);
  expect((await (await other.get('/api/saved')).json()).entries.map((e:{memo:string})=>e.memo)).toContain('B 전용 메모');
  // Two devices = two independent sessions.
  expect((await sql`SELECT count(*)::int AS n FROM np_user_sessions s JOIN np_users u ON u.id=s.user_id WHERE u.username=${userB}`)[0].n).toBe(2);
  // Expiry: idle limit and the 24-hour absolute limit of a non-persistent session.
  await sql`UPDATE np_user_sessions SET expires_at=now()-interval '1 minute' WHERE user_id=(SELECT id FROM np_users WHERE username=${userB}) AND persistent`;
  const expired=await other.get('/api/saved');expect(expired.status()).toBe(401);expect((await expired.json()).code).toBe('SESSION_EXPIRED');expect(expired.headers()['set-cookie']).toMatch(/Max-Age=0/);
  await sql`UPDATE np_user_sessions SET created_at=now()-interval '25 hours' WHERE user_id=(SELECT id FROM np_users WHERE username=${userB}) AND NOT persistent`;
  expect((await (await c.get('/api/auth/me')).json()).expired).toBe(true);
  // Logout deletes the server row.
  const again=await api(c,'/api/auth/login',{username:userB,password:passB});expect(again.status).toBe(200);
  expect((await api(c,'/api/auth/logout',{})).status).toBe(200);expect((await (await c.get('/api/auth/me')).json()).user).toBeNull();
  expect((await sql`SELECT count(*)::int AS n FROM np_user_sessions s JOIN np_users u ON u.id=s.user_id WHERE u.username=${userB} AND s.expires_at>now()`)[0].n).toBe(0);
  for(const x of [c,other,outsider])await x.dispose();
});

test('REAL browser + DB: guest import, PC→mobile sync, memo edits, AI summary, settings, user separation, logout and expiry',async({browser},info)=>{
  test.setTimeout(180000);
  const pcContext=await browser.newContext({viewport:{width:1440,height:950}}),mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const c of [pcContext,mobileContext])await quietMaps(c);
  const pc=await pcContext.newPage(),mobile=await mobileContext.newPage();
  // 1) Guest on PC saves A1 into this device's anonymous box.
  await seed(pc,[A1,A2],A1.id);await pc.goto('/explore');await pc.getByRole('button',{name:'주소 저장',exact:true}).click();await expect(pc.locator('.toast')).toContainText('로그인하면');
  await expect(pc.getByRole('link',{name:'로그인',exact:true})).toBeVisible();await pc.screenshot({path:info.outputPath('pc-guest.png')});
  const anonOwner=sha((await pcContext.cookies()).find(c=>c.name==='np-session')!.value);
  // 2) Sign up on PC (remember OFF) and return to the page the user was on.
  await pc.getByRole('link',{name:'회원가입',exact:true}).click();await expect(pc).toHaveURL(/\/signup\?next=%2Fexplore/);
  await pc.getByLabel('아이디').fill(userA);await pc.getByRole('button',{name:'중복 확인'}).click();await expect(pc.locator('#username-help')).toContainText('사용할 수 있는 아이디');
  await pc.getByLabel('비밀번호',{exact:true}).fill(passA);await pc.getByLabel('비밀번호 확인').fill(passA+'x');await pc.getByRole('button',{name:'가입하고 시작하기'}).click();await expect(pc.locator('.auth-error')).toContainText('일치하지 않습니다');
  await pc.getByLabel('비밀번호 확인').fill(passA);await pc.screenshot({path:info.outputPath('pc-signup.png')});await pc.getByRole('button',{name:'가입하고 시작하기'}).click();
  await expect(pc).toHaveURL(origin+'/explore');expect((await authCookie(pcContext))!.expires).toBe(-1);expect((await authCookie(pcContext))!.httpOnly).toBe(true);
  // 3) Import prompt → explicit confirmation copies A1; the anonymous original stays.
  const dialog=pc.getByRole('dialog',{name:'이 기기의 비회원 보관함을 가져올까요?'});await expect(dialog).toContainText('1곳');await pc.screenshot({path:info.outputPath('pc-import.png')});
  await dialog.getByRole('button',{name:'계정으로 가져오기'}).click();await expect(dialog).toHaveCount(0);
  expect((await sql`SELECT count(*)::int AS n FROM np_saved_addresses WHERE owner_hash=${anonOwner} AND address_id=${A1.id}`)[0].n).toBe(1);
  // 4) Save A2 with a memo on PC (account box).
  await pc.goto('/saved');await expect(pc.getByTestId('card-'+A1.id)).toContainText('계정 DB 보관함');
  await pc.evaluate(id=>{const v=JSON.parse(localStorage.getItem('neighborhood-preview-v2')!);v.selectedId=id;localStorage.setItem('neighborhood-preview-v2',JSON.stringify(v));},A2.id);
  await pc.goto('/explore');await pc.getByRole('button',{name:'주소 저장',exact:true}).click();await expect(pc.locator('.toast')).toContainText('계정 보관함');
  await pc.goto('/saved');const pcCard=pc.getByTestId('card-'+A2.id);await pcCard.getByLabel('나의 임장 메모').fill('PC에서 쓴 메모');await pcCard.getByRole('button',{name:'메모 저장',exact:true}).click();await expect(pc.locator('.toast')).toContainText('계정 DB');
  // 5) AI summary saved on PC (real save endpoint; the generation row is a synthetic fixture to avoid a paid AI call).
  const generation=crypto.randomUUID(),summary={id:generation,mode:'address',style:'cards',addressIds:[A2.id],generatedAt:new Date().toISOString(),model:'fixture',conditions:{radius:500,destination:null,days:20,roundTrip:true,month:'202610',type:'sh',min:0,max:null},sections:[{key:'overview',title:'한눈에 보는 동네',items:[{evidenceId:'e1',text:'동기화 검증용 요약 문장',source:'주소 카드 · fixture'}]}],evidence:[{id:'e1',section:'overview',text:'동기화 검증용 요약 문장',source:'주소 카드 · fixture'}]};
  await sql`INSERT INTO np_ai_generations(id,owner_hash,address_ids,result) VALUES(${generation}::uuid,${anonOwner},${JSON.stringify([A2.id])}::jsonb,${JSON.stringify(summary)}::jsonb)`;
  expect((await pc.request.post('/api/ai/summary/save',{headers:{Origin:origin},data:{id:generation,addressId:A2.id}})).status()).toBe(200);
  // 6) Settings: commute days and comparison follow the account.
  expect((await pc.request.put('/api/account/settings',{headers:{Origin:origin},data:{settings:{destinationLocation:null,commuteDays:17,commuteRoundTrip:true,compare:[A1.id,A2.id],radius:1000}}})).status()).toBe(200);
  // 7) Mobile: independent session with "remember" ON sees the same box, memo and AI summary.
  await login(mobile,userA,passA,true);const cookie=(await authCookie(mobileContext))!;expect(cookie.expires-Date.now()/1000).toBeGreaterThan(29*86400);
  const mobileCard=mobile.getByTestId('card-'+A2.id);await expect(mobile.getByTestId('card-'+A1.id)).toBeVisible();await expect(mobileCard.getByLabel('나의 임장 메모')).toHaveValue('PC에서 쓴 메모');
  await mobileCard.locator('.saved-ai-summary>summary').click();await expect(mobileCard).toContainText('동기화 검증용 요약 문장');
  expect((await (await mobile.request.get('/api/account/settings')).json()).settings.settings).toMatchObject({commuteDays:17,radius:1000,compare:[A1.id,A2.id]});
  await mobile.goto('/compare');await expect(mobile.locator('body')).toContainText(A1.label);
  await mobile.goto('/saved');await mobileCard.getByLabel('나의 임장 메모').fill('모바일에서 수정한 메모');await mobileCard.getByRole('button',{name:'메모 저장',exact:true}).click();await expect(mobile.locator('.toast')).toContainText('계정 DB');
  await mobile.locator('.user-menu-button').click();await mobile.screenshot({path:info.outputPath('mobile-user-menu.png')});await mobile.keyboard.press('Escape');
  expect(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  // 8) PC refresh shows the mobile edit; account memos are not written into localStorage.
  await pc.reload();await expect(pcCard.getByLabel('나의 임장 메모')).toHaveValue('모바일에서 수정한 메모');
  expect(await pc.evaluate(()=>localStorage.getItem('neighborhood-preview-v2'))).not.toContain('모바일에서 수정한 메모');
  // 9) User separation: B on the PC device sees none of A's data and cannot import A's claimed guest box.
  await pc.locator('.user-menu-button').click();await pc.getByRole('menuitem',{name:'로그아웃'}).click();await expect(pc.getByRole('link',{name:'로그인',exact:true})).toBeVisible();
  await expect(pc.getByTestId('card-'+A2.id)).toHaveCount(0);expect(await pc.evaluate(()=>localStorage.getItem('neighborhood-preview-v2'))).not.toContain(A2.id);
  await expect(pc.getByTestId('card-'+A1.id)).toBeVisible();// the guest original on this device is still there
  expect((await pc.request.post('/api/auth/login',{headers:{Origin:origin},data:{username:userB,password:passB}})).status()).toBe(200);
  await pc.goto('/saved');await expect(pc.locator('.user-menu-button')).toContainText(userB);await expect(pc.getByTestId('card-'+A2.id)).toHaveCount(0);await expect(pc.getByTestId('card-'+A1.id)).toHaveCount(0);
  await expect(pc.getByRole('dialog',{name:/비회원 보관함/})).toHaveCount(0);
  expect((await (await pc.request.get('/api/account/import')).json()).status).toBe('claimed');
  expect((await pc.request.post('/api/account/import',{headers:{Origin:origin},data:{confirm:true}})).status()).toBe(409);
  // 10) Mobile session expiry → notice and guest view; logout from the menu revokes the session.
  await sql`UPDATE np_user_sessions SET expires_at=now()-interval '1 minute' WHERE user_id=(SELECT id FROM np_users WHERE username=${userA})`;
  await mobile.reload();await expect(mobile.getByRole('alert').filter({hasText:'로그인이 만료되었습니다'})).toBeVisible();await expect(mobile.getByRole('link',{name:'로그인',exact:true})).toBeVisible();await expect(mobile.getByTestId('card-'+A2.id)).toHaveCount(0);
  await mobile.screenshot({path:info.outputPath('mobile-expired.png')});
  await login(mobile,userA,passA,false,'/compare');await mobile.locator('.user-menu-button').click();await mobile.getByRole('menuitem',{name:'로그아웃'}).click();await expect(mobile.getByRole('link',{name:'로그인',exact:true})).toBeVisible();
  expect((await (await mobile.request.get('/api/auth/me')).json()).user).toBeNull();
  await mobile.goto('/login');await mobile.screenshot({path:info.outputPath('mobile-login.png'),fullPage:true});await pc.goto('/login');await pc.screenshot({path:info.outputPath('pc-login.png')});
  await pcContext.close();await mobileContext.close();
});
