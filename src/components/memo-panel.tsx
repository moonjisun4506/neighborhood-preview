'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {useApp} from './app-provider';
import {MemoEditor} from './ui';
const Context=createContext<{toggle:(button:HTMLElement)=>void;opened:boolean}>(null!);
export function MemoPanelProvider({children}:{children:ReactNode}){
  const {selected}=useApp(),path=usePathname();const [opened,setOpened]=useState(false),[drafts,setDrafts]=useState<Record<string,string>>({}),[position,setPosition]=useState({right:20,bottom:100});const panel=useRef<HTMLElement>(null);
  const workspace=['/','/explore','/transport','/summary'].includes(path),shown=opened&&workspace&&Boolean(selected);
  useEffect(()=>setOpened(false),[selected?.id]);
  useEffect(()=>{if(!shown)return;panel.current?.querySelector('textarea')?.focus({preventScroll:true});const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpened(false);document.getElementById('map-memo-launcher')?.focus();}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[shown]);
  function toggle(button:HTMLElement){setPosition({right:Math.max(16,Math.min(24,innerWidth-button.getBoundingClientRect().right)),bottom:88});setOpened(v=>!v);}
  function clearDraft(id:string){setDrafts(old=>{const next={...old};delete next[id];return next;});}
  return <Context.Provider value={{toggle,opened:shown}}>{children}<aside id="floating-memo-panel" ref={panel} hidden={!shown} className="floating-memo-panel" style={position} role="dialog" aria-modal="false" aria-labelledby="floating-memo-title"><header><div><strong id="floating-memo-title">집 주소 메모</strong><small>{selected?.address}</small></div><button type="button" aria-label="메모장 닫기" onClick={()=>{setOpened(false);document.getElementById('map-memo-launcher')?.focus();}}>×</button></header>{selected&&<MemoEditor key={selected.id} id={selected.id} editorIdPrefix="floating-note-" draftValue={drafts[selected.id]} onDraftChange={value=>setDrafts(old=>({...old,[selected.id]:value}))} onCommitted={()=>clearDraft(selected.id)}/>}</aside></Context.Provider>;
}
export function MemoLauncher(){const {selected}=useApp(),memo=useContext(Context);return <button type="button" id="map-memo-launcher" className="map-memo-launcher" disabled={!selected} aria-expanded={memo.opened} aria-controls="floating-memo-panel" onClick={e=>memo.toggle(e.currentTarget)}><span className="material-symbols-outlined" aria-hidden="true">edit_note</span>메모</button>;}
