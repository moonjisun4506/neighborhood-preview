'use client';
import {OdsayError} from './odsay-data';
export const transitCacheTtl=24*60*60*1000;
const storageKey='np-transit-cache-v1';
type Entry={until:number;value:unknown};
type Store={entries:Record<string,Entry>;blockedUntil:number};
let store:Store|undefined;
const pending=new Map<string,Promise<unknown>>();
function state():Store{
  if(store)return store;
  store={entries:{},blockedUntil:0};
  try{const raw=JSON.parse(sessionStorage.getItem(storageKey)??'null');if(raw&&typeof raw.entries==='object'&&raw.entries&&!Array.isArray(raw.entries)&&Number.isFinite(raw.blockedUntil))store=raw;}catch{/* Storage may be unavailable. Memory caching still works. */}
  return store!;
}
function persist(){const s=state();for(const [key,entry] of Object.entries(s.entries))if(!entry||!Number.isFinite(entry.until)||entry.until<=Date.now())delete s.entries[key];const keys=Object.keys(s.entries);for(const key of keys.slice(0,Math.max(0,keys.length-64)))delete s.entries[key];try{sessionStorage.setItem(storageKey,JSON.stringify(s));}catch{/* Best effort, no credentials are stored. */}}
export function readTransitCache<T>(key:string):T|null{const entry=state().entries[key];return entry&&entry.until>Date.now()?entry.value as T:null;}
export function transitQuotaBlocked(){return state().blockedUntil>Date.now();}
export function blockTransitQuota(){state().blockedUntil=Date.now()+transitCacheTtl;persist();}
function quotaError(){return new OdsayError('QUOTA',429,'ODsay 요청 한도를 초과했습니다. 자동 재시도 없이 이 탭에서 24시간 동안 새 호출을 중단합니다. 기존 캐시 결과는 사용할 수 있습니다.');}
export async function cachedTransit<T>(key:string,load:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();const hit=readTransitCache<T>(key);if(hit!==null)return hit;
  if(transitQuotaBlocked())throw quotaError();
  let task=pending.get(key) as Promise<T>|undefined;
  if(!task){task=(async()=>{try{const value=await load();const observed=value&&typeof value==='object'&&'fetchedAt' in value&&typeof value.fetchedAt==='string'?Date.parse(value.fetchedAt):Date.now();state().entries[key]={until:Math.min(Date.now()+transitCacheTtl,(Number.isFinite(observed)?observed:Date.now())+transitCacheTtl),value};persist();return value;}catch(error){if(error instanceof OdsayError&&error.code==='QUOTA')blockTransitQuota();throw error;}finally{pending.delete(key);}})();pending.set(key,task);}
  const result=await task;signal?.throwIfAborted();return result;
}
