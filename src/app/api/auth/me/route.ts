import type {NextRequest} from 'next/server';
import {authCookie,clearSessionCookie,getAuth,json,setSessionCookie} from '@/lib/auth.server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'같은 사이트에서 요청해 주세요.'},403);
  try{
    const auth=await getAuth(request);
    if(!auth.user)return auth.expired?clearSessionCookie(json({user:null,expired:true})):json({user:null,expired:false});
    const response=json({user:{username:auth.user.username},persistent:auth.persistent,expiresAt:auth.expiresAt});
    // Persistent cookies follow the sliding server expiry; the token itself is unchanged.
    return auth.persistent?setSessionCookie(response,request.cookies.get(authCookie)!.value,true):response;
  }catch{return json({error:'로그인 상태를 확인하지 못했습니다.'},503);}
}
