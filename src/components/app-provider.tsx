'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
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
const Context=createContext<{data:Data;ready:boolean;update:(patch:Partial<Data>)=>void;notify:(s:string)=>void;toggleSaved:(id:string)=>void;toggleCompare:(id:string)=>void;selectAddress:(id:string)=>void;chooseAddress:(address:AddressRecord)=>void;addManualAddress:(query:string)=>string;selected:AddressRecord|undefined;storageStatus:string;storageError:string;storageBusy:boolean;cloudIds:string[];retryStorage:()=>Promise<void>;saveAddress:(id:string)=>Promise<boolean>;saveMemo:(id:string,memo:string)=>Promise<boolean>}>(null!);
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
  useEffect(()=>{if(ready)try{localStorage.setItem('neighborhood-preview-v2',JSON.stringify({...data,aiSummaries:{}}));}catch{}},[data,ready]);
  useEffect(()=>{if(message){const t=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(t);}},[message]);
  const update=(patch:Partial<Data>)=>setData(d=>({...d,...patch}));
  const database=useSavedDatabase(data,setData,ready,setMessage);
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
