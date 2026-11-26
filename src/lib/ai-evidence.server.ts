import {GET as facilitiesGet} from '@/app/api/facilities/route';
import {GET as rentGet} from '@/app/api/rent/route';
import {facilityCategories,straightLineDistance,type FacilityResponse} from './facilities';
import {monthlyTransportCost,validCoordinates,type TransitNearby,type TransitRoutes} from './transit';
import {rentMonths,housingTypes,type RentResult} from './rent';
import {validAddress} from './saved.server';
import type {SummaryRequest,Evidence,SectionKey} from './ai-summary';
import {safetyData} from './safety.server';
import {safetyEvidenceText,safetyEvidenceSource} from './safety';
import {nearbyNoise} from './noise.server';
import {addressEvidence} from './address-evidence.server';
import {peekTmapRoutes} from './tmap.server';
import {nearbyStations} from './nearby-stations.server';
import {nearbyKindFact} from './nearby-stations';
export function validateSummaryRequest(value:unknown):value is SummaryRequest{
  if(!value||typeof value!=='object')return false;const v=value as SummaryRequest;
  return Array.isArray(v.addresses)&&v.addresses.length>=1&&v.addresses.length<=3&&new Set(v.addresses.map(a=>a?.id)).size===v.addresses.length&&v.addresses.every(a=>validAddress(a)&&a.source==='kakao'&&validCoordinates(a.coordinates))&&[300,500,1000].includes(v.radius)&&(v.destination===null||(validAddress(v.destination)&&v.destination.source==='kakao'&&validCoordinates(v.destination.coordinates)))&&Number.isInteger(v.days)&&v.days>=0&&v.days<=31&&typeof v.roundTrip==='boolean'&&rentMonths().includes(v.month)&&Object.hasOwn(housingTypes,v.type)&&Number.isSafeInteger(v.min)&&v.min>=0&&(v.max===null||(Number.isSafeInteger(v.max)&&v.max>=v.min))&&Array.isArray(v.transit)&&v.transit.length<=3;
}
function same(a:unknown,b:{lat:number;lng:number}){return validCoordinates(a)&&Math.abs(a.lat-b.lat)<1e-7&&Math.abs(a.lng-b.lng)<1e-7;}
function fresh(value:unknown){return typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.now()-Date.parse(value)>=-60000&&Date.now()-Date.parse(value)<24*60*60*1000;}
function cleanNearby(value:TransitNearby|null,origin:{lat:number;lng:number},radius:number):TransitNearby|null{
  if(!value||value.provider!=='odsay'||!same(value.origin,origin)||value.radius!==radius||!fresh(value.fetchedAt)||!Array.isArray(value.stations)||value.stations.length>500)return null;
  const stations=value.stations.filter(s=>s&&['bus','subway'].includes(s.kind)&&typeof s.name==='string'&&s.name.length<=100&&validCoordinates(s.coordinates)&&straightLineDistance(origin,s.coordinates)<=radius).map(s=>({...s,distanceMeters:straightLineDistance(origin,s.coordinates)})).sort((a,b)=>a.distanceMeters-b.distanceMeters);
  return {...value,stations};
}
function cleanRoutes(value:TransitRoutes|null,origin:{lat:number;lng:number},destination:SummaryRequest['destination']):TransitRoutes|null{
  if(!value||value.provider!=='odsay'||!same(value.origin,origin)||!destination?.coordinates||!same(value.destination,destination.coordinates)||!fresh(value.fetchedAt))return null;
  for(const direction of [value.outbound,value.inbound]){
    if(!direction||!['ok','no_route','error'].includes(direction.status)||!Array.isArray(direction.paths)||direction.paths.length>100)return null;
    for(const p of direction.paths)if(!p||!(p.minutes===null||(Number.isFinite(p.minutes)&&p.minutes>=0&&p.minutes<=1440))||!(p.fare===null||(Number.isFinite(p.fare)&&p.fare>=0&&p.fare<=100000))||!Array.isArray(p.legs)||p.legs.length>30||p.legs.some(l=>!l||!['walk','bus','subway'].includes(l.mode)||!Array.isArray(l.lines)||l.lines.length>30||l.lines.some(name=>typeof name!=='string'||name.length>100)))return null;
  }return value;
}
type PublicData={facilities:{label:string;data?:FacilityResponse}[];rent?:RentResult};
const cache=new Map<string,{until:number;data:PublicData}>();
async function publicData(input:SummaryRequest,index:number):Promise<PublicData>{
  const a=input.addresses[index],origin=a.coordinates!,key=JSON.stringify([origin,input.radius,input.month,input.type,input.min,input.max]),hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.data;
  const facilities:PublicData['facilities']=[];
  for(const [category,label] of facilityCategories){try{const response=await facilitiesGet(new Request('http://internal/api/facilities?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),radius:String(input.radius),category})));facilities.push({label,...(response.ok?{data:await response.json()}:{})});}catch{facilities.push({label});}}
  let rent:RentResult|undefined;try{const response=await rentGet(new Request('http://internal/api/rent?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),month:input.month,type:input.type,minDeposit:String(input.min),maxDeposit:input.max===null?'':String(input.max)})));if(response.ok)rent=await response.json();}catch{}
  const data={facilities,rent};if(cache.size>=40)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+3*60*1000,data});return data;
}
export async function collectEvidence(input:SummaryRequest){
  const tmapExpiry:string[]=[];
  const evidence:Evidence[]=[];const add=(section:SectionKey,text:string,source:string)=>{evidence.push({id:`e${evidence.length+1}`,section,text,source});};
  const all:PublicData[]=[];
  for(let i=0;i<input.addresses.length;i++){
    const address=input.addresses[i],prefix=input.addresses.length===1?'':`${address.address}: `,data=await publicData(input,i);all.push(data);
    const available=data.facilities.filter(f=>f.data?.places.length),missing=data.facilities.filter(f=>!f.data).length;
    add('overview',`${prefix}선택 주소 반경 ${input.radius===1000?'1km':input.radius+'m'}에서 ${available.length?available.map(f=>f.label).join('·')+'의 조회 결과를 확인했습니다.':'확인 가능한 생활시설 결과가 부족합니다.'} 미조회 정보는 추가 확인이 필요합니다.`,'카카오 조회 결과·선택 조건');
    add('facilities',`${prefix}기준 주소는 ${address.address}이며, 시설 검색 반경은 ${input.radius}m입니다. 지도 화면 중심과 별개입니다.`,'선택 주소·검색 조건');
    for(const f of data.facilities){if(!f.data){add('facilities',`${prefix}${f.label} 정보 없음 · 조회에 실패해 개수와 거리를 알 수 없습니다.`,'카카오 조회 실패');continue;}
      const nearest=f.data.places[0];add('facilities',`${prefix}${f.label} 조회 ${f.data.places.length}곳${f.data.limited||f.data.warning?'(일부 결과)':''}.${nearest?` 가장 가까운 조회 장소는 ${nearest.name}, 직선 약 ${Math.round(nearest.distanceMeters)}m입니다.`:' 검색 반경 내 반환된 장소가 없습니다.'} 전체 시설 수·도보 거리·영업 여부를 보장하지 않습니다.`,'카카오 실제 시설 조회');
      if(nearest)add('benefits',`${prefix}조회된 ${f.label} 위치(${nearest.name}, 직선 약 ${Math.round(nearest.distanceMeters)}m)는 일상 동선을 확인할 때 참고할 수 있습니다. 실제 보행 경로와 운영시간은 별도 확인이 필요합니다.`,'카카오 실제 시설 조회·확인 안내');
    }
    const submitted=input.transit.find(t=>t?.addressId===address.id),nearby=submitted?.nearby?.provider==='public'&&same(submitted.nearby.origin,address.coordinates!)&&submitted.nearby.radius===input.radius?await nearbyStations(address.coordinates!,input.radius):cleanNearby(submitted?.nearby??null,address.coordinates!,input.radius),routes=submitted?.routes?.provider==='tmap'&&input.destination?.coordinates?await peekTmapRoutes(address.coordinates!,input.destination.coordinates).catch(()=>null):cleanRoutes(submitted?.routes??null,address.coordinates!,input.destination);if(routes?.provider==='tmap'&&routes.expiresAt)tmapExpiry.push(routes.expiresAt);
    if(nearby)for(const kind of ['bus','subway'] as const){const fact=nearbyKindFact(nearby,kind);add('transit',prefix+fact.text,fact.source);}else add('transit',`${prefix}주변 버스정류장·지하철역 정보 없음. 조회 실패·미조회 또는 오래된 자료이므로 추가 확인이 필요합니다.`,'교통 자료 미확인');
    const fastest=(paths:TransitRoutes['outbound']['paths'])=>[...paths].filter(p=>p.minutes!==null).sort((a,b)=>a.minutes!-b.minutes!)[0],out=fastest(routes?.outbound.paths??[]),back=fastest(routes?.inbound.paths??[]);
    if(out){add('transit',`${prefix}등록 목적지 ${input.destination!.address}까지 제공된 가는 편 경로 중 최단 ${out.minutes}분입니다. 실제 운행·대기 시간은 달라질 수 있습니다.`,`${routes?.provider==='tmap'?'TMAP':'ODsay'} 경로 응답·조회 자료`);const cost=monthlyTransportCost(out.fare,back?.fare??null,input.days,input.roundTrip);add('transit',`${prefix}월 ${input.days}일 ${input.roundTrip?'왕복':'편도'} 예상 교통비: ${cost===null?'정보 없음 · 필요한 실제 요금이 제공되지 않았습니다':cost.toLocaleString('ko-KR')+'원(제공된 요금 기준)'}.`,`${routes?.provider==='tmap'?'TMAP':'ODsay'} 실제 요금·입력 일수 계산`);}
    else add('transit',`${prefix}학교·직장 이동 시간과 교통비는 정보 없음. 등록 목적지와 실제 경로·요금 조회를 추가로 확인해 주세요.`,'경로·요금 자료 미확인');
    if(data.rent){const r=data.rent,s=r.statistics;add('rent',`${prefix}${r.region.name}의 ${r.month.slice(0,4)}년 ${r.month.slice(4)}월 ${housingTypes[r.type]} 월세 거래 ${s.count}건. 월세 중앙값 ${s.medianRent===null?'정보 없음':s.medianRent.toLocaleString('ko-KR')+'만원'}, 보증금 중앙값 ${s.medianDeposit===null?'정보 없음':s.medianDeposit.toLocaleString('ko-KR')+'만원'}. ${s.smallSample?'표본 부족(5건 미만). ':''}보증금 ${input.min}만원 이상${input.max===null?'(상한 없음)':`, ${input.max}만원 이하`} 조건의 지역 참고 통계이며 개별 집 월세가 아닙니다.`,'국토교통부 실제 월세 통계');}
    else add('rent',`${prefix}지역 월세 정보 없음. 실거래 조회 자료가 없어 월세·보증금·거래 건수를 추정하지 않습니다.`,'월세 자료 미확인');
    if(!available.length)add('benefits',`${prefix}생활 편의성을 설명할 시설 근거가 부족합니다. 추가 조회와 현장 확인이 필요합니다.`,'근거 부족 안내');
    if(missing)add('checks',`${prefix}생활시설 ${missing}개 종류의 조회에 실패했습니다. 미조회 항목은 다시 확인해 주세요.`,'조회 상태');
    let noisePoint:import('./noise').NoisePoint|undefined;
    try{const noise=await nearbyNoise(address.coordinates!,input.radius);noisePoint=noise.points[0];for(const point of noise.points.slice(0,2))add('checks',`${prefix}공식 소음 측정 지점 ${point.name}(선택 주소에서 직선 약 ${Math.round(point.distanceMeters)}m)의 ${point.measuredPeriod} 자료: ${point.metrics.map(m=>`${m.label} ${m.db} dB`).join(', ')}. 출처: ${point.source} (${point.sourceUrl}). 측정 지점의 과거 참고값으로, 이 집의 실제 소음·위험 등급이 아닙니다.`,'국가소음정보시스템 공식 측정자료');}catch{/* Missing or failed noise observations never become inferred noise values. */}
    if(input.addresses.length===1)for(const fact of addressEvidence(input,address,data.facilities,data.rent,nearby,routes,noisePoint))add(fact.section,fact.text,fact.source);
    try{const {result}=await safetyData(address.coordinates!),text=safetyEvidenceText(result);if(text)add('checks',prefix+text,(input.addresses.length===1?'주소 카드 · ':'')+safetyEvidenceSource);}catch{/* Only successfully received official imagery is evidence. */}
  }
  if(input.addresses.length>1){add('overview','선택한 주소들의 같은 조건에서 조회된 시설·교통·월세 정보를 비교했습니다. 주소의 순위나 거주 적합성은 판단하지 않습니다.','공통 비교 조건');
    for(let c=0;c<facilityCategories.length;c++){if(all.every(d=>d.facilities[c].data))add('facilities',`${facilityCategories[c][1]}의 같은 반경 내 조회 건수는 ${input.addresses.map((a,i)=>`${a.address} ${all[i].facilities[c].data!.places.length}곳`).join(', ')}입니다. 검색에 반환된 건수 차이이며 지역의 우열을 의미하지 않습니다.`,'카카오 동일 조건 비교');}}
  add('checks','시설 종류나 개수만으로 소음·범죄·치안·안전 수준을 판단할 수 없습니다. 소음·채광·관리 상태·보행 동선은 현장에서 직접 확인해 주세요.','계약 전 확인 안내 · 실제 환경 판정 아님');
  add('checks','시설 운영시간, 실제 통학 시간대의 배차·환승, 관리비·보증금·계약 조건은 운영기관·중개인·계약서에서 추가 확인해 주세요.','계약 전 확인 안내');
  return evidence.map(e=>e.source.includes('TMAP')&&tmapExpiry.length?{...e,expiresAt:tmapExpiry.sort()[0]}:e);
}
