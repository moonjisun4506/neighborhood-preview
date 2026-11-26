'use client';
import type {Coordinates} from './demo-data';
import type {TransitNearby} from './transit';
const storage='np-public-stations-v1',pending=new Map<string,Promise<TransitNearby>>(),refresh=new Set<string>();
type Entry={until:number;data:TransitNearby};let cache:Record<string,Entry>|undefined;
const key=(origin:Coordinates,radius:number)=>JSON.stringify([origin.lat,origin.lng,radius]);
function entries(){if(!cache){try{cache=JSON.parse(sessionStorage.getItem(storage)??'{}');}catch{}if(!cache||typeof cache!=='object'||Array.isArray(cache))cache={};}for(const [id,item] of Object.entries(cache))if(!item||item.until<=Date.now())delete cache[id];return cache;}
function persist(){const data=entries(),keys=Object.keys(data);for(const id of keys.slice(0,Math.max(0,keys.length-64)))delete data[id];try{sessionStorage.setItem(storage,JSON.stringify(data));}catch{}}
export function clearPublicNearby(origin:Coordinates,radius:number){const id=key(origin,radius);delete entries()[id];refresh.add(id);persist();}
export async function fetchPublicNearby(origin:Coordinates,radius:number,signal:AbortSignal):Promise<TransitNearby>{signal.throwIfAborted();const id=key(origin,radius),hit=entries()[id];if(hit)return hit.data;let task=pending.get(id);if(!task){const force=refresh.delete(id);task=(async()=>{const response=await fetch('/api/transit/nearby?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),radius:String(radius),...(force?{refresh:'1'}:{})}),{signal:AbortSignal.timeout(25000)});const data=await response.json();if(!response.ok)throw new Error(data.error??'주변 정류장 조회 실패');entries()[id]={until:Date.now()+60000,data};persist();return data as TransitNearby;})().finally(()=>pending.delete(id));pending.set(id,task);}const value=await task;signal.throwIfAborted();return value;}
