'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {useApp} from './app-provider';
import type {TransitStation,TransitNearby,TransitRoutes} from '@/lib/transit';
import {fetchTransitNearby,fetchTransitRoutes,cachedTransitRoutes,clearTransitNearby} from '@/lib/transit-client';
import {OdsayError} from '@/lib/odsay-data';
import {TmapError} from '@/lib/tmap';
type NearbyState={key:string;status:'loading'|'success'|'error';data?:TransitNearby;error?:string;code?:string};
type RouteState={key:string;status:'loading'|'success'|'error';data?:TransitRoutes;error?:string;code?:string};
const Context=createContext<{nearby:NearbyState|null;stations:TransitStation[];showBus:boolean;showSubway:boolean;setShowBus:(v:boolean)=>void;setShowSubway:(v:boolean)=>void;retryNearby:()=>void;focusStationId:string|null;focusStation:(id:string|null)=>void;routes:RouteState|null;queryRoutes:()=>void;canRoute:boolean}>(null!);
export function TransitProvider({children}:{children:ReactNode}){
  const {data,selected,ready}=useApp();const pathname=usePathname();const [nearbyState,setNearbyState]=useState<NearbyState|null>(null);const [attempt,setAttempt]=useState(0);const [showBus,setShowBus]=useState(true);const [showSubway,setShowSubway]=useState(true);const [focusStationId,focusStation]=useState<string|null>(null);
  const [routeState,setRouteState]=useState<RouteState|null>(null);const routeController=useRef<AbortController|null>(null);
  const origin=selected?.source==='kakao'?selected.coordinates:null;const destination=data.destinationLocation?.source==='kakao'?data.destinationLocation.coordinates:null;
  const originKey=origin?`${selected!.id}|${origin.lat}|${origin.lng}|${data.radius}`:'';
  const routeKey=origin&&destination?`${selected!.id}|${origin.lat}|${origin.lng}|${data.destinationLocation!.id}|${destination.lat}|${destination.lng}`:'';
  const active=pathname==='/'||pathname==='/explore';
  useEffect(()=>{
    focusStation(null);if(!ready||!origin||!active)return;
    const controller=new AbortController();setNearbyState({key:originKey,status:'loading'});
    fetchTransitNearby(origin,data.radius,controller.signal).then(result=>{if(!controller.signal.aborted)setNearbyState({key:originKey,status:'success',data:result});})
      .catch(error=>{if(!controller.signal.aborted)setNearbyState({key:originKey,status:'error',error:error instanceof Error?error.message:'정류장을 조회하지 못했습니다.',code:error instanceof OdsayError?error.code:undefined});});
    return()=>controller.abort();
  },[ready,originKey,origin?.lat,origin?.lng,data.radius,active,attempt]);
  useEffect(()=>{routeController.current?.abort();if(!origin||!destination){setRouteState(null);return;}const hit=cachedTransitRoutes(origin,destination);setRouteState(hit?{key:routeKey,status:'success',data:hit}:null);},[routeKey]);useEffect(()=>()=>routeController.current?.abort(),[]);
  useEffect(()=>{const expires=routeState?.data?.expiresAt;if(!expires)return;const timer=setTimeout(()=>setRouteState(null),Math.max(0,Date.parse(expires)-Date.now()));return()=>clearTimeout(timer);},[routeState]);
  const queryRoutes=()=>{
    if(!origin||!destination)return;routeController.current?.abort();const controller=new AbortController();routeController.current=controller;setRouteState({key:routeKey,status:'loading'});
    fetchTransitRoutes(origin,destination,controller.signal).then(result=>{if(!controller.signal.aborted)setRouteState({key:routeKey,status:'success',data:result});})
      .catch(error=>{if(!controller.signal.aborted)setRouteState({key:routeKey,status:'error',error:error instanceof Error?error.message:'경로를 조회하지 못했습니다.',code:error instanceof OdsayError||error instanceof TmapError?error.code:undefined});});
  };
  const nearby=originKey&&nearbyState?.key===originKey?nearbyState:null;
  const stations=useMemo(()=>nearby?.data?.stations.filter(s=>s.kind==='bus'?showBus:showSubway)??[],[nearby,showBus,showSubway]);
  const routes=routeKey&&routeState?.key===routeKey?routeState:null;
  return <Context.Provider value={{nearby,stations,showBus,showSubway,setShowBus,setShowSubway,retryNearby:()=>{if(origin)clearTransitNearby(origin,data.radius);setAttempt(v=>v+1);},focusStationId,focusStation,routes,queryRoutes,canRoute:Boolean(routeKey)}}>{children}</Context.Provider>;
}
export const useTransit=()=>useContext(Context);
