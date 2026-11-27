import {neon} from '@neondatabase/serverless';
import {hash as argonHash,verify as argonVerify} from '@node-rs/argon2';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';

const production=process.env.NODE_ENV==='production';
// __Host- prefix: Secure, Path=/, no Domain — the browser refuses to let subdomains overwrite it.
export const authCookie=production?'__Host-np-auth':'np-auth';
/**
 * Session policy
 * - "로그인 상태 유지" ON: persistent cookie, 30-day sliding expiry, absolute limit 90 days.
 * - OFF: browser-session cookie (no Max-Age), server idle limit 12 hours, absolute limit 24 hours.
 * A new random token is issued on every login; logout deletes the server row.
 */
export const sessionPolicy={rememberDays:30,rememberAbsoluteDays:90,sessionIdleHours:12,sessionAbsoluteHours:24} as const;
// OWASP-recommended Argon2id parameters: 19 MiB memory, 2 iterations, 1 lane. algorithm 2 = Argon2id.
const argonOptions={algorithm:2,memoryCost:19456,timeCost:2,parallelism:1,outputLen:32} as const;

const db=()=>{if(!process.env.DATABASE_URL)throw new Error('DB configuration');return neon(process.env.DATABASE_URL);};
const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');
export type AuthUser={id:string;username:string};
export type AuthState={user:AuthUser;persistent:boolean;tokenHash:string;expiresAt:string}|{user:null;expired:boolean};

export function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});}
/** CSRF defence for state-changing requests: same Origin, not cross-site, JSON body only. */
export function sameSiteRequest(request:NextRequest,requireJson=true){
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return false;
  return !requireJson||(request.headers.get('content-type')??'').toLowerCase().startsWith('application/json');
}
export async function readJson(request:NextRequest,limit=4000):Promise<Record<string,unknown>|null>{
  const text=await request.text();if(text.length>limit)return null;try{const value=JSON.parse(text);return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}
}

export const hashPassword=(password:string)=>argonHash(password,argonOptions);
let dummy:Promise<string>|undefined;
/** Verifies against a dummy hash when the user does not exist so response time does not reveal accounts. */
export async function verifyPassword(stored:string|null,password:string){
  const target=stored??await (dummy??=argonHash(randomBytes(16).toString('hex'),argonOptions));
  try{const ok=await argonVerify(target,password);return stored!==null&&ok;}catch{return false;}
}

// --- Rate limiting (DB-backed so it works across serverless instances) ---
function clientAddress(request:NextRequest){return (request.headers.get('x-real-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]??'local').trim().slice(0,100)||'local';}
export const limitKey=(kind:string,value:string)=>kind+':'+sha256('np-limit|'+value);
export const ipKey=(kind:string,request:NextRequest)=>limitKey(kind,clientAddress(request));
/** Counts one event in a fixed window. Returns seconds to wait when the limit is exceeded. */
export async function hitLimit(key:string,limit:number,windowSeconds:number){
  const rows=await db()`INSERT INTO np_auth_limits(key,count,window_start) VALUES(${key},1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN np_auth_limits.window_start<=now()-make_interval(secs=>${windowSeconds}) THEN 1 ELSE np_auth_limits.count+1 END,window_start=CASE WHEN np_auth_limits.window_start<=now()-make_interval(secs=>${windowSeconds}) THEN now() ELSE np_auth_limits.window_start END RETURNING count,ceil(extract(epoch FROM window_start+make_interval(secs=>${windowSeconds})-now()))::int AS wait`;
  return rows[0].count>limit?Math.max(1,rows[0].wait):0;
}
export async function limitWait(key:string,limit:number,windowSeconds:number){
  const rows=await db()`SELECT ceil(extract(epoch FROM window_start+make_interval(secs=>${windowSeconds})-now()))::int AS wait FROM np_auth_limits WHERE key=${key} AND count>=${limit} AND window_start>now()-make_interval(secs=>${windowSeconds})`;
  return rows.length?Math.max(1,rows[0].wait):0;
}
export async function clearLimit(key:string){await db()`DELETE FROM np_auth_limits WHERE key=${key}`;}

// --- Users ---
export async function createUser(username:string,password:string):Promise<AuthUser|null>{
  const id=randomUUID(),passwordHash=await hashPassword(password);
  // UNIQUE index enforces one account per username even under concurrent sign-ups.
  const rows=await db()`INSERT INTO np_users(id,username,password_hash) VALUES(${id}::uuid,${username},${passwordHash}) ON CONFLICT(username) DO NOTHING RETURNING id::text,username`;
  return rows[0] as AuthUser|undefined??null;
}
export async function usernameTaken(username:string){return (await db()`SELECT 1 FROM np_users WHERE username=${username}`).length>0;}
export async function findCredentials(username:string){const rows=await db()`SELECT id::text,username,password_hash FROM np_users WHERE username=${username}`;return rows[0] as (AuthUser&{password_hash:string})|undefined;}

// --- Sessions ---
function expiry(persistent:boolean){return new Date(Date.now()+(persistent?sessionPolicy.rememberDays*86400000:sessionPolicy.sessionIdleHours*3600000)).toISOString();}
export async function createSession(userId:string,persistent:boolean){
  const token=randomBytes(32).toString('base64url');
  await db()`INSERT INTO np_user_sessions(token_hash,user_id,persistent,expires_at) VALUES(${sha256(token)},${userId}::uuid,${persistent},${expiry(persistent)}::timestamptz)`;
  return token;
}
export function setSessionCookie(response:NextResponse,token:string,persistent:boolean){
  response.cookies.set(authCookie,token,{httpOnly:true,secure:production,sameSite:'lax',path:'/',...(persistent?{maxAge:sessionPolicy.rememberDays*86400}:{})});return response;
}
export function clearSessionCookie(response:NextResponse){response.cookies.set(authCookie,'',{httpOnly:true,secure:production,sameSite:'lax',path:'/',maxAge:0});return response;}
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
/** Server-side session check. The user id always comes from the session row, never from the request. */
export async function getAuth(request:NextRequest):Promise<AuthState>{
  const token=request.cookies.get(authCookie)?.value;if(!token)return {user:null,expired:false};
  if(!tokenPattern.test(token))return {user:null,expired:true};
  const tokenHash=sha256(token);
  // Sliding renewal when less than half of the window remains, never past the absolute limit.
  const rows=await db()`UPDATE np_user_sessions s SET last_used_at=now(),expires_at=CASE WHEN s.expires_at-now()<(CASE WHEN s.persistent THEN make_interval(days=>${sessionPolicy.rememberDays/2}) ELSE make_interval(hours=>${sessionPolicy.sessionIdleHours/2}) END) THEN LEAST(now()+(CASE WHEN s.persistent THEN make_interval(days=>${sessionPolicy.rememberDays}) ELSE make_interval(hours=>${sessionPolicy.sessionIdleHours}) END),s.created_at+(CASE WHEN s.persistent THEN make_interval(days=>${sessionPolicy.rememberAbsoluteDays}) ELSE make_interval(hours=>${sessionPolicy.sessionAbsoluteHours}) END)) ELSE s.expires_at END FROM np_users u WHERE s.token_hash=${tokenHash} AND u.id=s.user_id AND s.expires_at>now() AND s.created_at>now()-(CASE WHEN s.persistent THEN make_interval(days=>${sessionPolicy.rememberAbsoluteDays}) ELSE make_interval(hours=>${sessionPolicy.sessionAbsoluteHours}) END) RETURNING u.id::text AS id,u.username,s.persistent,s.expires_at`;
  // An expired or over-age session is deleted as soon as it is presented.
  if(!rows.length){await db()`DELETE FROM np_user_sessions WHERE token_hash=${tokenHash}`;return {user:null,expired:true};}
  const row=rows[0];return {user:{id:row.id,username:row.username},persistent:row.persistent,tokenHash,expiresAt:new Date(row.expires_at).toISOString()};
}
export async function deleteSessionToken(token:string|undefined){if(token&&tokenPattern.test(token))await db()`DELETE FROM np_user_sessions WHERE token_hash=${sha256(token)}`;}
/** 401 for an expired/invalid login cookie; clears it so the browser does not keep sending it. */
export function expiredResponse(){return clearSessionCookie(json({code:'SESSION_EXPIRED',error:'로그인이 만료되었습니다. 다시 로그인해 주세요.'},401));}
