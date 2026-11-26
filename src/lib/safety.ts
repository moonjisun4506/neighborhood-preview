import type {Coordinates} from './demo-data';
import {validCoordinates} from './transit';
export const safetyRadius=1000 as const;
export const safetySourceUrl='https://www.safemap.go.kr/opna/data/dataViewRenew.do?objtId=205';
export const safetySource='행정안전부 생활안전지도 · 경찰청';
export const safetyEvidenceSource='생활안전지도 공식 범죄주의구간 WMS';
export const safetyNoData='현재 확인 가능한 주변 치안 자료가 없습니다.';
export const safetyCatalog={collectionYear:'2025',updated:'2025-12-29',cycle:'1년',period:'공식 안내 수집연도 2025 · 구체적인 분석 대상 기간은 미제공'};
export type SafetyStatus='available'|'auth_error'|'permission_error'|'empty'|'rate_limited'|'unavailable'|'config_error';
export type SafetyResult={status:SafetyStatus;origin:Coordinates;radius:1000;bounds:{west:number;south:number;east:number;north:number};fetchedAt:string;code?:string;message:string;imageUrl?:string;legend?:{label:string;color:string}[];source:string;sourceUrl:string;catalog:typeof safetyCatalog};
export function safetyBounds(origin:Coordinates){const rad=Math.PI/180,angular=safetyRadius/6371008.8,dLat=angular/rad,dLng=Math.asin(Math.sin(angular)/Math.cos(origin.lat*rad))/rad;return {west:origin.lng-dLng,south:origin.lat-dLat,east:origin.lng+dLng,north:origin.lat+dLat};}
export function safetyOrigin(request:Request){const p=new URL(request.url).searchParams,origin={lat:Number(p.get('lat')),lng:Number(p.get('lng'))};return p.get('lat')?.trim()&&p.get('lng')?.trim()&&validCoordinates(origin)&&Math.abs(origin.lat)<85&&(!p.has('radius')||p.get('radius')==='1000')?origin:null;}
export function safetyEvidenceText(result:SafetyResult):string|null{return result.status==='available'?`선택 주소 기준 반경 1km를 둘러싼 사각 범위의 공식 범죄주의구간 WMS 이미지를 조회했습니다. 모서리에는 약 1.42km까지의 자료가 포함될 수 있습니다. 범죄 밀도분석을 도로상에 가공한 자료로, 개별 사건 위치·1km 안 발생 건수나 이 집의 안전·위험을 뜻하지 않습니다. 출처: ${safetySource} (${safetySourceUrl}). 기준 시점: ${safetyCatalog.period}, 안내 수정일 ${safetyCatalog.updated}, 갱신주기 ${safetyCatalog.cycle}. 이미지의 개별 주의구간 유무·밀도값을 자동 판독하거나 추정하지 않았습니다.`:null;}
