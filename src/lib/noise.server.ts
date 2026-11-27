import {publicNoise} from './noise-public.server';
import {straightLineDistance} from './facilities';
import {validCoordinates} from './transit';
import type {Coordinates} from './demo-data';
import {noiseDb,noiseSourceUrl,noiseRadiusMeters,noisePointsWithinRadius,type NoisePoint,type NoiseMetric,type NoiseResult,type NoiseReference} from './noise';
// Latest confirmed publication at integration time, not the current date.
export const noisePeriod={month:'202606',year:'2026',half:'1',label:'환경: 2026년 6월 / 철도: 2026년 상반기'};
type Spot={regnName?:string;lineName?:string;localCode:string;spotCode:string;spotName:string;divName:string;wgs84Lat:number;wgs84Lon:number};
type Row=Record<string,unknown>;
const base='https://www.noiseinfo.or.kr/api/noise/';
async function official(endpoint:'getSpot'|'getData',params:Record<string,string>){const url=new URL(`${base}${endpoint}.dojson`);url.search=new URLSearchParams(params).toString();const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('공식 소음 자료 조회 실패');const body=await response.json();if((!Array.isArray(body.output)&&body.output!==null)||!Number.isSafeInteger(body.totalCnt)||body.totalCnt<0)throw new Error('공식 소음 응답 형식 변경');return body as {output:Row[]|null;output2?:Row[];totalCnt:number};}
const spotCache=new Map<string,{expires:number;spots:Spot[];limited:boolean}>();
const measurementCache=new Map<string,{expires:number;point:Omit<NoisePoint,'coordinates'|'distanceMeters'|'address'|'name'>|null}>();
async function spots(kind:'EA'|'R'|'EM'){
  const cached=spotCache.get(kind);if(cached&&cached.expires>Date.now())return cached;
  const body=await official('getSpot',{noiseType:kind,mangCode:'',localCode:''});if(!body.output?.length)throw new Error('측정 지점 목록 확인 불가');
  const records=body.output.filter(r=>typeof r.spotCode==='string'&&typeof r.spotName==='string'&&validCoordinates({lat:r.wgs84Lat,lng:r.wgs84Lon})) as unknown as Spot[];
  const result={spots:records,limited:body.totalCnt>records.length,expires:Date.now()+6*60*60*1000};spotCache.set(kind,result);return result;
}
export function measurement(kind:'EA'|'R'|'EM',spotCode:string,rows:Row[]):Omit<NoisePoint,'coordinates'|'distanceMeters'|'address'|'name'>|null{
  const valid=rows.filter(r=>r.spotCode===spotCode);let period='',metrics:NoiseMetric[]=[],periodSort=0;
  if(kind==='EA'){
    const row=valid.filter(r=>typeof r.measDt==='string'&&r.measDt.startsWith(noisePeriod.month)&&/^\d{14}$/.test(r.measDt)&&noiseDb(r.dayLeq)!==null).sort((a,b)=>String(b.measDt).localeCompare(String(a.measDt)))[0];
    if(!row)return null;const date=String(row.measDt).slice(0,8);period=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)} (일평균·실제 측정시각 미제공)`;metrics=[{label:'일평균 LEQ',db:noiseDb(row.dayLeq)!}];periodSort=Number(date);
  }else if(kind==='EM'){
    const row=valid.filter(r=>String(r.measYear)===noisePeriod.year&&/^[1-4]$/.test(String(r.quarterSect))&&(noiseDb(r.daytimeAve)!==null||noiseDb(r.nightAve)!==null)).sort((a,b)=>Number(b.quarterSect)-Number(a.quarterSect))[0];
    if(!row)return null;
    const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
    const day=date(row.hour9Dt),night=date(row.hour23Dt);periodSort=Number(String(row.measYear)+String(Number(row.quarterSect)*3).padStart(2,'0')+'00');
    period=`${row.measYear}년 ${row.quarterSect}분기 (주간 09시 기록 ${day??'측정일 미제공'} / 야간 23시 기록 ${night??'측정일 미제공'})`;
    for(const [key,label] of [['daytimeAve','주간 평균'],['nightAve','야간 평균']]){const db=noiseDb(row[key]);if(db!==null)metrics.push({label,db});}
  }else{
    const row=valid.find(r=>String(r.measYear)===noisePeriod.year&&String(r.measHalf)===noisePeriod.half);if(!row)return null;
    periodSort=Number(noisePeriod.year+(noisePeriod.half==='1'?'0630':'1231'));period=`${noisePeriod.year}년 ${noisePeriod.half==='1'?'상':'하'}반기 (개별 측정일 미제공)`;
    for(const [key,label] of [['groundDayAvg','지면 위 주간 평균'],['groundHour22','지면 위 야간 22시'],['buildingDayAvg','최고소음도 예상층 주간 평균'],['buildingHour22','최고소음도 예상층 야간 22시']]){const db=noiseDb(row[key]);if(db!==null)metrics.push({label,db});}
    if(!metrics.length)return null;
  }
  return {id:`${kind}-${spotCode}`,canonicalId:`${kind}-${spotCode}`,periodSort,kind:kind==='R'?'rail':'environment',network:kind==='EA'?'automatic':'manual',measuredPeriod:period,metrics,source:'국가소음정보시스템 · 한국환경공단',sourceUrl:noiseSourceUrl};
}
async function spotMeasurement(kind:'EA'|'R'|'EM',spot:Spot){
  const key=`${kind}:${spot.spotCode}:${noisePeriod.month}`,cached=measurementCache.get(key);if(cached&&cached.expires>Date.now())return cached.point;
  const endDay=new Date(Date.UTC(Number(noisePeriod.month.slice(0,4)),Number(noisePeriod.month.slice(4)),0)).getUTCDate();
  const params:Record<string,string>=kind==='EM'?{noiseType:kind,localCode:spot.localCode,spotCode:spot.spotCode,strDt:noisePeriod.year+'1',endDt:noisePeriod.year+'4',strYear:noisePeriod.year,endYear:noisePeriod.year,strQuarterSect:'1',endQuarterSect:'4',currentPage:'1'}:kind==='EA'?{noiseType:kind,localCode:spot.localCode,spotCode:spot.spotCode,strDt:noisePeriod.month+'01',endDt:noisePeriod.month+endDay,strHour:'',endHour:'',currentPage:'1'}:{noiseType:kind,localCode:spot.localCode,spotCode:spot.spotCode,strDt:noisePeriod.year+noisePeriod.half,endDt:noisePeriod.year+noisePeriod.half,strYear:noisePeriod.year,endYear:noisePeriod.year,strHalf:noisePeriod.half,endHalf:noisePeriod.half,currentPage:'1'};
  const body=await official('getData',params),rows=Array.isArray(body.output2)?body.output2:body.output??[];
  if(body.totalCnt>rows.length)throw new Error('소음 자료가 일부만 반환되어 측정값을 확정하지 않았습니다.');
  const point=measurement(kind,spot.spotCode,rows);if(measurementCache.size>500)measurementCache.delete(measurementCache.keys().next().value!);measurementCache.set(key,{point,expires:Date.now()+24*60*60*1000});return point;
}
export async function nearbyNoise(origin:Coordinates):Promise<NoiseResult>{
  const radius=noiseRadiusMeters;
  const points:NoisePoint[]=[],references:NoiseReference[]=[],warnings:string[]=[];let limited=false,successfulSources=0;
  for(const kind of ['EA','EM','R'] as const){try{const catalog=await spots(kind);successfulSources++;if(catalog.limited){limited=true;warnings.push('환경 측정 지점 목록의 제공 건수와 반환 건수가 달라 일부 지점이 누락될 수 있습니다.');}
    const nearest=catalog.spots.map(spot=>({spot,distance:straightLineDistance(origin,{lat:spot.wgs84Lat,lng:spot.wgs84Lon})})).filter(s=>s.distance<=radius).sort((a,b)=>a.distance-b.distance);
    for(const {spot,distance} of nearest.slice(0,3))if(kind==='R'||spot.regnName==='도로')references.push({id:kind+'-'+spot.spotCode,kind:kind==='R'?'rail':'roadside',name:spot.spotName,coordinates:{lat:spot.wgs84Lat,lng:spot.wgs84Lon},distanceMeters:distance,lineName:spot.lineName,sourceUrl:noiseSourceUrl});
    if(nearest.length>8){limited=true;warnings.push('종류별 가장 가까운 측정 지점 8곳까지만 조회했습니다.');}
    for(const {spot,distance} of nearest.slice(0,8)){try{const value=await spotMeasurement(kind,spot);if(value)points.push({...value,name:spot.spotName,address:spot.divName,coordinates:{lat:spot.wgs84Lat,lng:spot.wgs84Lon},distanceMeters:distance});}catch{warnings.push(`${spot.spotName} 측정자료 조회 실패 · 자료 유무를 확인할 수 없습니다.`);}}
  }catch{warnings.push(`${kind==='R'?'철도':kind==='EM'?'환경 수동':'환경 자동'} 소음 측정망 조회 실패 · 자료 유무를 확인할 수 없습니다.`);}}
  if(!successfulSources)limited=true;
  const extra=await publicNoise(origin,radius,spotCache.get('R')?.spots??[]);
  const newest=new Map<string,NoisePoint>(),historicalPoints:NoisePoint[]=[];
  for(const point of noisePointsWithinRadius(origin,[...points,...extra.points])){const id=point.canonicalId??point.id,old=newest.get(id);if(!old)newest.set(id,point);else if((point.periodSort??0)>(old.periodSort??0)){historicalPoints.push(old);newest.set(id,point);}else historicalPoints.push(point);}
  const displayed=[...newest.values()].sort((a,b)=>a.distanceMeters-b.distanceMeters);
  return {origin,radius,points:displayed,historicalPoints:historicalPoints.sort((a,b)=>a.distanceMeters-b.distanceMeters),sources:extra.sources,warnings:[...new Set(warnings)],limited,fetchedAt:new Date().toISOString(),references:noisePointsWithinRadius(origin,references).slice(0,3),period:noisePeriod.label+' / 환경 수동: 2026년 공개 분기별 과거 자료'};
}
