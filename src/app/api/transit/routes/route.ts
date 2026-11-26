import {callOdsay,normalizeDirection,OdsayError} from '@/lib/odsay.server';
import {validCoordinates,type TransitDirection} from '@/lib/transit';
export const runtime='nodejs';
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
  let body;try{body=await request.json();}catch{return respond({error:'출발지와 목적지 JSON을 확인해 주세요.'},400);}
  if(!validCoordinates(body?.origin)||!validCoordinates(body?.destination))return respond({error:'실제 검색한 출발지와 목적지 좌표가 필요합니다.'},400);
  const {origin,destination}=body;
  const direction=async(start:typeof origin,end:typeof origin):Promise<TransitDirection>=>{
    const response=await callOdsay('searchPubTransPathT',{SX:String(start.lng),SY:String(start.lat),EX:String(end.lng),EY:String(end.lat),OPT:'0',SearchType:'0',SearchPathType:'0'},request.signal);
    return normalizeDirection(response.result,response.emptyCode);
  };
  // Separate forward/return queries: never assume the return fare equals the forward fare.
  const [outbound,inbound]=await Promise.allSettled([direction(origin,destination),direction(destination,origin)]);
  const errorDirection=(reason:unknown):TransitDirection=>({status:'error',paths:[],code:reason instanceof OdsayError?reason.code:'UPSTREAM',message:reason instanceof OdsayError?reason.message:'대중교통 경로를 조회하지 못했습니다.'});
  if(outbound.status==='rejected'&&inbound.status==='rejected'){
    const error=outbound.reason;return respond({provider:'odsay',code:error instanceof OdsayError?error.code:'UPSTREAM',error:error instanceof OdsayError?error.message:'대중교통 경로를 조회하지 못했습니다.'},error instanceof OdsayError?error.status:502);
  }
  return respond({provider:'odsay',origin,destination,outbound:outbound.status==='fulfilled'?outbound.value:errorDirection(outbound.reason),inbound:inbound.status==='fulfilled'?inbound.value:errorDirection(inbound.reason),fetchedAt:new Date().toISOString()});
}
