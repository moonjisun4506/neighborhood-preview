import type {NextRequest} from 'next/server';
import {hitLimit,ipKey,json,usernameTaken} from '@/lib/auth.server';
import {normalizeUsername,usernameError} from '@/lib/auth-shared';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'같은 사이트에서 요청해 주세요.'},403);
  const username=normalizeUsername(request.nextUrl.searchParams.get('username')),invalid=usernameError(username);
  if(invalid)return json({available:false,error:invalid},400);
  try{
    if(await hitLimit(ipKey('username-ip',request),60,600))return json({error:'중복 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'},429);
    return json({available:!await usernameTaken(username)});
  }catch{return json({error:'아이디 중복 여부를 확인하지 못했습니다.'},503);}
}
