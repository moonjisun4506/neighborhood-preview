import type {NextRequest} from 'next/server';
import {expiredResponse,getAuth,json,readJson,sameSiteRequest} from '@/lib/auth.server';
import {getSettings,putSettings,validSettings} from '@/lib/account.server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'같은 사이트에서 요청해 주세요.'},403);
  try{const auth=await getAuth(request);if(!auth.user)return auth.expired?expiredResponse():json({code:'LOGIN_REQUIRED',error:'로그인이 필요합니다.'},401);return json({settings:await getSettings(auth.user.id)});}
  catch{return json({error:'계정 설정을 불러오지 못했습니다.'},503);}
}
export async function PUT(request:NextRequest){
  if(!sameSiteRequest(request))return json({code:'ORIGIN',error:'같은 사이트에서 요청해 주세요.'},403);
  try{
    const auth=await getAuth(request);if(!auth.user)return auth.expired?expiredResponse():json({code:'LOGIN_REQUIRED',error:'로그인이 필요합니다.'},401);
    const body=await readJson(request,8000);if(!validSettings(body?.settings))return json({code:'INPUT',error:'설정 형식을 확인해 주세요.'},400);
    await putSettings(auth.user.id,body.settings);return json({ok:true});
  }catch{return json({error:'계정 설정을 저장하지 못했습니다.'},503);}
}
