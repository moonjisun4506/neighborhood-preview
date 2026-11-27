'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useAuth} from './auth-provider';
import {Icon} from './shell';
import {normalizeUsername,passwordError,passwordRule,safeNext,usernameError,usernameRule} from '@/lib/auth-shared';
type Check={state:'idle'|'checking'|'available'|'taken'|'error';message?:string;username?:string};
export function AuthForm({mode}:{mode:'login'|'signup'}){
  const signup=mode==='signup',{auth}=useAuth();
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[remember,setRemember]=useState(false);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[check,setCheck]=useState<Check>({state:'idle'}),[next,setNext]=useState('/');
  useEffect(()=>{setNext(safeNext(new URLSearchParams(location.search).get('next')));},[]);
  const normalized=normalizeUsername(username),checked=check.username===normalized?check:{state:'idle' as const};
  async function checkUsername(){
    const invalid=usernameError(normalized);if(invalid){setCheck({state:'error',message:invalid,username:normalized});return;}
    setCheck({state:'checking',username:normalized});
    try{const response=await fetch('/api/auth/username?'+new URLSearchParams({username:normalized}),{cache:'no-store'}),body=await response.json();
      setCheck(response.ok?{state:body.available?'available':'taken',username:normalized,message:body.available?'사용할 수 있는 아이디입니다.':'이미 사용 중인 아이디입니다.'}:{state:'error',username:normalized,message:body.error??'중복 확인에 실패했습니다.'});}
    catch{setCheck({state:'error',username:normalized,message:'중복 확인에 실패했습니다. 네트워크를 확인해 주세요.'});}
  }
  async function submit(event:FormEvent){
    event.preventDefault();setError('');
    if(signup){const invalid=usernameError(normalized)??passwordError(password,normalized);if(invalid)return setError(invalid);if(password!==confirm)return setError('비밀번호 확인이 일치하지 않습니다.');if(checked.state==='taken')return setError('이미 사용 중인 아이디입니다.');}
    else if(!normalized||!password)return setError('아이디와 비밀번호를 입력해 주세요.');
    setBusy(true);
    try{
      const response=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:normalized,password,remember})}),body=await response.json();
      if(!response.ok){if(body.code==='DUPLICATE')setCheck({state:'taken',username:normalized,message:body.error});throw new Error(body.error);}
      setPassword('');setConfirm('');location.assign(next);
    }catch(e){setError(e instanceof Error&&e.message?e.message:'요청을 처리하지 못했습니다. 다시 시도해 주세요.');setBusy(false);}
  }
  if(auth.status==='user')return <section className="auth-card"><h1>이미 로그인되어 있습니다</h1><p><strong>{auth.username}</strong> 계정으로 이용 중입니다.</p><Link className="ui-button selected auth-submit" href={next}>계속하기</Link></section>;
  return <section className="auth-card" aria-labelledby="auth-title">
    <span className="auth-icon"><Icon name={signup?'person_add':'login'}/></span>
    <h1 id="auth-title">{signup?'회원가입':'로그인'}</h1>
    <p className="auth-lead">{signup?'아이디와 비밀번호만으로 가입합니다. 이메일·전화번호·실명은 받지 않습니다.':'로그인하면 관심 주소·메모·AI 요약을 PC와 모바일에서 함께 볼 수 있어요.'}</p>
    <form onSubmit={e=>{void submit(e);}} noValidate>
      <label htmlFor="auth-username">아이디</label>
      <div className="auth-row"><input id="auth-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} value={username} onChange={e=>{setUsername(e.target.value);setError('');}} aria-describedby="username-help" required/>{signup&&<button type="button" className="ui-button" onClick={()=>{void checkUsername();}} disabled={!normalized||checked.state==='checking'}>{checked.state==='checking'?'확인 중…':'중복 확인'}</button>}</div>
      <small id="username-help" className={'auth-help '+(checked.state==='available'?'ok':checked.state==='taken'||checked.state==='error'?'bad':'')} role={checked.state==='idle'?undefined:'status'}>{checked.message??(signup?usernameRule:'')}</small>
      <label htmlFor="auth-password">비밀번호</label>
      <input id="auth-password" name="password" type="password" autoComplete={signup?'new-password':'current-password'} maxLength={128} value={password} onChange={e=>{setPassword(e.target.value);setError('');}} aria-describedby={signup?'password-help':undefined} required/>
      {signup&&<><small id="password-help" className="auth-help">{passwordRule}</small><label htmlFor="auth-confirm">비밀번호 확인</label><input id="auth-confirm" name="confirm" type="password" autoComplete="new-password" maxLength={128} value={confirm} onChange={e=>{setConfirm(e.target.value);setError('');}} required/></>}
      <label className="auth-remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>로그인 상태 유지<small>{remember?'브라우저를 닫아도 30일 동안 유지됩니다. 공용 기기에서는 사용하지 마세요.':'브라우저를 닫으면 로그아웃됩니다.'}</small></span></label>
      {error&&<p className="auth-error" role="alert">{error}</p>}
      <button type="submit" className="ui-button selected auth-submit" disabled={busy}>{busy?'처리 중…':signup?'가입하고 시작하기':'로그인'}</button>
    </form>
    <p className="auth-switch">{signup?<>이미 계정이 있나요? <Link href={'/login?next='+encodeURIComponent(next)}>로그인</Link></>:<>처음이신가요? <Link href={'/signup?next='+encodeURIComponent(next)}>회원가입</Link></>}</p>
    <p className="auth-note">로그인하지 않아도 주변 시설·교통·소음·치안·AI 요약은 그대로 이용할 수 있습니다.</p>
  </section>;
}
