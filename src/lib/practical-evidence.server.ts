import type {AddressRecord,Coordinates} from './demo-data';
import {nearestFacilities,type FacilityResponse} from './facilities';
import type {Evidence,SummaryRequest} from './ai-summary';
import type {TransitNearby,TransitRoutes} from './transit';
import {monthlyTransportCost} from './transit';
import {peekTmap} from './tmap.server';
import {tmapFresh,type WalkingRoute} from './tmap';
import {noisePointsWithinRadius,type NoiseResult} from './noise';
import type {RentResult} from './rent';

export function verifiedWalkingGroups(groups:{label:string;walks:(WalkingRoute|null)[]}[]){
  const buckets=[{limit:300,label:'도보 5분 이내'},{limit:600,label:'도보 5분 초과 10분 이내'},{limit:Infinity,label:'도보 10분 초과'}];
  return buckets.map((bucket,i)=>({...bucket,entries:groups.flatMap(g=>{
    const best=g.walks.filter((w):w is WalkingRoute=>!!w&&w.status==='ok'&&tmapFresh(w)&&w.seconds!==null).sort((a,b)=>a.seconds!-b.seconds!)[0];
    return best&&best.seconds!<=bucket.limit&&(!i||best.seconds!>buckets[i-1].limit)?[{label:g.label,walk:best}]:[];
  })}));
}

// Read-only: a summary never initiates a pedestrian or transit routing request.
export async function practicalEvidence(input:SummaryRequest,address:AddressRecord,facilities:{label:string;data?:FacilityResponse}[],nearby:TransitNearby|null,routes:TransitRoutes|null,noise?:NoiseResult,rent?:RentResult):Promise<Omit<Evidence,'id'>[]>{
  const facts:Omit<Evidence,'id'>[]=[];
  const add=(section:Evidence['section'],text:string,source:string,expiresAt?:string)=>facts.push({section,text,source:'주소 카드 · '+source,...(expiresAt?{expiresAt}:{})});
  const origin=address.coordinates!;
  const walking=async(destination:Coordinates)=>{try{const hit=await peekTmap<WalkingRoute>('walk',origin,destination);return hit?.value.status==='ok'&&tmapFresh(hit.value)&&hit.value.seconds!==null?hit.value:null;}catch{return null;}};
  const groups=await Promise.all(facilities.map(async f=>{const places=f.data?nearestFacilities(origin,f.data.places,f.data.category,input.radius):[];return {...f,places,walks:await Promise.all(places.map(p=>walking(p.coordinates)))};}));
  for(const bucket of verifiedWalkingGroups(groups)){
    const {entries}=bucket;
    if(entries.length){
      const provenance=entries.map(e=>{const group=groups.find(g=>g.label===e.label)!;const place=group.places[group.walks.indexOf(e.walk)];return `${place.name}: ${e.walk.seconds}초${e.walk.distanceMeters===null?'':', 도보 '+e.walk.distanceMeters+'m'} (${e.walk.fetchedAt} 조회)`;}).join(' · ');
      add('facilities',`${bucket.label}에 ${entries.map(e=>e.label).join(', ')}이 있어 일상 용무를 볼 때 이용할 수 있습니다.`,'카카오 실제 시설 · TMAP 확인된 도보 경로 · '+provenance,entries.map(e=>e.walk.expiresAt).sort()[0]);
    }
  }
  const unverified=groups.filter(g=>g.places.length&&!g.walks.some(Boolean));
  if(unverified.length)add('facilities',`도보 시간이 아직 확인되지 않은 ${unverified.slice(0,3).map(g=>`${g.label} ${g.places[0].name}(직선 약 ${Math.round(g.places[0].distanceMeters)}m)`).join(', ')}도 검색되었습니다.`,'카카오 실제 시설 · 도보 미확인');
  if(!facts.some(f=>f.section==='facilities'))add('facilities','확인 가능한 생활시설 자료가 부족합니다.','생활시설 미확인');
  // At most three short facility facts; a missing-time note does not displace verified facts.
  const facilityFacts=facts.filter(f=>f.section==='facilities');if(facilityFacts.length>3)facts.splice(facts.indexOf(facilityFacts[3]),1);
  const names=groups.filter(g=>g.places.length).slice(0,3).map(g=>g.label);
  add('overview',`${address.address}에서 반경 ${input.radius}m 안에 ${names.length?names.join(', ')+'의 실제 검색 결과를 확인했습니다':'확인된 생활시설 자료가 부족합니다'}.`,'선택 주소 · 카카오 조회');
  if(rent?.statistics.medianRent!==null&&rent?.statistics.medianRent!==undefined)add('overview',`${rent.region.name}의 ${rent.month} 거래 ${rent.statistics.count}건에서 월세 중앙값은 ${rent.statistics.medianRent}만원입니다. 개별 집의 월세가 아닌 선택한 주택 유형·보증금 조건의 지역 참고 통계입니다${rent.statistics.smallSample?'(표본 5건 미만)':''}.`,'국토교통부 실제 월세 통계');
  for(const kind of ['subway','bus'] as const){
    const station=nearby?.stations.filter(s=>s.kind===kind).sort((a,b)=>a.distanceMeters-b.distanceMeters)[0];if(!station)continue;
    const walk=await walking(station.coordinates);
    add('accessibility',`가장 가까운 조회 ${kind==='subway'?'지하철역':'버스정류장'}은 ${station.name}이며, ${walk?`도보 약 ${Math.ceil(walk.seconds!/60)}분`:`직선 약 ${Math.round(station.distanceMeters)}m`}입니다.${kind==='subway'?' 역 대표 좌표 기준으로, 실제 출입구까지의 동선과는 다를 수 있습니다.':''}`,walk?'공식 정류장 위치 · TMAP 확인된 도보 경로':station.source??'공식 정류장 조회',walk?.expiresAt);
  }
  if(!facts.some(f=>f.section==='accessibility'))add('accessibility','주변 지하철역·버스정류장 정보는 미확인입니다.','교통 접근성 미확인');
  const calc=input.monthlyCalculation;
  const eligible=calc?.addressId===address.id&&calc.destinationId===input.destination?.id&&calc.days===input.days;
  const out=eligible?routes?.outbound.paths.find(p=>p.id===calc.outboundId):routes?.outbound.paths[0];
  const back=eligible?routes?.inbound.paths.find(p=>p.id===calc.inboundId):undefined;
  if(out&&input.destination){
    const lines=out.legs.filter(l=>l.mode!=='walk').map(l=>l.lines.join(' 또는 ')).filter(Boolean);
    add('commute',`등록한 ${input.destination.label||input.destination.address}까지 ${out.minutes===null?'소요 시간은 미확인이며':'대중교통으로 약 '+out.minutes+'분이며'}, ${lines.length?lines.join(' → ')+'을 이용하는 경로입니다':'이용 노선은 미확인입니다'}.${out.transfers===null?'':' 환승은 '+out.transfers+'회입니다.'}`,`${routes!.provider==='tmap'?'TMAP':'ODsay'} 실제 경로`,routes?.expiresAt);
    const cost=eligible?monthlyTransportCost(out.fare,back?.fare??null,input.days,true):null;
    if(cost!==null)add('commute',`계산하신 월 ${input.days}일 왕복 기준 예상 교통비는 ${cost.toLocaleString('ko-KR')}원입니다. 실제 조회 요금 (${out.fare}원 + ${back!.fare}원) × ${input.days}일 기준입니다.`,`${routes!.provider==='tmap'?'TMAP':'ODsay'} 실제 왕복 요금 · 사용자 계산`,routes?.expiresAt);
    else add('commute','월 교통비는 실제 왕복 요금과 사용자가 계산한 이용 일수가 확인되어야 표시합니다.','월 교통비 미확인');
  }else add('commute','등록 목적지까지의 경로는 미확인입니다. 교통 탭에서 직접 경로를 조회해 주세요.','목적지 경로 미확인');
  const point=noisePointsWithinRadius(origin,noise?.points??[])[0];
  if(point)add('noise',`반경 1km 이내 가장 가까운 ${point.kind==='rail'?'철도소음':'환경소음'} 측정지점 ${point.name}(직선 약 ${Math.round(point.distanceMeters)}m)의 ${point.measuredPeriod} 자료는 ${point.metrics.map(m=>`${m.label} ${m.db} dB(A)`).join(', ')}입니다. ${point.source}의 측정지점 참고값이며 집 내부나 현재 소음이 아닙니다.`,'공식 소음 측정자료 · '+point.sourceUrl);
  else add('noise','선택한 주소 반경 1km 이내에 확인 가능한 공식 소음 측정자료가 없습니다.','소음 미확인');
  add('checks','생활할 시간대에 방문해 소음을 직접 확인하고, 계약 전 월세·관리비 조건을 확인해 주세요.','계약 전 추가 확인');
  return facts;
}
