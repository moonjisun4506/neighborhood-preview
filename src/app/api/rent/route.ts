import {RentError} from '@/lib/molit-xml';
import {loadRent,rentRegion} from '@/lib/molit.server';
import {housingTypes,rentMonths,summarizeRent,type HousingType} from '@/lib/rent';
export const runtime='nodejs';
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
  const q=new URL(request.url).searchParams,lat=Number(q.get('lat')),lng=Number(q.get('lng')),month=q.get('month')??'',type=q.get('type')??'';
  const min=Number(q.get('minDeposit')??0),max=q.get('maxDeposit')?Number(q.get('maxDeposit')):null;
  if(!q.get('lat')||!q.get('lng')||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<33||lat>39||lng<124||lng>132||!rentMonths().includes(month)||!Object.hasOwn(housingTypes,type)||!Number.isSafeInteger(min)||min<0||(max!==null&&(!Number.isSafeInteger(max)||max<min)))return respond({error:'주소 좌표, 최근 24개 완료 월, 주택 유형과 보증금 범위(만원)를 확인해 주세요.'},400);
  try{
    if(!process.env.MOLIT_API_KEY?.trim())throw new RentError('CONFIG','월세 정보 없음 · MOLIT_API_KEY 설정과 3종 전월세 API 활용 승인이 필요합니다.',503);
    const region=await rentRegion(lat,lng),data=await loadRent(region.code,month,type as HousingType);
    return respond({region,month,type,minDeposit:min,maxDeposit:max,statistics:summarizeRent(data.trades,min,max),fetchedCount:data.total,excludedCount:data.excluded,retrievedAt:data.retrievedAt});
  }catch(error){return respond({error:error instanceof RentError?error.message:'실거래 조회 시간이 초과되었거나 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',code:error instanceof RentError?error.code:'NETWORK'},error instanceof RentError?error.status:502);}
}
