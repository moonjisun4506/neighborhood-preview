import {XMLParser} from 'fast-xml-parser';
import proj4 from 'proj4';
import csv from '@/data/noise-csv-2025.json';
import type {Coordinates} from './demo-data';
import {straightLineDistance} from './facilities';
import {noiseDb,type NoisePoint,type NoiseSourceStatus} from './noise';
const urls={rail_api:'https://www.data.go.kr/data/15164190/openapi.do',assessment_api:'https://www.data.go.kr/data/15142831/openapi.do',environment_csv:'https://www.data.go.kr/data/15065396/fileData.do'};
const utm='+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs';
const xml=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false});
type Row=Record<string,unknown>;
const object=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const list=(v:unknown):Row[]=>Array.isArray(v)?v.map(object):v?[object(v)]:[];
const normalize=(v:unknown)=>String(v??'').replace(/\s+/g,'');
class PublicNoiseError extends Error{constructor(public status:NoiseSourceStatus['status']){super(status);}}
export function publicNoiseFailure(status:number,code:string):NoiseSourceStatus['status']{
 if(status===429||['22','LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR'].includes(code))return 'rate_limited';
 if(status===401||status===403||['20','21','30','31','32','SERVICE_KEY_IS_NOT_REGISTERED_ERROR','SERVICE_ACCESS_DENIED_ERROR','DEADLINE_HAS_EXPIRED_ERROR'].includes(code))return 'auth_error';
 return 'error';
}
function credential(){let key=process.env.MOLIT_API_KEY?.trim();if(!key)throw new PublicNoiseError('config');try{if(/%[0-9a-f]{2}/i.test(key))key=decodeURIComponent(key);}catch{throw new PublicNoiseError('config');}return key;}
function parsed(text:string):Row{try{return object(JSON.parse(text));}catch{try{return object(xml.parse(text));}catch{throw new PublicNoiseError('error');}}}
async function api(url:string,params:Record<string,string>,upper=false){
 let response:Response;try{response=await fetch(url+'?'+new URLSearchParams({...params,[upper?'ServiceKey':'serviceKey']:credential()}),{cache:'no-store',signal:AbortSignal.timeout(20000)});}catch(e){if(e instanceof PublicNoiseError)throw e;throw new PublicNoiseError('error');}
 if([401,403,429].includes(response.status))throw new PublicNoiseError(publicNoiseFailure(response.status,''));
 const raw=await response.text(),body=parsed(raw),root=object(body.response??body),header=object(root.header),gateway=object(object(body.OpenAPI_ServiceResponse).cmmMsgHeader);
 const code=String(header.resultCode??gateway.returnReasonCode??'');
 if(!response.ok||code&&!['00','0','200'].includes(code)){if(code==='03')return {body:{items:[],totalCount:0}} as Row;throw new PublicNoiseError(publicNoiseFailure(response.status,code));}
 if(body.ExceptionReport||body.ServiceExceptionReport)throw new PublicNoiseError('unavailable');
 return root;
}
type Cache<T>={expires:number;value:T};const memory=new Map<string,Cache<unknown>>(),pending=new Map<string,Promise<unknown>>(),failures=new Map<string,{expires:number;error:PublicNoiseError}>();
async function cached<T>(id:string,work:()=>Promise<T>):Promise<T>{const hit=memory.get(id);if(hit&&hit.expires>Date.now())return hit.value as T;const failure=failures.get(id);if(failure&&failure.expires>Date.now())throw failure.error;const existing=pending.get(id);if(existing)return existing as Promise<T>;const task=work().then(value=>{memory.set(id,{value,expires:Date.now()+60*60*1000});if(memory.size>200)memory.delete(memory.keys().next().value!);return value;}).catch(error=>{if(error instanceof PublicNoiseError)failures.set(id,{expires:Date.now()+5*60*1000,error});throw error;}).finally(()=>pending.delete(id));pending.set(id,task);return task;}
async function railRows(){return cached('rail',async()=>{const rows:Row[]=[];for(let page=1;page<=10;page++){const root=await api('https://apis.data.go.kr/B552584/rnmsManualDataService/getRnmsInfo',{pageNo:String(page),numOfRows:'1000',returnType:'json'}),body=object(root.body),items=Array.isArray(body.items)?list(body.items):list(object(body.items).item),count=Number(body.totalCount);if(!Number.isSafeInteger(count)||count<0)throw new PublicNoiseError('error');rows.push(...items);if(rows.length>=count)return rows;if(!items.length)break;}throw new PublicNoiseError('unavailable');});}
export type OfficialRailSpot={spotCode:string;spotName:string;divName:string;lineName?:string;wgs84Lat:number;wgs84Lon:number};
export function railPoints(rows:Row[],spots:OfficialRailSpot[],origin:Coordinates,radius:number){const points:NoisePoint[]=[];let unmatched=0;
 for(const row of rows){const candidates=spots.filter(spot=>normalize(spot.spotName)===normalize(row.msrmtBrnchNm)&&normalize(spot.lineName)===normalize(row.rprsRteNm));if(candidates.length!==1){unmatched++;continue;}const spot=candidates[0],coordinates={lat:spot.wgs84Lat,lng:spot.wgs84Lon};if(!Number.isFinite(coordinates.lat)||!Number.isFinite(coordinates.lng)){unmatched++;continue;}const distanceMeters=straightLineDistance(origin,coordinates);if(distanceMeters>radius)continue;
  const year=String(row.msrmtYr),half=String(row.frhfyrShyrSeNm);if(!/^\d{4}$/.test(year)||!['상반기','하반기'].includes(half))continue;
  const metrics=[];for(const [field,label]of [['grondDdtmAvgNvl','지면 위 주간 평균'],['grond22pmMsrmtNvl','지면 위 야간 22시'],['hnefDdtmAvgNvl','최고소음도 예상층 주간 평균'],['hnef22pmMsrmtNvl','최고소음도 예상층 야간 22시']]){const db=noiseDb(row[field]);if(db!==null)metrics.push({label,db});}if(!metrics.length)continue;
  points.push({id:`RAILAPI-${spot.spotCode}-${year}-${half}`,canonicalId:'R-'+spot.spotCode,periodSort:Number(year+(half==='상반기'?'0630':'1231')),kind:'rail',network:'manual',name:spot.spotName,address:String(row.msrmtAddr??spot.divName),coordinates,distanceMeters,metrics,measuredPeriod:`${year}년 ${half} (개별 측정일 미제공 · 과거 측정값)`,source:'한국환경공단 철도소음 측정정보 API',sourceUrl:urls.rail_api});
 }return {points,unmatched};}
export function csvPoints(origin:Coordinates,radius:number):NoisePoint[]{return csv.records.flatMap(row=>{const distanceMeters=straightLineDistance(origin,row.coordinates);if(distanceMeters>radius)return [];const metrics=[];for(const [value,label]of [[row.day,'주간 평균'],[row.night,'야간 평균']]){const db=noiseDb(value);if(db!==null)metrics.push({label,db});}if(!metrics.length)return [];return [{id:`CSV-${row.spotCode}-${row.year}-${row.quarter}`,canonicalId:'EM-'+row.spotCode,periodSort:Number(row.year+String(Number(row.quarter)*3).padStart(2,'0')+'00'),kind:'environment',network:'manual',name:row.name,address:row.address,coordinates:row.coordinates,distanceMeters,metrics,measuredPeriod:`${row.year}년 ${row.quarter}분기 (CSV 과거 측정값 · 개별 측정일 미제공)`,source:'한국환경공단 환경소음 측정망 CSV',sourceUrl:urls.environment_csv} satisfies NoisePoint];}).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,8);}
export function eiaBounds(origin:Coordinates,radius:number){const [x,y]=proj4('EPSG:4326',utm,[origin.lng,origin.lat]),pad=radius*1.02;return [x-pad,y-pad,x+pad,y+pad].join(',');}
export function eiaFeatures(root:Row,origin:Coordinates,radius:number){const collection=object(root.FeatureCollection);if(!Object.hasOwn(collection,'@_numberOfFeatures'))throw new PublicNoiseError('unavailable');const members=object(collection.featureMembers);const records=list(members.NOISEVIBRATION_POINT);const points=records.flatMap(row=>{if(row.USE_YN!=='Y')return [];const point=object(object(row.the_geom).Point);if(!String(point['@_srsName']).endsWith('#32652'))return [];const position=String(point.pos).trim().split(/\s+/).map(Number);if(position.length!==2||position.some(n=>!Number.isFinite(n)))return [];const [lng,lat]=proj4(utm,'EPSG:4326',position),coordinates={lat,lng},distanceMeters=straightLineDistance(origin,coordinates);if(lat<33||lat>39||lng<124||lng>132||distanceMeters>radius)return [];return [{project:String(row.MGTNO),group:String(row.IVSTG_GB),name:String(row.IVSTG_SPOT),coordinates,distanceMeters}];});return {points,limited:Number(collection['@_numberOfFeatures'])>=100};}
async function assessment(origin:Coordinates,radius:number){return cached('eia:'+origin.lat+','+origin.lng+','+radius,async()=>{
 const root=await api('https://apis.data.go.kr/1480523/NoiseVibrationService/getInfoWFS',{srsName:'EPSG:32652',bbox:eiaBounds(origin,radius),maxFeatures:'100',resultType:'results'},true),features=eiaFeatures(root,origin,radius);
 let numeric=0,matched=0;for(const project of [...new Set(features.points.map(p=>p.project))].slice(0,3)){const attributes=await cached('eia-project:'+project,()=>api('https://apis.data.go.kr/1480523/NoiseVibrationService/getInfo',{mgtNo:project,type:'json'},true));for(const group of list(object(attributes.body).ivstgGbs))for(const spot of list(group.ivstgs)){if(!features.points.some(p=>p.project===project&&p.group===group.ivstgGb&&normalize(p.name)===normalize(spot.ivstgSpotNm)))continue;matched++;numeric+=list(spot.odrs).filter(row=>noiseDb(row.noiseVal)!==null).length;}}
 // API does not identify measured vs predicted values. Do not promote unknown survey values into measured noise or AI evidence.
 return {status:!features.points.length?'empty':features.limited?'partial':'unavailable',message:!features.points.length?'이 반경에서 반환된 환경영향평가 조사 지점이 없습니다.':`사업 조사 지점 ${features.points.length}곳, 속성 연결 ${matched}곳, 수치 ${numeric}건. ${numeric?'실측·예측 구분 필드가 없어 수치를 표시하지 않습니다.':'연결된 지점에 유효 소음 수치가 제공되지 않았습니다.'}${features.limited?' 반환 상한으로 일부 지점만 확인했습니다.':''}`} as const;
 });}
export async function publicNoise(origin:Coordinates,radius:number,spots:OfficialRailSpot[]){const points:NoisePoint[]=[],sources:NoiseSourceStatus[]=[];
 const status=(id:NoiseSourceStatus['id'],name:string,state:NoiseSourceStatus['status'],message:string)=>sources.push({id,name,status:state,message,sourceUrl:urls[id],checkedAt:new Date().toISOString()});
 const jobs=await Promise.allSettled([railRows(),assessment(origin,radius)]);
 const rail=jobs[0];if(rail.status==='fulfilled'){const result=railPoints(rail.value,spots,origin,radius);points.push(...result.points.sort((a,b)=>a.distanceMeters-b.distanceMeters||b.periodSort!-a.periodSort!).slice(0,8));status('rail_api','철도소음 API',!spots.length?'unavailable':result.points.length?'ok':'empty',`인증 성공 · 원본 ${rail.value.length}건. 반경 내 위치가 확인되는 측정값 ${result.points.length}건.${result.unmatched?' 공식 위치와 유일하게 연결되지 않은 '+result.unmatched+'건은 제외했습니다.':''}`);}else status('rail_api','철도소음 API',rail.reason instanceof PublicNoiseError?rail.reason.status:'error','공식 철도 API 조회를 완료하지 못했습니다. 자료 없음으로 판단하지 않습니다.');
 const eia=jobs[1];if(eia.status==='fulfilled')status('assessment_api','환경영향평가 조사 API',eia.value.status,eia.value.message);else status('assessment_api','환경영향평가 조사 API',eia.reason instanceof PublicNoiseError?eia.reason.status:'error','환경영향평가 API 조회를 완료하지 못했습니다. 자료 없음으로 판단하지 않습니다.');
 const environmental=csvPoints(origin,radius);points.push(...environmental);status('environment_csv','환경소음 측정망 CSV',environmental.length?'ok':'empty',`실제 다운로드한 2025년 파일 · 원본 ${csv.rawRows}행 중 위치 연결 ${csv.matchedRows}행, 불명확한 ${csv.unmatchedRows}행 제외. 반경 내 과거 측정지점 ${environmental.length}곳.`);
 return {points,sources};
}
