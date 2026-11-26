'use client';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {useApp} from './app-provider';
import type {SafetyResult} from '@/lib/safety';
import type {SafetyRaster} from '@/lib/safety-raster';
type State={key:string;status:'loading'|'done'|'error';result?:SafetyResult};
const cache=new Map<string,{until:number;data:SafetyResult}>(),pending=new Map<string,Promise<SafetyResult>>();
function query(key:string,lat:number,lng:number){const hit=cache.get(key);if(hit&&hit.until>Date.now())return Promise.resolve(hit.data);if(pending.has(key))return pending.get(key)!;const task=fetch('/api/safety?'+new URLSearchParams({lat:String(lat),lng:String(lng)})).then(async r=>{if(!r.ok)throw new Error('query');const data:SafetyResult=await r.json();if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+(data.status==='available'?60*60*1000:60000),data});return data;}).finally(()=>pending.delete(key));pending.set(key,task);return task;}
const Context=createContext<{state:State|null;visible:boolean;setVisible:(value:boolean)=>void;layerError:boolean;setLayerError:(value:boolean)=>void;raster:SafetyRaster|null;setRaster:(value:SafetyRaster|null)=>void;activate:()=>void;retry:()=>void}>(null!);
export function SafetyProvider({children}:{children:ReactNode}){
  const {selected,ready}=useApp(),path=usePathname();const origin=selected?.source==='kakao'?selected.coordinates:null,key=origin?`${selected!.id}|${origin.lat}|${origin.lng}|1000`:'';
  const [state,setState]=useState<State|null>(null),[visible,setVisible]=useState(false),[layerError,setLayerError]=useState(false),[raster,setRaster]=useState<SafetyRaster|null>(null),[requested,setRequested]=useState(false),[attempt,setAttempt]=useState(0);const active=path==='/transport';
  useEffect(()=>{setVisible(false);setLayerError(false);setRaster(null);},[key]);
  useEffect(()=>{if(!ready||!origin||!active||!requested)return;let live=true;setState({key,status:'loading'});query(key,origin.lat,origin.lng).then(result=>{if(live)setState({key,status:'done',result});}).catch(()=>{if(live)setState({key,status:'error'});});return()=>{live=false;};},[ready,key,active,requested,attempt]);
  const current=useMemo(()=>key&&state?.key===key?state:null,[key,state]);
  return <Context.Provider value={{state:current,visible,setVisible,layerError,setLayerError,raster,setRaster,activate:()=>setRequested(true),retry:()=>{cache.delete(key);setLayerError(false);setRaster(null);setAttempt(n=>n+1);}}}>{children}</Context.Provider>;
}
export const useSafety=()=>useContext(Context);
