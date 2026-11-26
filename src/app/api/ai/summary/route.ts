import type {NextRequest} from 'next/server';
import {owner,savedResponse} from '@/lib/saved.server';
import {collectEvidence,validateSummaryRequest} from '@/lib/ai-evidence.server';
import {AiError,reserveGeneration,openAiSummary,finishGeneration} from '@/lib/ai.server';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(request:NextRequest){
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return savedResponse({error:'같은 사이트에서 AI 요약을 요청해 주세요.'},403);
  try{const text=await request.text();if(text.length>250000)return savedResponse({error:'요약 입력 자료가 너무 큽니다.'},413);let body;try{body=JSON.parse(text);}catch{return savedResponse({error:'요약 입력을 확인해 주세요.'},400);}
    if(!validateSummaryRequest(body))return savedResponse({error:'실제 선택 주소와 공통 조회 조건을 확인해 주세요.'},400);
    const session=await owner(request);if(!session)return savedResponse({error:'익명 보관함 연결 후 다시 시도해 주세요.'},401);
    if(!process.env.OPENAI_API_KEY?.trim())throw new AiError('OpenAI 서버 인증키 설정이 필요합니다.',503);
    const id=await reserveGeneration(session.id,body.addresses.map(a=>a.id)),evidence=await collectEvidence(body);if(request.signal.aborted)return savedResponse({error:'요약 요청이 취소되었습니다.'},499);
    const result=await openAiSummary(id,body,evidence);await finishGeneration(session.id,id,result);return savedResponse({summary:result});
  }catch(e){return savedResponse({error:e instanceof AiError?e.message:'AI 요약 자료를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},e instanceof AiError?e.status:503);}
}
