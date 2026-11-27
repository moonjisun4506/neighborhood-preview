import type {NextRequest} from 'next/server';
import {expiredResponse,getAuth,json,readJson,sameSiteRequest} from '@/lib/auth.server';
import {owner} from '@/lib/saved.server';
import {importAnonymous,importPreview} from '@/lib/account.server';
export const runtime='nodejs';
// The anonymous box is identified only by this device's HttpOnly cookie — never by a client-supplied id.
export async function GET(request:NextRequest){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'같은 사이트에서 요청해 주세요.'},403);
  try{
    const auth=await getAuth(request);if(!auth.user)return auth.expired?expiredResponse():json({code:'LOGIN_REQUIRED',error:'로그인이 필요합니다.'},401);
    const device=await owner(request);if(!device)return json({status:'none',newAddresses:0,duplicates:0,summaries:0});
    return json(await importPreview(auth.user.id,device.id));
  }catch{return json({error:'이 기기의 비회원 보관함을 확인하지 못했습니다.'},503);}
}
export async function POST(request:NextRequest){
  if(!sameSiteRequest(request))return json({code:'ORIGIN',error:'같은 사이트에서 요청해 주세요.'},403);
  try{
    const auth=await getAuth(request);if(!auth.user)return auth.expired?expiredResponse():json({code:'LOGIN_REQUIRED',error:'로그인이 필요합니다.'},401);
    const body=await readJson(request);if(body?.confirm!==true)return json({code:'CONFIRM',error:'가져오기를 확인해 주세요.'},400);
    const device=await owner(request);if(!device)return json({code:'NONE',error:'이 기기에 가져올 비회원 보관함이 없습니다.'},404);
    const result=await importAnonymous(auth.user.id,device.id);
    return result?json({ok:true,...result}):json({code:'CLAIMED',error:'이 기기의 비회원 보관함은 이미 다른 계정으로 가져왔습니다. 다른 사용자의 데이터와 합치지 않습니다.'},409);
  }catch{return json({error:'비회원 데이터를 가져오지 못했습니다. 기존 데이터는 그대로 보존됩니다.'},503);}
}
