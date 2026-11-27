'use client';
import type {AddressRecord} from './demo-data';
import {facilityCategories,type FacilityResponse} from './facilities';
import {fetchTransitNearby,fetchTransitRoutes,cachedTransitRoutes,routeProvider} from './transit-client';
import {tmapFresh} from './tmap';
import {monthlyTransportCost,type TransitNearby,type TransitRoutes} from './transit';
import {noiseRadiusMeters,fixedNoiseResult,type NoiseResult} from './noise';
import type {RentResult} from './rent';
export type ComparisonData={noise?:NoiseResult;noiseError?:string;facilities:{label:string;response?:FacilityResponse;error?:string}[];nearby?:TransitNearby;transitError?:string;routes?:TransitRoutes;routeError?:string;rent?:RentResult;rentError?:string;unavailable?:string};
export type CompareOptions={radius:number;destination:AddressRecord|null;days:number;roundTrip:boolean;month:string;type:string;min:string;max:string};
async function json<T>(url:string,signal:AbortSignal):Promise<T>{const response=await fetch(url,{signal});const body=await response.json();if(!response.ok)throw new Error(body.error??'조회 실패');return body;}
export async function compareAddress(address:AddressRecord,options:CompareOptions,signal:AbortSignal):Promise<ComparisonData>{
  if(address.source!=='kakao'||!address.coordinates)return {facilities:[],unavailable:'실제 주소 좌표 미확인 · 주소를 다시 검색해 주세요.'};
  const origin=address.coordinates,result:ComparisonData={facilities:[]};
  for(const [category,label] of facilityCategories){if(signal.aborted)throw new DOMException('Aborted','AbortError');try{const response=await json<FacilityResponse>('/api/facilities?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),radius:String(options.radius),category}),signal);result.facilities.push({label,response});}catch(e){result.facilities.push({label,error:e instanceof Error?e.message:'조회 실패'});}}
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  try{result.nearby=await fetchTransitNearby(origin,options.radius,signal);}catch(e){result.transitError=e instanceof Error?e.message:'정류장 조회 실패';}
  if(options.destination?.source==='kakao'&&options.destination.coordinates){try{if(routeProvider==='tmap'){const hit=cachedTransitRoutes(origin,options.destination.coordinates);if(hit)result.routes=hit;else result.routeError='교통 탭에서 각 주소의 경로를 직접 조회해 주세요. 비교는 유효한 캐시만 사용합니다.';}else result.routes=await fetchTransitRoutes(origin,options.destination.coordinates,signal);}catch(e){result.routeError=e instanceof Error?e.message:'경로 조회 실패';}}else result.routeError='학교·직장 목적지를 먼저 검색·등록해 주세요.';
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  try{result.rent=await json<RentResult>('/api/rent?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),month:options.month,type:options.type,minDeposit:options.min,maxDeposit:options.max}),signal);}catch(e){result.rentError=e instanceof Error?e.message:'월세 조회 실패';}
  if(signal.aborted)throw new DOMException('Aborted','AbortError');try{result.noise=fixedNoiseResult(origin,await json<NoiseResult>('/api/noise?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),radius:String(noiseRadiusMeters)}),signal));}catch(e){result.noiseError=e instanceof Error?e.message:'소음 조회 실패';}
  return result;
}
export function compareJourney(routes:TransitRoutes|undefined,days:number,roundTrip:boolean){if(routes?.provider==='tmap'&&!tmapFresh(routes))routes=undefined;const fastest=(paths:TransitRoutes['outbound']['paths'])=>[...paths].filter(p=>p.minutes!==null).sort((a,b)=>a.minutes!-b.minutes!)[0];const outbound=fastest(routes?.outbound.paths??[]),inbound=fastest(routes?.inbound.paths??[]);return {outbound,inbound,monthly:monthlyTransportCost(outbound?.fare??null,inbound?.fare??null,days,roundTrip)};}
