import type {Coordinates} from './demo-data';
import {straightLineDistance} from './facilities';
import type {TransitDirection,TransitPath,TransitLeg,TransitStation} from './transit';
export type RecordValue=Record<string,unknown>;
export class OdsayError extends Error{constructor(public code:string,public status:number,message:string){super(message);}}
export const record=(value:unknown):RecordValue=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:{};
export const numberOrNull=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value:null;
const emptyCodes=new Set(['3','4','5','6','-98','-99']);
export function parseOdsayBody(value:unknown,mode:'web'|'server'){
  const body=record(value);const upstreamError=Array.isArray(body.error)?record(body.error[0]):record(body.error);
  if(body.error){
    const code=String(upstreamError.code??'UNKNOWN'),message=String(upstreamError.message??'');
    if(/ApiKeyAuthFailed|authentication|API.?KEY|인증/i.test(message))throw new OdsayError('AUTH',503,mode==='web'?'ODsay Web 인증에 실패했습니다. Web 키와 현재 접속 주소의 등록 URI를 확인해 주세요.':'ODsay Server 인증에 실패했습니다. Server 키와 서버의 공인 IP 등록을 확인해 주세요.');
    if(code==='429'||/daily.*quota/i.test(message))throw new OdsayError('QUOTA',429,'ODsay 일일 요청 한도를 초과했습니다. 자동 재시도하지 않으며 기존 캐시 결과만 사용합니다.');
    if(/quota|limit|초당|한도|초과/i.test(message))throw new OdsayError('QUOTA',429,'대중교통 요청 한도를 초과했습니다. 잠시 후 다시 조회해 주세요.');
    if(emptyCodes.has(code))return {result:null,emptyCode:code};
    throw new OdsayError('UPSTREAM',502,'대중교통 정보를 조회하지 못했습니다. 잠시 후 다시 조회해 주세요.');
  }
  if(!body.result||typeof body.result!=='object')throw new OdsayError('UPSTREAM',502,'대중교통 제공사 응답에 조회 결과가 없습니다.');
  return {result:record(body.result),emptyCode:null};
}
export function normalizeDirection(result:RecordValue|null,emptyCode:string|null):TransitDirection{
  if(!result)return {status:'no_route',paths:[],code:emptyCode??undefined,message:emptyCode==='-98'?'출발지와 목적지가 가까워 ODsay가 대중교통 경로를 제공하지 않았습니다.':'조회된 대중교통 경로가 없습니다.'};
  if(result.searchType!==undefined&&Number(result.searchType)!==0)return {status:'no_route',paths:[],message:'도시간 경로의 추가 연결 조회는 아직 지원하지 않습니다. 경로를 임의로 합치지 않습니다.'};
  const paths:TransitPath[]=[];
  for(const [index,value] of (Array.isArray(result.path)?result.path:[]).entries()){
    const path=record(value),info=record(path.info);const legs:TransitLeg[]=[];
    for(const value of Array.isArray(path.subPath)?path.subPath:[]){
      const sub=record(value),kind=Number(sub.trafficType);if(![1,2,3].includes(kind))continue;
      const lines=(Array.isArray(sub.lane)?sub.lane:[]).map(record).map(lane=>text(lane.name)??text(lane.busNo)).filter((name):name is string=>Boolean(name));
      legs.push({mode:kind===1?'subway':kind===2?'bus':'walk',minutes:numberOrNull(sub.sectionTime),lines:[...new Set(lines)],startName:text(sub.startName),endName:text(sub.endName),direction:text(sub.way),wayCode:kind===1&&(sub.wayCode===1||sub.wayCode===2)?sub.wayCode:null,distanceMeters:numberOrNull(sub.distance),stationCount:numberOrNull(sub.stationCount),startExit:text(sub.startExitNo),endExit:text(sub.endExitNo),transferDoor:text(sub.door)});
    }
    const boardings=legs.filter(leg=>leg.mode!=='walk').length;
    paths.push({id:`path-${index}`,minutes:numberOrNull(info.totalTime),fare:numberOrNull(info.payment),transfers:boardings?boardings-1:null,legs});
  }
  return paths.length?{status:'ok',paths}:{status:'no_route',paths:[],message:'조회된 대중교통 경로가 없습니다.'};
}
export function normalizeStations(result:RecordValue|null,origin:Coordinates,radius:number):TransitStation[]{
  const stations:TransitStation[]=[];const seen=new Set<string>();
  for(const value of result&&Array.isArray(result.station)?result.station:[]){
    const station=record(value),kind=Number(station.stationClass);if(![1,2].includes(kind)||!station.stationID||typeof station.stationName!=='string'||station.x==null||station.y==null||String(station.x).trim()===''||String(station.y).trim()==='')continue;
    const coordinates={lat:Number(station.y),lng:Number(station.x)};
    if(!Number.isFinite(coordinates.lat)||!Number.isFinite(coordinates.lng)||Math.abs(coordinates.lat)>90||Math.abs(coordinates.lng)>180)continue;
    const distanceMeters=straightLineDistance(origin,coordinates);if(distanceMeters>radius)continue;
    const id=`${kind}-${station.stationID}-${station.laneName??''}`;if(seen.has(id))continue;seen.add(id);
    stations.push({id,name:station.stationName,kind:kind===1?'bus':'subway',coordinates,distanceMeters,lineName:text(station.laneName),arsId:station.arsID?String(station.arsID):null});
  }return stations.sort((a,b)=>a.distanceMeters-b.distanceMeters);
}
