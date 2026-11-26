'use client';
import {useEffect,useState} from 'react';
import {useApp} from './app-provider';
import type {FacilityPlace} from '@/lib/facilities';
import {fetchTmapWalking} from '@/lib/tmap-client';
import {tmapFresh,type WalkingRoute} from '@/lib/tmap';
export function FacilityWalking({place}:{place:FacilityPlace}){
  const {selected}=useApp(),origin=selected?.source==='kakao'?selected.coordinates:null;const [result,setResult]=useState<WalkingRoute|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  useEffect(()=>{setResult(null);setError('');if(!origin)return;const controller=new AbortController();setBusy(true);fetchTmapWalking(origin,place.coordinates,controller.signal).then(setResult).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'도보 경로 조회 실패');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[origin?.lat,origin?.lng,place.coordinates.lat,place.coordinates.lng]);
  useEffect(()=>{if(!result)return;const timer=setTimeout(()=>{setResult(null);setError('도보 경로의 유효기간이 만료되었습니다. 시설을 다시 선택해 주세요.');},Math.max(0,Date.parse(result.expiresAt)-Date.now()));return()=>clearTimeout(timer);},[result]);
  return <div className="facility-walking" aria-label="실제 도보 경로">{busy?<small role="status">도보 경로 조회 중…</small>:error?<small role="alert">{error}</small>:result&&tmapFresh(result)?result.status==='no_route'?<small>조회된 도보 경로가 없습니다.</small>:<><strong>도보 {result.distanceMeters===null?'거리 미제공':`${Math.round(result.distanceMeters)}m`} · {result.seconds===null?'시간 미제공':`예상 ${Math.ceil(result.seconds/60)}분`}</strong><small>TMAP 보행자 경로 기준 · 직선거리와 다릅니다.</small></>:null}</div>;
}
