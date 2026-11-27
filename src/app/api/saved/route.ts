import type {NextRequest} from 'next/server';
import {owner,savedResponse,validAddress,listSaved,putSaved,deleteSaved} from '@/lib/saved.server';
import {expiredResponse,getAuth} from '@/lib/auth.server';
import {deleteUserSaved,listUserSaved,putUserSaved} from '@/lib/account.server';
export const runtime='nodejs';
// Signed in: the account box (shared by every device). Guest: this device's anonymous box (unchanged).
export async function GET(request:NextRequest){if(request.headers.get('sec-fetch-site')==='cross-site')return savedResponse({error:'같은 사이트에서 보관함을 열어 주세요.'},403);try{const auth=await getAuth(request);if(!auth.user&&auth.expired)return expiredResponse();const session=(await owner(request,true))!;return savedResponse({entries:auth.user?await listUserSaved(auth.user.id):await listSaved(session.id),account:auth.user?{username:auth.user.username}:null},200,session.token);}catch{return savedResponse({error:'주소 보관함 DB에 연결할 수 없습니다. 다시 시도해 주세요.'},503);}}
async function mutate(request:NextRequest,remove:boolean){
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return savedResponse({error:'같은 사이트에서 요청해 주세요.'},403);
  if(Number(request.headers.get('content-length')??0)>16000)return savedResponse({error:'저장 내용이 너무 깁니다.'},413);
  try{
    const text=await request.text();if(text.length>12000)return savedResponse({error:'저장 내용이 너무 깁니다.'},413);
    let body;try{body=JSON.parse(text);}catch{return savedResponse({error:'저장 형식을 확인해 주세요.'},400);}
    if(remove?typeof body?.id!=='string'||body.id.length>200:!validAddress(body?.address)||typeof body?.memo!=='string'||body.memo.length>4000)return savedResponse({error:'주소 또는 메모(최대 4,000자)를 확인해 주세요.'},400);
    const auth=await getAuth(request);if(!auth.user&&auth.expired)return expiredResponse();
    if(auth.user){if(remove)await deleteUserSaved(auth.user.id,body.id);else await putUserSaved(auth.user.id,body.address,body.memo);return savedResponse({ok:true});}
    const session=await owner(request);if(!session)return savedResponse({error:'익명 세션이 만료되었습니다. 보관함을 새로고침해 주세요.'},401);
    if(remove)await deleteSaved(session.id,body.id);else await putSaved(session.id,body.address,body.memo);
    return savedResponse({ok:true});
  }catch{return savedResponse({error:'DB 저장에 실패했습니다. 변경 사항이 저장되지 않았습니다.'},503);}
}
export const PUT=(r:NextRequest)=>mutate(r,false);
export const DELETE=(r:NextRequest)=>mutate(r,true);
