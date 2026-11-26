import {neon} from '@neondatabase/serverless';
import {createHash,randomBytes} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
import type {AddressRecord} from './demo-data';
export const sessionCookie=process.env.NODE_ENV==='production'?'__Host-np-session':'np-session';
const db=()=>{if(!process.env.DATABASE_URL)throw new Error('DB configuration');return neon(process.env.DATABASE_URL);};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function owner(request:NextRequest,create=false){
  const token=request.cookies.get(sessionCookie)?.value;const sql=db();
  if(token&&/^[a-f0-9]{64}$/.test(token)){const rows=await sql`SELECT token_hash FROM np_anonymous_sessions WHERE token_hash=${hash(token)} AND expires_at>now()`;if(rows.length)return {id:hash(token),token:null};}
  if(!create)return null;const fresh=randomBytes(32).toString('hex'),id=hash(fresh);
  await sql`INSERT INTO np_anonymous_sessions(token_hash) VALUES(${id})`;return {id,token:fresh};
}
export function savedResponse(body:unknown,status=200,token?:string|null){const response=NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});if(token)response.cookies.set(sessionCookie,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:30*86400});return response;}
export function validAddress(value:unknown):value is AddressRecord{
  if(!value||typeof value!=='object')return false;const a=value as AddressRecord;
  return typeof a.id==='string'&&a.id.length>0&&a.id.length<=200&&typeof a.label==='string'&&a.label.length>0&&a.label.length<=200&&typeof a.address==='string'&&a.address.length>0&&a.address.length<=500&&['kakao','manual','legacy','demo'].includes(a.source)&&(a.coordinates===null||(Number.isFinite(a.coordinates?.lat)&&Number.isFinite(a.coordinates?.lng)&&Math.abs(a.coordinates!.lat)<=90&&Math.abs(a.coordinates!.lng)<=180));
}
export function cleanAddress(a:AddressRecord):AddressRecord{return {id:a.id,label:a.label,address:a.address,source:a.source,coordinates:a.coordinates?{lat:a.coordinates.lat,lng:a.coordinates.lng}:null,...(typeof a.roadAddress==='string'?{roadAddress:a.roadAddress.slice(0,500)}:{}),...(typeof a.jibunAddress==='string'?{jibunAddress:a.jibunAddress.slice(0,500)}:{})};}
export async function listSaved(id:string){await db()`DELETE FROM np_address_summaries WHERE owner_hash=${id} AND content ? 'expiresAt' AND (content->>'expiresAt')::timestamptz<=now()`;await db()`UPDATE np_ai_generations SET result=NULL WHERE owner_hash=${id} AND expires_at<=now() AND result ? 'expiresAt'`;return db()`SELECT a.address, a.memo, a.created_at, s.content AS ai_summary FROM np_saved_addresses a LEFT JOIN np_address_summaries s ON s.owner_hash=a.owner_hash AND s.address_id=a.address_id WHERE a.owner_hash=${id} ORDER BY a.created_at,a.address_id`;}
export async function putSaved(id:string,address:AddressRecord,memo:string){await db()`INSERT INTO np_saved_addresses(owner_hash,address_id,address,memo) VALUES(${id},${address.id},${JSON.stringify(cleanAddress(address))}::jsonb,${memo}) ON CONFLICT(owner_hash,address_id) DO UPDATE SET address=EXCLUDED.address,memo=EXCLUDED.memo,updated_at=now()`;}
export async function deleteSaved(id:string,addressId:string){await db()`DELETE FROM np_saved_addresses WHERE owner_hash=${id} AND address_id=${addressId}`;}
