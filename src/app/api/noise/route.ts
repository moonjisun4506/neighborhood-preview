import {nearbyNoise} from '@/lib/noise.server';
export const runtime='nodejs';
export async function GET(request:Request){const q=new URL(request.url).searchParams,lat=Number(q.get('lat')),lng=Number(q.get('lng')),radius=Number(q.get('radius'));
  if(!q.get('lat')||!q.get('lng')||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<33||lat>39||lng<124||lng>132||![300,500,1000].includes(radius))return Response.json({error:'선택 주소와 검색 반경을 확인해 주세요.'},{status:400});
  try{return Response.json(await nearbyNoise({lat,lng},radius),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'공식 소음 자료 조회에 실패했습니다. 소음 측정자료 없음으로 판단하지 않았습니다.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
