'use client';
import type {Coordinates} from './demo-data';
import type {TransitRoutes} from './transit';
import {TmapError,tmapFresh,type WalkingRoute} from './tmap';
type Value=(TransitRoutes|WalkingRoute)&{expiresAt:string};
const storage='np-tmap-cache-v1',pending=new Map<string,Promise<Value>>();let memory:Record<string,Value>|undefined;
// In-memory only: failures are shown as "도보 정보 확인 불가" until the user selects the place again.
const failures=new Set<string>(),peeked=new Set<string>(),listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
function load(){if(!memory){try{memory=JSON.parse(sessionStorage.getItem(storage)??'{}');}catch{}if(!memory||typeof memory!=='object'||Array.isArray(memory))memory={};}return memory;}
function entries(){const values=load();for(const [key,value] of Object.entries(values))if(!tmapFresh(value))delete values[key];try{sessionStorage.setItem(storage,JSON.stringify(values));}catch{}return values;}
function store(id:string,value:Value){const values=entries();values[id]=value;const keys=Object.keys(values);for(const old of keys.slice(0,Math.max(0,keys.length-64)))delete values[old];try{sessionStorage.setItem(storage,JSON.stringify(values));}catch{}}
const key=(kind:string,origin:Coordinates,destination:Coordinates)=>JSON.stringify([kind,origin.lat,origin.lng,destination.lat,destination.lng]);
export function cachedTmapRoutes(origin:Coordinates,destination:Coordinates){return entries()[key('transit',origin,destination)] as TransitRoutes|undefined??null;}
async function query<T extends Value>(kind:'transit'|'walk',origin:Coordinates,destination:Coordinates,signal?:AbortSignal):Promise<T>{signal?.throwIfAborted();const id=key(kind,origin,destination),hit=entries()[id];if(hit)return hit as T;let task=pending.get(id);if(!task){task=(async()=>{const response=await fetch('/api/tmap/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin,destination}),signal:AbortSignal.timeout(55000)});let body;try{body=await response.json();}catch{throw new TmapError('NETWORK',502,'경로 응답을 읽지 못했습니다. 자동 재시도하지 않습니다.');}if(!response.ok)throw new TmapError(body.code??'UPSTREAM',response.status,body.error??'TMAP 경로 조회 실패');if(!tmapFresh(body))throw new TmapError('EXPIRED',502,'경로 자료의 유효기간이 만료되었습니다.');if(kind!=='transit'||(body.outbound?.status!=='error'&&body.inbound?.status!=='error'))store(id,body);failures.delete(id);return body as Value;})().catch(error=>{failures.add(id);throw error;}).finally(()=>{pending.delete(id);emit();});pending.set(id,task);failures.delete(id);emit();}const result=await task;signal?.throwIfAborted();return result as T;}
export const fetchTmapRoutes=(origin:Coordinates,destination:Coordinates,signal?:AbortSignal)=>query<TransitRoutes&{expiresAt:string}>('transit',origin,destination,signal);
export const fetchTmapWalking=(origin:Coordinates,destination:Coordinates,signal?:AbortSignal)=>query<WalkingRoute>('walk',origin,destination,signal);

export type WalkingStatus={state:'idle'|'loading'|'unavailable'}|{state:'ok';route:WalkingRoute&{distanceMeters:number;seconds:number}};
export function subscribeTmap(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
/** Reads the pedestrian cache without calling TMAP. "idle" means it was never looked up. */
export function walkingStatus(origin:Coordinates,destination:Coordinates):WalkingStatus{
  const id=key('walk',origin,destination),hit=load()[id] as WalkingRoute|undefined;
  if(hit&&tmapFresh(hit))return hit.status==='ok'&&hit.distanceMeters!==null&&hit.seconds!==null?{state:'ok',route:hit as WalkingRoute&{distanceMeters:number;seconds:number}}:{state:'unavailable'};
  return pending.has(id)?{state:'loading'}:failures.has(id)?{state:'unavailable'}:{state:'idle'};
}
/** Copies still-valid server cache rows (DB, max 23h) into this tab. It never calls TMAP. */
export async function peekTmapWalking(origin:Coordinates,destinations:Coordinates[]){
  const wanted=destinations.filter(d=>{const id=key('walk',origin,d);return !peeked.has(id)&&!pending.has(id)&&walkingStatus(origin,d).state==='idle';}).slice(0,40);
  if(!wanted.length)return;wanted.forEach(d=>peeked.add(key('walk',origin,d)));
  try{
    const response=await fetch('/api/walking/cached',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin,destinations:wanted}),signal:AbortSignal.timeout(15000)});if(!response.ok)return;
    const body=await response.json() as {results?:unknown[]};let changed=false;
    wanted.forEach((destination,index)=>{const value=body.results?.[index] as WalkingRoute|null|undefined,id=key('walk',origin,destination);if(value&&value.provider==='tmap'&&tmapFresh(value)&&!load()[id]){store(id,value);changed=true;}});
    if(changed)emit();
  }catch{/* Cache lookup is optional; selecting the place still queries TMAP. */}
}
