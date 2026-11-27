import {tmapResponse,tmapFailure} from '@/lib/tmap-route.server';
import {peekTmapWalks} from '@/lib/tmap.server';
import {TmapError} from '@/lib/tmap';
import {validCoordinates} from '@/lib/transit';
export const runtime='nodejs';
// Returns only pedestrian routes already cached by /api/tmap/walk. No TMAP request is made here.
export async function POST(request:Request){
  try{
    if(request.headers.get('origin')!==new URL(request.url).origin)throw new TmapError('ORIGIN',403,'같은 사이트에서만 경로를 요청할 수 있습니다.');
    let body;try{body=await request.json();}catch{throw new TmapError('INPUT',400,'출발지와 목적지 JSON을 확인해 주세요.');}
    const destinations=body?.destinations;
    if(!validCoordinates(body?.origin)||!Array.isArray(destinations)||!destinations.length||destinations.length>40||!destinations.every(validCoordinates))throw new TmapError('INPUT',400,'실제 출발지·목적지 좌표를 선택해 주세요.');
    return tmapResponse({results:await peekTmapWalks(body.origin,destinations)});
  }catch(error){return tmapFailure(error instanceof TmapError?error:new TmapError('STORAGE',503,'도보 경로 캐시를 확인하지 못했습니다.'));}
}
