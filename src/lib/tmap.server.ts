import {neon} from '@neondatabase/serverless';
import {createHash,randomUUID} from 'node:crypto';
import type {Coordinates} from './demo-data';
import type {TransitDirection,TransitRoutes} from './transit';
import {TmapError,tmapDirection,tmapWalk,tmapTtl,type WalkingRoute} from './tmap';
type Kind='transit'|'walk';type Cached<T>={value:T;fetchedAt:string;expiresAt:string};
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const db=()=>{if(!process.env.DATABASE_URL)throw new TmapError('CONFIG',503,'TMAP 호출량 보호용 DB 설정이 필요합니다.');return neon(process.env.DATABASE_URL);};
function namespace(){const key=process.env.TMAP_APP_KEY?.trim();if(!key)throw new TmapError('CONFIG',503,'서버의 TMAP_APP_KEY 설정이 필요합니다.');return hash(key);}
function id(kind:Kind,start:Coordinates,end:Coordinates){return hash(JSON.stringify([namespace(),kind,start.lng,start.lat,end.lng,end.lat]));}
export async function peekTmap<T>(kind:Kind,start:Coordinates,end:Coordinates):Promise<Cached<T>|null>{const rows=await db()`SELECT content FROM np_tmap_cache WHERE id=${id(kind,start,end)} AND expires_at>now()`;return rows[0]?.content as Cached<T>??null;}
const pending=new Map<string,Promise<Cached<unknown>>>();
async function cached<T>(kind:Kind,start:Coordinates,end:Coordinates):Promise<Cached<T>>{
  const cacheId=id(kind,start,end),existing=pending.get(cacheId);if(existing)return existing as Promise<Cached<T>>;
  const task=(async()=>{const sql=db();await sql`DELETE FROM np_tmap_cache WHERE expires_at<=now()`;const hit=await peekTmap<T>(kind,start,end);if(hit)return hit;
    const token=randomUUID(),lock=await sql`INSERT INTO np_tmap_locks(id,until_at,token) VALUES(${cacheId},now()+interval '45 seconds',${token}) ON CONFLICT(id) DO UPDATE SET until_at=EXCLUDED.until_at,token=EXCLUDED.token WHERE np_tmap_locks.until_at<=now() RETURNING id`;
    if(!lock.length)throw new TmapError('BUSY',409,'같은 경로를 조회 중입니다. 자동으로 중복 호출하지 않습니다. 잠시 후 다시 확인해 주세요.');
    try{const second=await peekTmap<T>(kind,start,end);if(second)return second;
      const limit=kind==='transit'?10:1000,ns=namespace();
      const reservation=await sql`INSERT INTO np_tmap_daily(namespace,day,kind,used) VALUES(${ns},(now() AT TIME ZONE 'Asia/Seoul')::date,${kind},1) ON CONFLICT(namespace,day,kind) DO UPDATE SET used=np_tmap_daily.used+1 WHERE np_tmap_daily.used<${limit} AND NOT np_tmap_daily.blocked RETURNING used`;
      if(!reservation.length)throw new TmapError('QUOTA',429,'TMAP 일일 무료 호출 한도에 도달했습니다. 자동 재시도하지 않습니다. 기존 유효 캐시만 사용할 수 있습니다.');
      let response:Response;try{response=await fetch(kind==='transit'?'https://apis.openapi.sk.com/transit/routes':'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1',{method:'POST',headers:{appKey:process.env.TMAP_APP_KEY!.trim(),accept:'application/json','Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000),body:JSON.stringify({startX:String(start.lng),startY:String(start.lat),endX:String(end.lng),endY:String(end.lat),...(kind==='transit'?{count:1,lang:0,format:'json'}:{startName:encodeURIComponent('출발지'),endName:encodeURIComponent('도착지'),reqCoordType:'WGS84GEO',resCoordType:'WGS84GEO'})})});}catch{throw new TmapError('NETWORK',502,'TMAP 연결이 지연되거나 실패했습니다. 자동 재시도하지 않습니다.');}
      let body;try{body=await response.json();}catch{throw new TmapError('UPSTREAM',502,'TMAP 응답을 읽지 못했습니다.');}
      const raw=String(body?.error?.message??body?.result?.message??''),code=String(body?.error?.code??body?.error?.id??body?.result?.status??'');
      if(response.status===429||/quota|limit.*exceed|too many requests|한도|초과/i.test(raw)){
        await sql`UPDATE np_tmap_daily SET blocked=true WHERE namespace=${ns} AND day=(now() AT TIME ZONE 'Asia/Seoul')::date AND kind=${kind}`;throw new TmapError('QUOTA',429,'TMAP 제공사 호출 한도를 초과했습니다. 자동 재시도하지 않습니다.');}
      if(response.status===401||response.status===403||body?.error&&/app.?key|auth|인증|권한/i.test(raw))throw new TmapError('AUTH',503,'TMAP 인증 또는 상품 이용 권한을 확인해 주세요. TMAP과 TMAP 대중교통 상품 및 앱 연결이 필요합니다.');
      if(!response.ok||body?.error||code&&!['0','11','12','13','14'].includes(code))throw new TmapError('UPSTREAM',502,'TMAP 제공사가 경로 요청을 처리하지 못했습니다.');
      const fetchedAt=new Date().toISOString(),expiresAt=new Date(Date.parse(fetchedAt)+tmapTtl).toISOString();let value:unknown=kind==='transit'?tmapDirection(body):tmapWalk(body,fetchedAt);
      if(kind==='transit'&&(value as TransitDirection).status==='ok'&&!(value as TransitDirection).paths.length)throw new TmapError('UNSUPPORTED',502,'조회 경로에 현재 화면이 지원하지 않는 이동수단이 포함되어 있습니다.');
      const result={value:value as T,fetchedAt,expiresAt};await sql`INSERT INTO np_tmap_cache(id,content,expires_at) VALUES(${cacheId},${JSON.stringify(result)}::jsonb,${expiresAt}) ON CONFLICT(id) DO UPDATE SET content=EXCLUDED.content,expires_at=EXCLUDED.expires_at`;return result;
    }finally{await sql`DELETE FROM np_tmap_locks WHERE id=${cacheId} AND token=${token}`;}
  })().catch(error=>{if(error instanceof TmapError)throw error;throw new TmapError('STORAGE',503,'TMAP 호출 보호 저장소를 확인하지 못해 새 요청을 중단했습니다.');}).finally(()=>pending.delete(cacheId));pending.set(cacheId,task);return task;
}
export async function tmapRoutes(origin:Coordinates,destination:Coordinates):Promise<TransitRoutes>{
  const outbound=await cached<TransitDirection>('transit',origin,destination);let inbound:Cached<TransitDirection>;
  try{inbound=await cached<TransitDirection>('transit',destination,origin);}catch(error){inbound={value:{status:'error',paths:[],code:error instanceof TmapError?error.code:'UPSTREAM',message:error instanceof Error?error.message:'귀가 경로 조회 실패'},fetchedAt:outbound.fetchedAt,expiresAt:outbound.expiresAt};}
  return {provider:'tmap',origin,destination,outbound:outbound.value,inbound:inbound.value,fetchedAt:[outbound.fetchedAt,inbound.fetchedAt].sort()[0],expiresAt:[outbound.expiresAt,inbound.expiresAt].sort()[0]};
}
export async function peekTmapRoutes(origin:Coordinates,destination:Coordinates):Promise<TransitRoutes|null>{const out=await peekTmap<TransitDirection>('transit',origin,destination),back=await peekTmap<TransitDirection>('transit',destination,origin);if(!out)return null;return {provider:'tmap',origin,destination,outbound:out.value,inbound:back?.value??{status:'error',paths:[],message:'귀가 경로 미조회'},fetchedAt:[out.fetchedAt,back?.fetchedAt??out.fetchedAt].sort()[0],expiresAt:[out.expiresAt,back?.expiresAt??out.expiresAt].sort()[0]};}
export const tmapWalking=(origin:Coordinates,destination:Coordinates)=>cached<WalkingRoute>('walk',origin,destination).then(r=>r.value);
