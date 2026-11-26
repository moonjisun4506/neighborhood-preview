import {safetyData} from '@/lib/safety.server';
import {safetyOrigin} from '@/lib/safety';
export const runtime='nodejs';
export async function GET(request:Request){const origin=safetyOrigin(request);if(!origin)return new Response(null,{status:400});const {result,image}=await safetyData(origin);if(result.status!=='available'||!image)return Response.json({error:'공식 치안 지도 이미지를 제공할 수 없습니다.',status:result.status},{status:503,headers:{'Cache-Control':'no-store'}});return new Response(new Uint8Array(image),{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});}
