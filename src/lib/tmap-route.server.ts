import {validCoordinates} from './transit';
import {TmapError} from './tmap';
export async function tmapInput(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new TmapError('ORIGIN',403,'같은 사이트에서만 경로를 요청할 수 있습니다.');let body;try{body=await request.json();}catch{throw new TmapError('INPUT',400,'출발지와 목적지 JSON을 확인해 주세요.');}if(!validCoordinates(body?.origin)||!validCoordinates(body?.destination))throw new TmapError('INPUT',400,'실제 출발지·목적지 좌표를 선택해 주세요.');return body as {origin:{lat:number;lng:number};destination:{lat:number;lng:number}};}
export function tmapResponse(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});}
export function tmapFailure(error:unknown){return tmapResponse({code:error instanceof TmapError?error.code:'UPSTREAM',error:error instanceof TmapError?error.message:'TMAP 요청을 처리하지 못했습니다.'},error instanceof TmapError?error.status:502);}
