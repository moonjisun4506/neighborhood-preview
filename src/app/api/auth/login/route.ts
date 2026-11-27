import type {NextRequest} from 'next/server';
import {authCookie,clearLimit,createSession,deleteSessionToken,findCredentials,hitLimit,ipKey,json,limitKey,limitWait,readJson,sameSiteRequest,setSessionCookie,verifyPassword} from '@/lib/auth.server';
import {normalizeUsername} from '@/lib/auth-shared';
export const runtime='nodejs';
const failure={code:'INVALID',error:'아이디 또는 비밀번호가 올바르지 않습니다.'};
const minutes=(s:number)=>Math.max(1,Math.ceil(s/60));
export async function POST(request:NextRequest){
  if(!sameSiteRequest(request))return json({code:'ORIGIN',error:'같은 사이트에서 요청해 주세요.'},403);
  try{
    const body=await readJson(request);if(!body)return json({code:'INPUT',error:'입력 형식을 확인해 주세요.'},400);
    const username=normalizeUsername(body.username),password=typeof body.password==='string'?body.password:'';
    if(!username||username.length>40||!password||password.length>128)return json(failure,401);
    // 30 attempts per address per 15 minutes; 5 failures per account lock that account for 15 minutes.
    const ipWait=await hitLimit(ipKey('login-ip',request),30,900);
    if(ipWait)return json({code:'RATE_LIMIT',error:`로그인 시도가 너무 많습니다. ${minutes(ipWait)}분 후 다시 시도해 주세요.`},429);
    const accountKey=limitKey('login-user',username),locked=await limitWait(accountKey,5,900);
    if(locked)return json({code:'LOCKED',error:`로그인 실패가 반복되어 잠시 제한되었습니다. ${minutes(locked)}분 후 다시 시도해 주세요.`},429);
    const user=await findCredentials(username);
    if(!await verifyPassword(user?.password_hash??null,password)||!user){await hitLimit(accountKey,5,900);return json(failure,401);}
    await clearLimit(accountKey);
    // Session renewal: the previous token on this device is revoked and a fresh one is issued.
    await deleteSessionToken(request.cookies.get(authCookie)?.value);
    const persistent=body.remember===true;
    return setSessionCookie(json({user:{username:user.username}}),await createSession(user.id,persistent),persistent);
  }catch{return json({code:'STORAGE',error:'로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);}
}
