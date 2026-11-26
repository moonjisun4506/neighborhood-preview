import {nearbyStations} from '@/lib/nearby-stations.server';
import {validCoordinates} from '@/lib/transit';
export const runtime='nodejs';
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;const origin={lat:Number(params.get('lat')),lng:Number(params.get('lng'))},radius=Number(params.get('radius'));
  if(!params.get('lat')?.trim()||!params.get('lng')?.trim()||!validCoordinates(origin)||![300,500,1000].includes(radius))return respond({error:'기준 주소 좌표와 반경(300/500/1000m)을 확인해 주세요.'},400);
  return respond(await nearbyStations(origin,radius,params.get('refresh')==='1'));
}
