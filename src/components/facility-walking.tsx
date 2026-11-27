'use client';
import {useEffect,useReducer,useState,type ReactNode} from 'react';
import {useApp} from './app-provider';
import type {Coordinates} from '@/lib/demo-data';
import {fetchTmapWalking,peekTmapWalking,subscribeTmap,walkingStatus,type WalkingStatus} from '@/lib/tmap-client';
type WalkingPlace={id:string;name:string;coordinates:Coordinates;kind?:'bus'|'subway'};
function useOrigin(){const {selected}=useApp();return selected?.source==='kakao'?selected.coordinates??null:null;}
/** Live view of the shared TMAP pedestrian cache for the selected house → destination. */
export function useWalkingStatus(destination:Coordinates):WalkingStatus{
  const origin=useOrigin();const [mounted,setMounted]=useState(false);const [,refresh]=useReducer((v:number)=>v+1,0);
  useEffect(()=>{setMounted(true);return subscribeTmap(refresh);},[]);
  const status:WalkingStatus=mounted&&origin?walkingStatus(origin,destination):{state:'idle'};
  const expiresAt=status.state==='ok'?status.route.expiresAt:null;
  useEffect(()=>{if(!expiresAt)return;const timer=setTimeout(refresh,Math.max(0,Date.parse(expiresAt)-Date.now())+50);return()=>clearTimeout(timer);},[expiresAt]);
  return status;
}
/** One batched read of the server cache for visible rows. TMAP is never called from here. */
export function useWalkingCachePeek(destinations:Coordinates[]){
  const origin=useOrigin();const signature=JSON.stringify(destinations.map(d=>[d.lat,d.lng]));
  useEffect(()=>{if(!origin||!destinations.length)return;const timer=setTimeout(()=>{void peekTmapWalking(origin,destinations);},300);return()=>clearTimeout(timer);},[origin?.lat,origin?.lng,signature]);
}
const minutes=(seconds:number)=>Math.max(1,Math.ceil(seconds/60));
/** List label: actual TMAP walking time and distance only; straight-line distance is never converted. */
export function WalkingLabel({destination}:{destination:Coordinates}){
  const status=useWalkingStatus(destination);
  return <span className="walking-label" data-walking={status.state}>{status.state==='ok'?`도보 약 ${minutes(status.route.seconds)}분 · ${Math.round(status.route.distanceMeters)}m`:status.state==='loading'?'도보 조회 중…':status.state==='unavailable'?'도보 정보 확인 불가':'선택 시 도보 확인'}</span>;
}
/** Desktop side panel only: bring a selected row into view without moving the page on mobile. */
export function revealInPanel(element:HTMLElement|null){
  if(!element)return;const disclosure=element.closest('details');if(disclosure&&!disclosure.open)disclosure.open=true;
  const panel=element.closest<HTMLElement>('.workspace-side');if(!panel||panel.scrollHeight<=panel.clientHeight+1||getComputedStyle(panel).overflowY==='visible')return;
  const row=element.getBoundingClientRect(),box=panel.getBoundingClientRect();
  if(row.top<box.top+8)panel.scrollBy({top:row.top-box.top-8,behavior:'smooth'});else if(row.bottom>box.bottom-8)panel.scrollBy({top:row.bottom-box.bottom+8,behavior:'smooth'});
}
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
  const origin=useOrigin();const status=useWalkingStatus(place.coordinates);
  // Only the selected place is queried. Cached results and in-flight requests are reused by tmap-client.
  useEffect(()=>{
    if(!origin||walkingStatus(origin,place.coordinates).state==='ok')return;
    fetchTmapWalking(origin,place.coordinates).catch(()=>{});
  },[origin?.lat,origin?.lng,place.coordinates.lat,place.coordinates.lng]);
  const busy=status.state==='loading'||(status.state==='idle'&&!!origin);
  return <div className="facility-walking" aria-label="실제 도보 경로" aria-live="polite">{busy?<small role="status">도보 경로 조회 중…</small>:status.state==='ok'?<strong>도보 {Math.round(status.route.distanceMeters)}m · 예상 {Math.ceil(status.route.seconds/60)}분</strong>:<small>도보 정보 확인 불가</small>}</div>;
}
