import type {Coordinates} from './demo-data';
import {straightLineDistance} from './facilities';
import {validCoordinates,type TransitStation,type NearbySource,type TransitNearby} from './transit';
export const subwaySource={source:'카카오 로컬 SW8',sourceUrl:'https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-category'};
export const busSource={source:'서울특별시 정류소정보조회 서비스',sourceUrl:'https://www.data.go.kr/data/15000303/openapi.do'};
export function nearbyKindFact(data:TransitNearby,kind:'bus'|'subway'){const label=kind==='bus'?'버스정류장':'지하철역',state=data.sources?.[kind],station=data.stations.find(s=>s.kind===kind),source=state?.source??'ODsay 주변 정류장 응답';if(station)return {text:`${label} ${station.name}, 직선 약 ${Math.round(station.distanceMeters)}m${state?.status==='partial'?' · 일부 조회 결과':''}.`,source};return {text:state&&!['ok','empty'].includes(state.status)?`${label} 자료는 미확인입니다. 조회 실패·설정 필요 또는 미지원이며 정류장이 없다는 의미는 아닙니다.`:`${label}: 같은 검색 반경 내 반환된 결과가 없습니다.`,source};}
type Row=Record<string,unknown>;
function point(x:unknown,y:unknown){if(x==null||y==null||!String(x).trim()||!String(y).trim())return null;const value={lat:Number(y),lng:Number(x)};return validCoordinates(value)?value:null;}
export function publicStations(rows:unknown[],kind:'bus'|'subway',origin:Coordinates,radius:number):TransitStation[]{
 const result:TransitStation[]=[],seen=new Set<string>(),source=kind==='bus'?busSource:subwaySource;
 for(const value of rows){if(!value||typeof value!=='object')continue;const row=value as Row,id=kind==='bus'?row.stationId:row.id,name=kind==='bus'?row.stationNm:row.place_name,coordinates=kind==='bus'?point(row.gpsX,row.gpsY):point(row.x,row.y);if(id==null||!String(id).trim()||typeof name!=='string'||!name.trim()||!coordinates||kind==='subway'&&row.category_group_code!=='SW8')continue;const key=(kind==='bus'?'seoul-bus-':'kakao-subway-')+String(id),distanceMeters=straightLineDistance(origin,coordinates);if(seen.has(key)||distanceMeters>radius)continue;seen.add(key);result.push({id:key,name,kind,coordinates,distanceMeters,lineName:null,arsId:kind==='bus'&&row.arsId!=null?String(row.arsId):null,...source});}
 return result.sort((a,b)=>a.distanceMeters-b.distanceMeters||a.id.localeCompare(b.id));
}
export class NearbyError extends Error{constructor(public status:NearbySource['status'],message:string,public code?:string){super(message);}}
export function seoulBusRows(body:unknown):unknown[]{
 if(!body||typeof body!=='object')throw new NearbyError('unavailable','서울시 응답 형식을 확인하지 못했습니다.');const root=body as Row,b=(root.ServiceResult??root) as Row,header=b.msgHeader as Row|undefined;
 if(!header||header.headerCd==null)throw new NearbyError('unavailable','서울시 응답 상태를 확인하지 못했습니다.');const code=String(header.headerCd),message=String(header.headerMsg??'');
 if(code!=='0'){
  if(/인증|service.?key|등록되지|유효.*키/i.test(message))throw new NearbyError('auth_error','서울시 버스 API 인증키 또는 활용 승인 상태를 확인해 주세요.',code);
  if(/권한|승인|접근.*허용/i.test(message))throw new NearbyError('permission_error','서울시 정류소 API 이용 권한이 필요합니다.',code);
  if(/초과|한도|quota|limit/i.test(message))throw new NearbyError('rate_limited','서울시 버스 API 호출 제한입니다. 자동 재시도하지 않습니다.',code);
  if(/결과.*없|데이터.*없|no (?:data|result)/i.test(message))return [];
  throw new NearbyError('unavailable','서울시 버스 API가 조회를 처리하지 못했습니다.',/^\d{1,8}$/.test(code)?code:undefined);
 }
 const list=(b.msgBody as Row|undefined)?.itemList;if(list==null||list==='')return [];if(Array.isArray(list))return list;if(typeof list==='object')return [list];throw new NearbyError('unavailable','서울시 정류소 목록 형식을 확인하지 못했습니다.');
}
