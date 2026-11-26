'use client';
import type {Coordinates} from './demo-data';
import type {TransitDirection,TransitNearby,TransitRoutes} from './transit';
import {OdsayError,parseOdsayBody,normalizeDirection,normalizeStations} from './odsay-data';
export const transitMode=process.env.NEXT_PUBLIC_TRANSIT_MODE==='web'?'web':'server';
async function webCall(endpoint:'pointSearch'|'searchPubTransPathT',params:Record<string,string>,signal:AbortSignal){
  const key=process.env.NEXT_PUBLIC_ODSAY_WEB_API_KEY?.trim();if(!key)throw new OdsayError('CONFIG',503,'ODsay Web 키 설정이 필요합니다.');
  const url=new URL(`https://api.odsay.com/v1/api/${endpoint}`);url.search=new URLSearchParams({...params,apiKey:key,output:'json',lang:'0'}).toString();
  let response:Response;
  try{response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});}catch{throw new OdsayError('NETWORK',502,'ODsay 브라우저 호출에 실패했습니다. 네트워크·등록 URI·CORS 설정을 확인해 주세요.');}
  if(!response.ok)throw new OdsayError(response.status===429?'QUOTA':'UPSTREAM',response.status===429?429:502,'대중교통 제공사 요청을 처리하지 못했습니다.');
  let body;try{body=await response.json();}catch{throw new OdsayError('UPSTREAM',502,'대중교통 응답을 읽지 못했습니다.');}return parseOdsayBody(body,'web');
}
async function serverResponse<T>(path:string,options:RequestInit):Promise<T>{const response=await fetch(path,options);const body=await response.json();if(!response.ok)throw new OdsayError(body.code??'UPSTREAM',response.status,body.error??'대중교통 조회에 실패했습니다.');return body;}
export async function fetchTransitNearby(origin:Coordinates,radius:number,signal:AbortSignal):Promise<TransitNearby>{
  if(transitMode==='server')return serverResponse('/api/transit/nearby?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),radius:String(radius)}),{signal});
  const {result}=await webCall('pointSearch',{x:String(origin.lng),y:String(origin.lat),radius:String(radius),stationClass:'1:2'},signal);
  return {provider:'odsay',origin,radius,stations:normalizeStations(result,origin,radius),fetchedAt:new Date().toISOString()};
}
export async function fetchTransitRoutes(origin:Coordinates,destination:Coordinates,signal:AbortSignal):Promise<TransitRoutes>{
  if(transitMode==='server')return serverResponse('/api/transit/routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin,destination}),signal});
  const direction=async(start:Coordinates,end:Coordinates):Promise<TransitDirection>=>{try{const {result,emptyCode}=await webCall('searchPubTransPathT',{SX:String(start.lng),SY:String(start.lat),EX:String(end.lng),EY:String(end.lat),OPT:'0',SearchType:'0',SearchPathType:'0'},signal);return normalizeDirection(result,emptyCode);}catch(error){return {status:'error',paths:[],code:error instanceof OdsayError?error.code:'UPSTREAM',message:error instanceof Error?error.message:'경로를 조회하지 못했습니다.'};}};
  const outbound=await direction(origin,destination);if(signal.aborted)throw new DOMException('Aborted','AbortError');const inbound=await direction(destination,origin);
  if(outbound.status==='error'&&inbound.status==='error')throw new OdsayError(outbound.code??'UPSTREAM',502,outbound.message??'경로를 조회하지 못했습니다.');
  return {provider:'odsay',origin,destination,outbound,inbound,fetchedAt:new Date().toISOString()};
}
