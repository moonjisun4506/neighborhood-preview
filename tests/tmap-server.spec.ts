import {test,expect} from '@playwright/test';
import {loadEnvConfig} from '@next/env';
import {neon} from '@neondatabase/serverless';
import {createHash} from 'node:crypto';
import {tmapRoutes,peekTmapRoutes,tmapWalking} from '../src/lib/tmap.server';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
test('MOCKED upstream with real isolated DB: coalescing, durable reuse, expiry, errors and 10-call ceiling',async()=>{
 test.setTimeout(90000);loadEnvConfig(process.cwd());const originalKey=process.env.TMAP_APP_KEY,originalFetch=globalThis.fetch,fixture='tmap-unit-'+Date.now(),namespace=hash(fixture),sql=neon(process.env.DATABASE_URL!),ids:string[]=[];process.env.TMAP_APP_KEY=fixture;let calls=0,mode='ok';
 const origin={lat:37.123,lng:127.456};const dest=(i:number)=>({lat:37.2+i*.01,lng:127.5});
 const remember=(a:typeof origin,b:typeof origin,kind='transit')=>ids.push(hash(JSON.stringify([namespace,kind,a.lng,a.lat,b.lng,b.lat])));
 globalThis.fetch=async(input,init)=>{if(String(input).startsWith('https://apis.openapi.sk.com/')){calls++;await new Promise(r=>setTimeout(r,10));return Response.json(mode==='auth'?{error:{message:'invalid appKey'}}:mode==='bad'?{}:mode==='quota'?{error:{message:'Too many requests'}}:mode==='empty'?{result:{status:14}}:{metaData:{plan:{itineraries:[{totalTime:600,transferCount:0,fare:{regular:{totalFare:1550,currency:{currencyCode:'KRW'}}},legs:[{mode:'BUS',route:'검증용 가상 노선',start:{name:'모의 탑승'},end:{name:'모의 하차'}}]}]}}},{status:mode==='auth'?403:mode==='quota'?429:200});}return originalFetch(input,init);};
 try{
  remember(origin,dest(0));remember(dest(0),origin);const [a,b]=await Promise.all([tmapRoutes(origin,dest(0)),tmapRoutes(origin,dest(0))]);expect(calls).toBe(2);expect(a).toEqual(b);await tmapRoutes(origin,dest(0));expect(calls).toBe(2);expect((await peekTmapRoutes(origin,dest(0)))?.outbound.paths[0].fare).toBe(1550);
  for(const id of ids)await sql`UPDATE np_tmap_cache SET expires_at=now()-interval '1 second' WHERE id=${id}`;expect(await peekTmapRoutes(origin,dest(0))).toBeNull();
  mode='empty';remember(origin,dest(1));remember(dest(1),origin);expect((await tmapRoutes(origin,dest(1))).outbound.status).toBe('no_route');
  mode='auth';remember(origin,dest(2));await expect(tmapRoutes(origin,dest(2))).rejects.toMatchObject({code:'AUTH'});
  mode='bad';remember(origin,dest(3));await expect(tmapRoutes(origin,dest(3))).rejects.toMatchObject({code:'UPSTREAM'});
  mode='ok';for(const i of [4,5]){remember(origin,dest(i));remember(dest(i),origin);await tmapRoutes(origin,dest(i));}expect(calls).toBe(10);remember(origin,dest(6));await expect(tmapRoutes(origin,dest(6))).rejects.toMatchObject({code:'QUOTA'});expect(calls).toBe(10);
  mode='quota';remember(origin,dest(7),'walk');await expect(tmapWalking(origin,dest(7))).rejects.toMatchObject({code:'QUOTA'});const count=calls;remember(origin,dest(8),'walk');await expect(tmapWalking(origin,dest(8))).rejects.toMatchObject({code:'QUOTA'});expect(calls).toBe(count);
 }finally{globalThis.fetch=originalFetch;process.env.TMAP_APP_KEY=originalKey;for(const id of ids){await sql`DELETE FROM np_tmap_cache WHERE id=${id}`;await sql`DELETE FROM np_tmap_locks WHERE id=${id}`;}await sql`DELETE FROM np_tmap_daily WHERE namespace=${namespace}`;}
});
