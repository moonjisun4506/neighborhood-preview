import type {TransitDirection,TransitLeg} from './transit';
export const tmapTtl=23*60*60*1000;
export class TmapError extends Error{constructor(public code:string,public status:number,message:string){super(message);}}
export type WalkingRoute={provider:'tmap';status:'ok'|'no_route';distanceMeters:number|null;seconds:number|null;fetchedAt:string;expiresAt:string};
const number=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const name=(v:unknown):string|null=>typeof v==='string'&&v.trim()?v.slice(0,200):null;
export function tmapDirection(body:unknown):TransitDirection{
  const b=body as {result?:{status?:number};metaData?:{plan?:{itineraries?:unknown[]}}};const code=String(b?.result?.status??'');
  if(['11','12','13','14'].includes(code))return {status:'no_route',paths:[],code,message:'TMAP에서 이 구간의 대중교통 경로를 찾지 못했습니다.'};
  const paths=b?.metaData?.plan?.itineraries;if(!Array.isArray(paths))throw new TmapError('UPSTREAM',502,'TMAP 경로 응답 형식을 확인하지 못했습니다.');
  if(!paths.length)return {status:'no_route',paths:[],message:'조회된 대중교통 경로가 없습니다.'};
  // Unknown transport modes are not relabelled as bus/subway or silently dropped.
  return {status:'ok',paths:paths.flatMap((value,index)=>{const p=value as {legs?:Record<string,unknown>[];totalTime?:number;transferCount?:number;fare?:{regular?:{totalFare?:number;currency?:{currencyCode?:string}}}};if(!Array.isArray(p.legs)||p.legs.some(l=>!['WALK','BUS','SUBWAY'].includes(String(l.mode))))return [];
    const legs:TransitLeg[]=p.legs.map(l=>({mode:l.mode==='WALK'?'walk':l.mode==='BUS'?'bus':'subway',minutes:number(l.sectionTime)===null?null:Math.ceil(Number(l.sectionTime)/60),lines:name(l.route)?[name(l.route)!]:[],startName:name((l.start as {name?:unknown})?.name),endName:name((l.end as {name?:unknown})?.name),direction:null,distanceMeters:number(l.distance)}));
    return [{id:'tmap-'+index,minutes:number(p.totalTime)===null?null:Math.ceil(p.totalTime!/60),fare:p.fare?.regular?.currency?.currencyCode==='KRW'?number(p.fare.regular.totalFare):null,transfers:number(p.transferCount),legs}];})};
}
export function tmapWalk(body:unknown,fetchedAt:string):WalkingRoute{
  const b=body as {features?:{properties?:{totalDistance?:unknown;totalTime?:unknown}}[]};if(!Array.isArray(b?.features))throw new TmapError('UPSTREAM',502,'TMAP 보행자 응답 형식을 확인하지 못했습니다.');
  const p=b.features.find(f=>number(f.properties?.totalDistance)!==null||number(f.properties?.totalTime)!==null)?.properties;
  if(!p&&b.features.length)throw new TmapError('UPSTREAM',502,'TMAP 보행자 거리·시간을 확인하지 못했습니다.');
  return {provider:'tmap',status:b.features.length?'ok':'no_route',distanceMeters:number(p?.totalDistance),seconds:number(p?.totalTime),fetchedAt,expiresAt:new Date(Date.parse(fetchedAt)+tmapTtl).toISOString()};
}
export function tmapFresh(value:{expiresAt?:string}|null|undefined){return Boolean(value?.expiresAt&&Date.parse(value.expiresAt)>Date.now()&&Date.parse(value.expiresAt)<=Date.now()+24*60*60*1000);}
