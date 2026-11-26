import type {AddressRecord} from './demo-data';
import {nearestFacilities,type FacilityResponse} from './facilities';
import {monthlyTransportCost,type TransitNearby,type TransitRoutes} from './transit';
import {housingTypes,type RentResult} from './rent';
import type {NoisePoint} from './noise';
import type {Evidence,SectionKey,SummaryRequest} from './ai-summary';
import {nearbyKindFact} from './nearby-stations';
export function addressEvidence(input:SummaryRequest,address:AddressRecord,facilities:{label:string;data?:FacilityResponse}[],rent:RentResult|undefined,nearby:TransitNearby|null,routes:TransitRoutes|null,noisePoint:NoisePoint|undefined):Omit<Evidence,'id'>[]{
  const facts:Omit<Evidence,'id'>[]=[];const add=(section:SectionKey,text:string,source:string)=>facts.push({section,text,source:'주소 카드 · '+source});
  const groups=facilities.map(f=>({...f,nearest:f.data?nearestFacilities(address.coordinates!,f.data.places,f.data.category,input.radius):[]}));
  const available=groups.filter(f=>f.nearest.length);
  const order=['convenience','market','medical','cafe','daiso','oliveyoung','study','print','laundry','park'];
  const main=[...available].sort((a,b)=>order.indexOf(a.data!.category)-order.indexOf(b.data!.category)).slice(0,4);
  add('overview',`${address.address}를 기준으로 반경 ${input.radius}m 안의 생활시설과 확인 가능한 교통·주거비 자료를 살펴봤습니다.`,'선택 주소·조회 조건');
  add('overview',main.length?`가까운 조회 시설은 ${main.slice(0,3).map(f=>`${f.label} 직선 약 ${Math.round(f.nearest[0].distanceMeters)}m`).join(', ')}에 있어 실제 생활 동선을 확인할 때 참고할 수 있습니다.`:'주변 생활시설의 확인 가능한 조회 결과가 부족해 생활 편의성을 판단할 수 없습니다.','카카오 실제 시설 조회');
  const fastest=(paths:TransitRoutes['outbound']['paths'])=>[...paths].filter(p=>p.minutes!==null).sort((a,b)=>a.minutes!-b.minutes!)[0];
  const out=fastest(routes?.outbound.paths??[]),back=fastest(routes?.inbound.paths??[]);
  if(out)add('overview',`등록한 ${input.destination!.address}까지 조회 경로 중 최단 소요 시간은 ${out.minutes}분이며 실제 대기·운행 상황에 따라 달라집니다.`,`${routes?.provider==='tmap'?'TMAP':'ODsay'} 조회 경로`);
  else if(rent)add('overview',`${rent.region.name}의 ${rent.month} 월세 자료는 지역 거래 참고 통계이며, 선택한 집의 계약 금액을 의미하지 않습니다.`,'국토교통부 지역 참고 통계');
  for(const f of main){const warning=f.data!.limited||f.data!.warning?'일부 반환된 결과 중 ':'';add('facilities',`${f.label}: ${warning}${f.nearest.map(p=>`${p.name}(직선 약 ${Math.round(p.distanceMeters)}m)`).join(', ')}입니다.`,'카카오 실제 시설 조회');}
  if(!main.length)add('facilities','주변 생활시설은 미확인입니다. 검색 결과가 없거나 조회가 완료되지 않은 항목은 시설이 없다고 단정할 수 없습니다.','시설 자료 미확인');
  add('facilities','시설 거리는 선택한 집 좌표 기준 직선거리이며, 보행 경로·도보 시간이나 실제 출입구까지의 거리가 아닙니다.','거리 해석 안내');
  if(nearby)for(const kind of ['bus','subway'] as const){const fact=nearbyKindFact(nearby,kind);add('transit',fact.text,fact.source);}
  if(out){const rides=out.legs.filter(l=>l.mode!=='walk'),lines=rides.map(l=>l.lines.join(' 또는 ')).filter(Boolean);const transfers=out.transfers;
    add('transit',`등록한 ${input.destination!.address}까지 조회 경로 중 최단 ${out.minutes}분이며, 노선은 ${lines.length?lines.join(' → '):'미제공'}, 환승은 ${transfers===null?'미확인':transfers+'회'}입니다.`,`${routes?.provider==='tmap'?'TMAP':'ODsay'} 조회 경로·조회 자료`);
    const cost=monthlyTransportCost(out.fare,back?.fare??null,input.days,true);add('transit',cost===null?'월 예상 교통비는 미확인입니다. 실제 가는 편·오는 편 요금이 모두 있어야 계산합니다.':`월 ${input.days}일 왕복 예상 교통비는 ${cost.toLocaleString('ko-KR')}원 (계산식: (${out.fare!.toLocaleString('ko-KR')}원 + ${back!.fare!.toLocaleString('ko-KR')}원) × ${input.days}일)이며 할인·실제 지출은 달라질 수 있습니다.`,`${routes?.provider==='tmap'?'TMAP':'ODsay'} 실제 왕복 요금·입력 일수`);
  }else add('transit','학교·직장까지의 이동 시간·노선·환승·월 교통비는 정보 없음입니다. 교통 탭에서 목적지를 등록하고 직접 경로를 조회해 주세요.','교통 자료 미확인');
  if(rent){const s=rent.statistics;add('rent',`${rent.region.name} ${rent.month.slice(0,4)}년 ${rent.month.slice(4)}월 ${housingTypes[rent.type]} 월세 거래 ${s.count}건의 월세 중앙값은 ${s.medianRent===null?'미확인':s.medianRent.toLocaleString('ko-KR')+'만원'}, 보증금 중앙값은 ${s.medianDeposit===null?'미확인':s.medianDeposit.toLocaleString('ko-KR')+'만원'}입니다.`,'국토교통부 실제 월세 통계');add('rent',`보증금 ${input.min}만원 이상${input.max===null?'(상한 없음)':', '+input.max+'만원 이하'} 조건의 지역 참고 통계이며 개별 집의 월세가 아닙니다${s.smallSample?' · 표본이 5건 미만이라 해석에 주의가 필요합니다':''}.`,'월세 조건·해석 한계');}
  else add('rent','주거비 참고 자료는 미확인입니다. 조회된 실거래 자료가 없어 월세·보증금·거래 건수를 추정하지 않습니다.','월세 자료 미확인');
  add('checks','시설 운영시간·출입구·실제 보행 동선, 채광·관리 상태·관리비·계약 조건은 현장과 계약서에서 확인해 주세요.','계약 전 추가 확인');
  add('checks','이 자료만으로 집의 실제 소음이나 치안 수준을 판단할 수 없습니다. 생활 시간대에 직접 방문해 확인해 주세요.','미확인 환경 안내');
  if(noisePoint)add('checks',`${noisePoint.source}의 ${noisePoint.name}(선택 집에서 직선 약 ${Math.round(noisePoint.distanceMeters)}m), ${noisePoint.measuredPeriod}: ${noisePoint.metrics.map(m=>m.label+' '+m.db+' dB').join(', ')}. 출처: ${noisePoint.sourceUrl}. 측정 지점의 참고값이며 집 자체의 소음이 아닙니다.`,'공식 소음 측정자료');
  return facts;
}
