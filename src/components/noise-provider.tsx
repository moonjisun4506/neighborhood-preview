'use client';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {useApp} from './app-provider';
import {noiseRadiusMeters,fixedNoiseResult,type NoiseResult} from '@/lib/noise';
type State={key:string;status:'loading'|'success'|'error';result?:NoiseResult;error?:string};
const Context=createContext<{state:State|null;visible:boolean;setVisible:(v:boolean)=>void;focusId:string|null;focus:(id:string|null)=>void;retry:()=>void}>(null!);
export function NoiseProvider({children}:{children:ReactNode}){
  const {selected,ready}=useApp(),path=usePathname();const [value,setValue]=useState<State|null>(null),[visible,setVisible]=useState(true),[focusId,focus]=useState<string|null>(null),[attempt,setAttempt]=useState(0);
  const origin=selected?.source==='kakao'?selected.coordinates:null,key=origin?`${selected!.id}|${origin.lat}|${origin.lng}|${noiseRadiusMeters}`:'';const active=path==='/transport';
  useEffect(()=>{focus(null);if(!ready||!origin||!active)return;const abort=new AbortController();setValue({key,status:'loading'});fetch('/api/noise?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),radius:String(noiseRadiusMeters)}),{signal:abort.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'소음 조회 실패');if(!abort.signal.aborted)setValue({key,status:'success',result:fixedNoiseResult(origin,body)});}).catch(e=>{if(!abort.signal.aborted)setValue({key,status:'error',error:e instanceof Error?e.message:'소음 조회 실패'});});return()=>abort.abort();},[ready,key,active,attempt]);
  const state=useMemo(()=>key&&value?.key===key?value:null,[key,value]);
  return <Context.Provider value={{state,visible,setVisible,focusId,focus,retry:()=>setAttempt(v=>v+1)}}>{children}</Context.Provider>;
}
export const useNoise=()=>useContext(Context);
