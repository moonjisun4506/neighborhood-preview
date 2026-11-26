'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {useApp} from './app-provider';
import {isFacilityCategory,type FacilityCategory,type FacilityPlace,type FacilityResponse} from '@/lib/facilities';
type CategoryState={status:'loading'|'success'|'error';response?:FacilityResponse;error?:string};
type State={key:string;categories:Partial<Record<FacilityCategory,CategoryState>>};
const Context=createContext<{categories:State['categories'];places:FacilityPlace[];loading:boolean;enabled:FacilityCategory[];available:boolean;retry:()=>void;focusId:string|null;focus:(id:string|null)=>void}>(null!);
export function FacilitiesProvider({children}:{children:ReactNode}){
  const {data,selected,ready}=useApp();const pathname=usePathname();const [state,setState]=useState<State>({key:'',categories:{}});const [attempt,setAttempt]=useState(0);const [focusId,focus]=useState<string|null>(null);
  const cache=useRef(new Map<string,FacilityResponse>());
  const lat=selected?.source==='kakao'?selected.coordinates?.lat:undefined,lng=selected?.source==='kakao'?selected.coordinates?.lng:undefined;
  const available=lat!==undefined&&lng!==undefined;const key=available?`${selected!.id}|${lat}|${lng}|${data.radius}`:'';
  const layerKey=data.layers.filter(isFacilityCategory).sort().join(',');
  const active=pathname==='/'||pathname==='/explore';
  useEffect(()=>{
    focus(null);if(!ready||!available||!active)return;
    const controller=new AbortController();const enabled=layerKey.split(',').filter(isFacilityCategory);
    const categories:State['categories']={};const queue:FacilityCategory[]=[];
    for(const category of enabled){const cached=cache.current.get(`${key}|${category}`);if(cached)categories[category]={status:'success',response:cached};else{categories[category]={status:'loading'};queue.push(category);}}
    setState({key,categories});
    const work=async()=>{while(queue.length&&!controller.signal.aborted){const category=queue.shift()!;
      try{
        const response=await fetch('/api/facilities?'+new URLSearchParams({lat:String(lat),lng:String(lng),radius:String(data.radius),category}),{signal:controller.signal});
        const body=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(body.error||'시설 정보를 조회하지 못했습니다.');
        const result=body as FacilityResponse;
        cache.current.set(`${key}|${category}`,result);if(cache.current.size>100)cache.current.delete(cache.current.keys().next().value!);
        setState(s=>s.key===key?{key,categories:{...s.categories,[category]:{status:'success',response:result}}}:s);
      }catch(error){if(controller.signal.aborted)return;setState(s=>s.key===key?{key,categories:{...s.categories,[category]:{status:'error',error:error instanceof Error?error.message:'시설 정보를 조회하지 못했습니다.'}}}:s);}
    }};
    void Promise.all(Array.from({length:Math.min(3,queue.length)},work));
    return()=>controller.abort();
  },[ready,available,active,key,lat,lng,data.radius,layerKey,attempt]);
  const enabled=useMemo(()=>layerKey.split(',').filter(isFacilityCategory),[layerKey]);
  const categories=useMemo(()=>available&&state.key===key?state.categories:{},[available,state,key]);
  const places=useMemo(()=>enabled.flatMap(category=>categories[category]?.response?.places??[]),[enabled,categories]);
  const retry=()=>{for(const category of enabled){if(categories[category]?.status==='error'||categories[category]?.response?.warning)cache.current.delete(`${key}|${category}`);}setAttempt(v=>v+1);};
  return <Context.Provider value={{categories,places,loading:available&&enabled.some(c=>!categories[c]||categories[c]?.status==='loading'),enabled,available,retry,focusId,focus}}>{children}</Context.Provider>;
}
export const useFacilities=()=>useContext(Context);
