'use client';
import {useEffect,useState} from 'react';
export function useDataExpiry(expiresAt?:string){const [tick,setTick]=useState(0);useEffect(()=>{if(!expiresAt)return;const update=()=>setTick(v=>v+1),timer=setTimeout(update,Math.max(0,Date.parse(expiresAt)-Date.now()));document.addEventListener('visibilitychange',update);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',update);};},[expiresAt]);void tick;return Boolean(expiresAt&&Date.parse(expiresAt)<=Date.now());}
