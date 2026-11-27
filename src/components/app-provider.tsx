'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {accountLeaving,useAuth} from './auth-provider';
import type {AiSummary} from '@/lib/ai-summary';
import {useSavedDatabase,cloudIdsKey} from './saved-database';
import {demoAddresses,legacyAddresses,facilityCategories,type AddressRecord,type Coordinates} from '@/lib/demo-data';
export type Data = {
  aiSummaries:Record<string,AiSummary>; addresses: AddressRecord[]; selectedId: string | null; saved: string[]; compare: string[];
  notes: Record<string,string>; search: string; destination: string; destinationType: string;
  radius: 300 | 500 | 1000; layers: string[]; mapCenter: Coordinates | null;
  facilityLayerVersion:number;
  destinationLocation:AddressRecord|null;commuteDays:number;commuteRoundTrip:boolean;
  legacyPreferences?: Record<string,unknown>;
};
const initial:Data={aiSummaries:{},addresses:demoAddresses,selectedId:null,saved:[],compare:[],notes:{},search:'',destination:'',destinationType:'school',radius:500,layers:facilityCategories.map(c=>c[0]),mapCenter:null,facilityLayerVersion:1,destinationLocation:null,commuteDays:20,commuteRoundTrip:true};
const Context=createContext<{data:Data;ready:boolean;update:(patch:Partial<Data>)=>void;notify:(s:string)=>void;toggleSaved:(id:string)=>void;toggleCompare:(id:string)=>void;selectAddress:(id:string)=>void;chooseAddress:(address:AddressRecord)=>void;addManualAddress:(query:string)=>string;selected:AddressRecord|undefined;storageAccount:string|null;storageStatus:string;storageError:string;storageBusy:boolean;cloudIds:string[];retryStorage:()=>Promise<void>;saveAddress:(id:string)=>Promise<boolean>;saveMemo:(id:string,memo:string)=>Promise<boolean>}>(null!);
function isAddress(v:unknown):v is AddressRecord {
  if(!v||typeof v!=='object')return false;
  const a=v as AddressRecord;
  return typeof a.id==='string'&&typeof a.label==='string'&&typeof a.address==='string'&&['demo','manual','legacy','kakao'].includes(a.source)&&(a.coordinates===null||(typeof a.coordinates?.lat==='number'&&typeof a.coordinates?.lng==='number'&&Number.isFinite(a.coordinates.lat)&&Number.isFinite(a.coordinates.lng)));
}
function readNotes(value:unknown):Record<string,string>{
  if(!value||typeof value!=='object')return {};
  return Object.fromEntries(Object.entries(value).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
}
function readLayers(value:unknown,version:unknown):string[]{
  if(!Array.isArray(value))return initial.layers;
  const layers=value.filter((id):id is string=>typeof id==='string');
  if(version===1)return layers.filter(id=>facilityCategories.some(c=>c[0]===id));
  const migrated=layers.flatMap(id=>id==='daily'?['daiso','oliveyoung']:id==='cafe'?['cafe','study']:[id]);
  return [...new Set(migrated)].filter(id=>facilityCategories.some(c=>c[0]===id));
}
export function AppProvider({children}:{children:ReactNode}){
  const [data,setData]=useState(initial);const [ready,setReady]=useState(false);const [message,setMessage]=useState('');
  useEffect(()=>{
    try {
      const raw=localStorage.getItem('neighborhood-preview-v2');
      if(raw){
        const v=JSON.parse(raw);const addresses:AddressRecord[]=Array.isArray(v.addresses)?v.addresses.filter(isAddress):demoAddresses;
        const valid=(id:unknown)=>typeof id==='string'&&addresses.some((a:AddressRecord)=>a.id===id);
        setData({...initial,addresses,selectedId:valid(v.selectedId)?v.selectedId:null,saved:Array.isArray(v.saved)?v.saved.filter(valid):[],compare:Array.isArray(v.compare)?v.compare.filter(valid).slice(0,3):[],notes:readNotes(v.notes),search:typeof v.search==='string'?v.search:'',destination:typeof v.destination==='string'?v.destination:'',destinationType:v.destinationType==='work'?'work':'school',destinationLocation:isAddress(v.destinationLocation)&&v.destinationLocation.source==='kakao'&&v.destinationLocation.coordinates?v.destinationLocation:null,commuteDays:Number.isInteger(v.commuteDays)&&v.commuteDays>=0&&v.commuteDays<=31?v.commuteDays:20,commuteRoundTrip:typeof v.commuteRoundTrip==='boolean'?v.commuteRoundTrip:true,radius:[300,500,1000].includes(v.radius)?v.radius:500,layers:readLayers(v.layers,v.facilityLayerVersion),mapCenter:v.mapCenter&&Number.isFinite(v.mapCenter.lat)&&Number.isFinite(v.mapCenter.lng)?v.mapCenter:addresses.find(a=>a.id===v.selectedId)?.coordinates??null,legacyPreferences:v.legacyPreferences});
      }else{
        const old=localStorage.getItem('neighborhood-preview-v1');
        if(old){const v=JSON.parse(old);const valid=(id:string)=>legacyAddresses.some(a=>a.id===id);setData({...initial,addresses:[...demoAddresses,...legacyAddresses],saved:Array.isArray(v.saved)?v.saved.filter(valid):[],compare:Array.isArray(v.compare)?v.compare.filter(valid).slice(0,3):[],notes:readNotes(v.notes),destination:typeof v.destination==='string'?v.destination:'',legacyPreferences:{commute:v.commute,budget:v.budget,tags:v.tags}});}
      }
    }catch{}try{const ids:string[]=JSON.parse(localStorage.getItem(cloudIdsKey)??'[]');setData(d=>({...d,saved:d.saved.filter(id=>!ids.includes(id)),compare:d.compare,notes:Object.fromEntries(Object.entries(d.notes).filter(([id])=>!ids.includes(id)))}));}catch{}setReady(true);
  },[]);
  const {auth,sessionExpired}=useAuth();
  const database=useSavedDatabase(data,setData,ready,setMessage,sessionExpired);
  // Signed in: account memos live in the DB only, so they are not written to this browser's storage.
  const accountIds=database.storageAccount?database.cloudIds:null;
  useEffect(()=>{if(ready&&!accountLeaving())try{localStorage.setItem('neighborhood-preview-v2',JSON.stringify({...data,aiSummaries:{},notes:accountIds?Object.fromEntries(Object.entries(data.notes).filter(([id])=>!accountIds.includes(id))):data.notes}));}catch{}},[data,ready,accountIds]);
  // Account settings (destination, commute days, comparison, radius) follow the user across devices.
  const settingsLoaded=useRef(false);const settings=JSON.stringify({destinationLocation:data.destinationLocation,commuteDays:data.commuteDays,commuteRoundTrip:data.commuteRoundTrip,compare:data.compare,radius:data.radius});
  const putSettings=(body:string)=>fetch('/api/account/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"settings":'+body+'}'}).then(r=>{if(r.status===401)return r.json().then(b=>{if(b.code==='SESSION_EXPIRED')sessionExpired();});}).catch(()=>{});
  useEffect(()=>{
    if(auth.status!=='user'||!database.storageAccount||database.storageStatus!=='ready'||settingsLoaded.current)return;
    fetch('/api/account/settings',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(r)).then(body=>{
      const remote=body.settings?.settings;
      if(remote)setData(d=>({...d,destinationLocation:remote.destinationLocation??null,commuteDays:remote.commuteDays,commuteRoundTrip:remote.commuteRoundTrip,radius:remote.radius,compare:(remote.compare as string[]).filter(id=>d.saved.includes(id)).slice(0,3)}));
      else void putSettings(settings);
      settingsLoaded.current=true;
    }).catch(()=>{});
  },[auth.status,database.storageAccount,database.storageStatus]);
  useEffect(()=>{if(!settingsLoaded.current||auth.status!=='user')return;const timer=setTimeout(()=>{void putSettings(settings);},700);return()=>clearTimeout(timer);
  },[settings,auth.status]);
  useEffect(()=>{if(message){const t=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(t);}},[message]);
  const update=(patch:Partial<Data>)=>setData(d=>({...d,...patch}));
  const {toggleSaved,toggleCompare}=database;
  const selectAddress=(id:string)=>setData(d=>{const address=d.addresses.find(a=>a.id===id);return address?{...d,selectedId:id,mapCenter:address.coordinates}:d;});
  const chooseAddress=(address:AddressRecord)=>setData(d=>({...d,addresses:d.addresses.some(a=>a.id===address.id)?d.addresses.map(a=>a.id===address.id?address:a):[...d.addresses,address],selectedId:address.id,mapCenter:address.coordinates}));
  const addManualAddress=(query:string)=>{
    const label=query.trim();const existing=data.addresses.find(a=>a.source==='manual'&&a.address===label);
    if(existing){selectAddress(existing.id);return existing.id;}
    const id='address-'+crypto.randomUUID();const record:AddressRecord={id,label,address:label,coordinates:null,source:'manual'};
    setData(d=>({...d,addresses:[...d.addresses,record],selectedId:id,mapCenter:null}));return id;
  };
  return <Context.Provider value={{...database,data,ready,update,notify:setMessage,toggleSaved,toggleCompare,selectAddress,chooseAddress,addManualAddress,selected:data.addresses.find(a=>a.id===data.selectedId)}}>{children}{database.storageError&&<div className="storage-notice" role="alert">{database.storageError}<button type="button" onClick={()=>{void database.retryStorage();}}>DB 연결 다시 시도</button></div>}<div role="status" className="toast" aria-live="polite">{message}</div></Context.Provider>;
}
export const useApp=()=>useContext(Context);
