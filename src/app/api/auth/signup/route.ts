import type {NextRequest} from 'next/server';
import {createSession,createUser,deleteSessionToken,authCookie,hitLimit,ipKey,json,readJson,sameSiteRequest,setSessionCookie} from '@/lib/auth.server';
import {normalizeUsername,passwordError,usernameError} from '@/lib/auth-shared';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  if(!sameSiteRequest(request))return json({code:'ORIGIN',error:'같은 사이트에서 요청해 주세요.'},403);
  try{
    const body=await readJson(request);if(!body)return json({code:'INPUT',error:'입력 형식을 확인해 주세요.'},400);
    const username=normalizeUsername(body.username),invalid=usernameError(username)??passwordError(body.password,username);
    if(invalid)return json({code:'INPUT',error:invalid},400);
    const wait=await hitLimit(ipKey('signup-ip',request),10,3600);
    if(wait)return json({code:'RATE_LIMIT',error:`회원가입 요청이 너무 많습니다. ${Math.ceil(wait/60)}분 후 다시 시도해 주세요.`},429);
    const user=await createUser(username,body.password as string);
    if(!user)return json({code:'DUPLICATE',error:'이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.'},409);
    const persistent=body.remember===true;await deleteSessionToken(request.cookies.get(authCookie)?.value);
    return setSessionCookie(json({user:{username:user.username}},201),await createSession(user.id,persistent),persistent);
  }catch{return json({code:'STORAGE',error:'회원 DB에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);}
}
