'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {useApp} from './app-provider';
import type {Coordinates} from '@/lib/demo-data';
import {fetchTmapWalking} from '@/lib/tmap-client';
import {tmapFresh,type WalkingRoute} from '@/lib/tmap';
type WalkingPlace={id:string;name:string;coordinates:Coordinates;kind?:'bus'|'subway'};
export function PlaceWalkingDetails({place,onClose,children}:{place:WalkingPlace;onClose:()=>void;children?:ReactNode}){
  const {selected}=useApp(),station=!!place.kind;
  const requestKey=JSON.stringify([selected?.id,selected?.coordinates,place.id,place.coordinates]);
  return <div className={'facility-popup'+(station?' transit-popup':'')} role="dialog" aria-label={station?'정류장 상세 정보':'시설 상세 정보'}>
    <button type="button" className="facility-popup-close" aria-label={station?'정류장 상세 닫기':'시설 상세 닫기'} onClick={onClose}>×</button>
    <h3>{place.name}</h3><FacilityWalking key={requestKey} place={place}/>
    {place.kind==='subway'&&<small>역 대표 위치 기준 · 실제 출입구까지의 경로와 다를 수 있습니다.</small>}{children}
  </div>;
}
export function FacilityWalking({place}:{place:Pick<WalkingPlace,'coordinates'>}){
  const {selected}=useApp(),origin=selected?.source==='kakao'?selected.coordinates:null;
  const [result,setResult]=useState<WalkingRoute|null>(null),[busy,setBusy]=useState(!!origin);
  useEffect(()=>{
    if(!origin)return;
    const controller=new AbortController();
    fetchTmapWalking(origin,place.coordinates,controller.signal).then(value=>{if(!controller.signal.aborted)setResult(value);}).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[origin?.lat,origin?.lng,place.coordinates.lat,place.coordinates.lng]);
  useEffect(()=>{if(!result)return;const timer=setTimeout(()=>setResult(null),Math.max(0,Date.parse(result.expiresAt)-Date.now()));return()=>clearTimeout(timer);},[result]);
  const available=result&&tmapFresh(result)&&result.status==='ok'&&result.distanceMeters!==null&&result.seconds!==null;
  return <div className="facility-walking" aria-label="실제 도보 경로" aria-live="polite">{busy?<small role="status">도보 경로 조회 중…</small>:available?<strong>도보 {Math.round(result.distanceMeters!)}m · 예상 {Math.ceil(result.seconds!/60)}분</strong>:<small>도보 정보 확인 불가</small>}</div>;
}
