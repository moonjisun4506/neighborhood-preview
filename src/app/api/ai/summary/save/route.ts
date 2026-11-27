import type {NextRequest} from 'next/server';
import {owner,savedResponse} from '@/lib/saved.server';
import {saveGeneration} from '@/lib/ai.server';
import {expiredResponse,getAuth} from '@/lib/auth.server';
import {saveUserGeneration} from '@/lib/account.server';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return savedResponse({error:'같은 사이트에서 저장해 주세요.'},403);
  try{const body=await request.json();if(typeof body?.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)||typeof body?.addressId!=='string'||body.addressId.length>200)return savedResponse({error:'저장할 AI 요약을 확인해 주세요.'},400);
    const auth=await getAuth(request);if(!auth.user&&auth.expired)return expiredResponse();
    // Generations stay tied to this device's generator; signed-in saves land in the account box.
    const session=await owner(request);if(!session)return savedResponse({error:'익명 보관함 세션이 필요합니다.'},401);const summary=auth.user?await saveUserGeneration(auth.user.id,session.id,body.id,body.addressId):await saveGeneration(session.id,body.id,body.addressId);
    return summary?savedResponse({summary}):savedResponse({error:'저장된 관심 주소와 본인이 생성한 요약을 확인해 주세요. 생성 자료는 하루 후 만료됩니다.'},404);
  }catch{return savedResponse({error:'AI 요약을 DB에 저장하지 못했습니다.'},503);}
}
