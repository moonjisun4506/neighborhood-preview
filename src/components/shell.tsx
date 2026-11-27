'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {loginHref,useAuth} from './auth-provider';
import {demoNotice} from '@/lib/demo-data';
export function Icon({name}:{name:string}){return <span aria-hidden="true" className="material-symbols-outlined">{name}</span>;}
const links=[['/explore','주소 미리보기','map'],['/saved','저장한 집','bookmark'],['/compare','주소 비교','balance']];
export function Header(){const path=usePathname();return <><header className="app-header"><div className="header-inner"><Link href="/" className="brand"><span className="brand-icon"><Icon name="explore"/></span>동네 미리보기</Link><span className="brand-tag">관심 주소의 생활환경 미리보기</span><nav aria-label="주 메뉴" className="desktop-nav">{links.map(([href,label])=><Link key={href} href={href} aria-current={(path===href||(href==='/explore'&&['/','/transport','/summary'].includes(path)))?'page':undefined}>{label}</Link>)}</nav><nav className="header-shortcuts" aria-label="보관함 바로가기"><Link href="/saved">저장한 집</Link><Link href="/compare">주소 비교</Link></nav><HeaderAuth/></div></header><nav aria-label="모바일 메뉴" className="mobile-nav">{links.map(([href,label,icon])=><Link key={href} href={href} aria-current={(path===href||(href==='/explore'&&['/','/transport','/summary'].includes(path)))?'page':undefined}><Icon name={icon}/><span>{href==='/summary'?'AI 요약':label}</span></Link>)}</nav></>;}
function HeaderAuth(){
  const {auth,logout}=useAuth();const path=usePathname();const [open,setOpen]=useState(false),[error,setError]=useState('');const menu=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const close=(e:MouseEvent|KeyboardEvent)=>{if(e instanceof KeyboardEvent?e.key==='Escape':!menu.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};},[open]);
  if(auth.status==='loading')return <div className="header-auth" aria-hidden="true"/>;
  if(auth.status==='guest')return <div className="header-auth">{path!=='/login'&&<Link className="header-login" href={loginHref(path)}>로그인</Link>}{path!=='/signup'&&<Link className="header-signup" href={'/signup?next='+encodeURIComponent(path)}>회원가입</Link>}</div>;
  return <div className="header-auth" ref={menu}><button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name="account_circle"/><span>{auth.username}</span><Icon name={open?'expand_less':'expand_more'}/></button>
    {open&&<div className="user-menu" role="menu"><p><strong>{auth.username}</strong><small>{auth.persistent?'로그인 상태 유지 중':'이 브라우저 세션 동안 로그인'}</small></p><Link role="menuitem" href="/saved" onClick={()=>setOpen(false)}><Icon name="bookmark"/>저장한 집</Link><Link role="menuitem" href="/compare" onClick={()=>setOpen(false)}><Icon name="balance"/>주소 비교</Link><button type="button" role="menuitem" onClick={()=>{setError('');logout().catch(e=>setError(e.message));}}><Icon name="logout"/>로그아웃</button>{error&&<small role="alert">{error}</small>}</div>}
  </div>;
}
export function DemoBanner(){return <details className="demo-banner"><summary>데이터 출처·조회 한계</summary><span>{demoNotice}</span></details>;}
export function Footer(){return <footer className="app-footer"><div><strong>◈ 동네 미리보기</strong><p>내가 선택한 집 주소 주변의 생활환경을 미리 확인하세요.</p><p>카카오 검색 결과와 직접 작성한 메모를 구분해 표시합니다.</p></div><div><strong>데이터 안내</strong><p>시설은 카카오, 경로·도보는 TMAP, 지하철은 카카오·버스정류장은 서울시 공공데이터 조회 결과만 표시합니다. 월세는 국토교통부 지역 실거래 참고 통계입니다.</p><p>로그인하면 저장 주소·개인 메모·AI 요약·목적지가 계정에 보관되어 PC·모바일에서 함께 보입니다. 비회원 저장은 이 기기의 익명 DB 보관함에 보관됩니다.</p></div></footer>;}
