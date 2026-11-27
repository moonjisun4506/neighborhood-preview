'use client';
import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {cloudIdsKey} from './saved-database';
type Auth={status:'loading'|'guest'|'user';username:string|null;persistent:boolean};
const Context=createContext<{auth:Auth;logout:()=>Promise<void>;sessionExpired:()=>void}>(null!);
const expiredFlag='np-session-expired',localKey='neighborhood-preview-v2';
let leaving=false;
/** True once logout/expiry cleanup started: late responses must not write account data back to storage. */
export const accountLeaving=()=>leaving;
/** Removes account-only records (addresses, memos, comparison, destination) from this browser's storage. */
export function stripAccountData(){
  leaving=true;
  try{
    const ids:string[]=JSON.parse(localStorage.getItem(cloudIdsKey)??'[]'),raw=localStorage.getItem(localKey);
    if(raw){const v=JSON.parse(raw),keep=(id:unknown)=>typeof id==='string'&&!ids.includes(id);
      localStorage.setItem(localKey,JSON.stringify({...v,addresses:(v.addresses??[]).filter((a:{id:string})=>keep(a.id)),saved:(v.saved??[]).filter(keep),compare:(v.compare??[]).filter(keep),notes:Object.fromEntries(Object.entries(v.notes??{}).filter(([id])=>keep(id))),selectedId:keep(v.selectedId)?v.selectedId:null,mapCenter:keep(v.selectedId)?v.mapCenter:null,destinationLocation:null,commuteDays:20,commuteRoundTrip:true,aiSummaries:{}}));}
    localStorage.removeItem(cloudIdsKey);
  }catch{/* Storage can be unavailable; server data is unaffected. */}
}
export function loginHref(path:string){return '/login?next='+encodeURIComponent(path||'/');}
export function AuthProvider({children}:{children:ReactNode}){
  const [auth,setAuth]=useState<Auth>({status:'loading',username:null,persistent:false});const [expired,setExpired]=useState(false);
  const sessionExpired=useCallback(()=>{stripAccountData();try{sessionStorage.setItem(expiredFlag,'1');}catch{}location.reload();},[]);
  useEffect(()=>{
    try{if(sessionStorage.getItem(expiredFlag)){sessionStorage.removeItem(expiredFlag);setExpired(true);}}catch{}
    fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(body=>{
      if(body?.user?.username)setAuth({status:'user',username:body.user.username,persistent:!!body.persistent});
      else{setAuth({status:'guest',username:null,persistent:false});if(body?.expired)sessionExpired();}
    }).catch(()=>setAuth({status:'guest',username:null,persistent:false}));
  },[sessionExpired]);
  const logout=useCallback(async()=>{
    const response=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    if(!response.ok)throw new Error('로그아웃을 처리하지 못했습니다.');
    stripAccountData();location.assign(location.pathname);
  },[]);
  return <Context.Provider value={{auth,logout,sessionExpired}}>{children}
    {expired&&<div className="session-expired-notice" role="alert"><span>로그인이 만료되었습니다. 계정 보관함을 보려면 다시 로그인해 주세요.</span><Link href={loginHref(typeof location==='undefined'?'/':location.pathname)} onClick={()=>setExpired(false)}>다시 로그인</Link><button type="button" aria-label="알림 닫기" onClick={()=>setExpired(false)}>×</button></div>}
    {auth.status==='user'&&<ImportPrompt username={auth.username!}/>}
  </Context.Provider>;
}
export const useAuth=()=>useContext(Context);
type Preview={status:'ok'|'claimed'|'none';newAddresses:number;duplicates:number;summaries:number};
/** Asks before copying this device's guest box into the account. Nothing is deleted either way. */
function ImportPrompt({username}:{username:string}){
  const asked='np-import-asked:'+username,[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const path=usePathname();
  useEffect(()=>{
    try{if(sessionStorage.getItem(asked))return;}catch{}
    fetch('/api/account/import',{cache:'no-store'}).then(r=>r.ok?r.json():null).then((body:Preview|null)=>{if(body?.status==='ok'&&body.newAddresses>0)setPreview(body);}).catch(()=>{});
  },[asked]);
  if(!preview||path==='/login'||path==='/signup')return null;
  const close=()=>{try{sessionStorage.setItem(asked,'1');}catch{}setPreview(null);};
  async function run(){
    setBusy(true);setMessage('');
    try{const response=await fetch('/api/account/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true})}),body=await response.json();if(!response.ok)throw new Error(body.error);close();location.reload();}
    catch(e){setMessage(e instanceof Error&&e.message?e.message:'가져오지 못했습니다. 기존 데이터는 그대로입니다.');setBusy(false);}
  }
  return <div className="import-backdrop"><div className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
    <h2 id="import-title">이 기기의 비회원 보관함을 가져올까요?</h2>
    <p>로그인 전에 이 기기에 저장한 관심 주소 <strong>{preview.newAddresses}곳</strong>{preview.summaries?<> · AI 요약 {preview.summaries}건</>:null}을 <strong>{username}</strong> 계정에 복사합니다.</p>
    <ul><li>계정에 이미 있는 주소 {preview.duplicates}곳은 계정 내용을 유지합니다.</li><li>비회원 보관함의 원본은 삭제되지 않습니다.</li><li>한 번 가져온 비회원 보관함은 다른 계정으로 다시 가져올 수 없습니다.</li></ul>
    {message&&<p role="alert" className="auth-error">{message}</p>}
    <div className="import-actions"><button type="button" className="ui-button" onClick={close} disabled={busy}>나중에</button><button type="button" className="ui-button selected" onClick={()=>{void run();}} disabled={busy}>{busy?'가져오는 중…':'계정으로 가져오기'}</button></div>
  </div></div>;
}
