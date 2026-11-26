import {callOdsay,OdsayError} from '@/lib/odsay.server';
import {normalizeStations} from '@/lib/odsay-data';
import {validCoordinates} from '@/lib/transit';
export const runtime='nodejs';
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;const origin={lat:Number(params.get('lat')),lng:Number(params.get('lng'))},radius=Number(params.get('radius'));
  if(!params.get('lat')?.trim()||!params.get('lng')?.trim()||!validCoordinates(origin)||![300,500,1000].includes(radius))return respond({error:'기준 주소 좌표와 반경(300/500/1000m)을 확인해 주세요.'},400);
  try{const {result}=await callOdsay('pointSearch',{x:String(origin.lng),y:String(origin.lat),radius:String(radius),stationClass:'1:2'},request.signal);return respond({provider:'odsay',origin,radius,stations:normalizeStations(result,origin,radius),fetchedAt:new Date().toISOString()});}
  catch(error){return error instanceof OdsayError?respond({provider:'odsay',code:error.code,error:error.message},error.status):respond({error:'주변 정류장 정보를 조회하지 못했습니다.'},502);}
}
