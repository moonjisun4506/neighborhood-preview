import {safetyData} from '@/lib/safety.server';
import {safetyOrigin} from '@/lib/safety';
export const runtime='nodejs';
export async function GET(request:Request){const origin=safetyOrigin(request);if(!origin)return Response.json({error:'선택 주소 좌표와 고정 반경 1km를 확인해 주세요.'},{status:400});const {result}=await safetyData(origin);return Response.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
