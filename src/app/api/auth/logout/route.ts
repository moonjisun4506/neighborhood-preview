import type {NextRequest} from 'next/server';
import {authCookie,clearSessionCookie,deleteSessionToken,json,sameSiteRequest} from '@/lib/auth.server';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  if(!sameSiteRequest(request,false))return json({code:'ORIGIN',error:'같은 사이트에서 요청해 주세요.'},403);
  try{await deleteSessionToken(request.cookies.get(authCookie)?.value);return clearSessionCookie(json({ok:true}));}
  catch{return json({code:'STORAGE',error:'로그아웃을 처리하지 못했습니다. 다시 시도해 주세요.'},503);}
}
