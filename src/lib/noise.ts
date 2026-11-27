import type {Coordinates} from './demo-data';
import {straightLineDistance} from './facilities';
export const noiseRadiusMeters=1000;
export const noiseEmptyMessage='선택한 주소 반경 1km 이내에 확인 가능한 공식 소음 측정자료가 없습니다.';
export function noisePointsWithinRadius<T extends {coordinates:Coordinates;distanceMeters:number}>(origin:Coordinates,points:T[]):T[]{
 return points.filter(point=>point.coordinates&&Number.isFinite(point.coordinates.lat)&&Number.isFinite(point.coordinates.lng)&&Math.abs(point.coordinates.lat)<=90&&Math.abs(point.coordinates.lng)<=180).map(point=>({...point,distanceMeters:straightLineDistance(origin,point.coordinates)})).filter(point=>point.distanceMeters<=noiseRadiusMeters).sort((a,b)=>a.distanceMeters-b.distanceMeters);
}
export const noiseSourceUrl='https://www.noiseinfo.or.kr/noise/data.do';
export type NoiseMetric={label:string;db:number};
export type NoisePoint={id:string;kind:'environment'|'rail';network?:'automatic'|'manual';canonicalId?:string;periodSort?:number;name:string;address:string;coordinates:Coordinates;distanceMeters:number;measuredPeriod:string;metrics:NoiseMetric[];source:string;sourceUrl:string};
export type NoiseSourceStatus={id:'rail_api'|'assessment_api'|'environment_csv';name:string;status:'ok'|'empty'|'auth_error'|'config'|'rate_limited'|'unavailable'|'error'|'partial';message:string;sourceUrl:string;checkedAt:string};
export type NoiseReference={id:string;kind:'roadside'|'rail';name:string;coordinates:Coordinates;distanceMeters:number;lineName?:string;sourceUrl:string};
export type NoiseResult={origin:Coordinates;radius:number;points:NoisePoint[];historicalPoints?:NoisePoint[];sources?:NoiseSourceStatus[];references?:NoiseReference[];warnings:string[];fetchedAt:string;period:string;limited:boolean};
export function fixedNoiseResult(origin:Coordinates,result:NoiseResult):NoiseResult{return {...result,origin,radius:noiseRadiusMeters,points:noisePointsWithinRadius(origin,result.points),historicalPoints:noisePointsWithinRadius(origin,result.historicalPoints??[]),references:noisePointsWithinRadius(origin,result.references??[])};}
export const noiseVisitChecks=['평일 출퇴근·야간에 방문해 창문을 열고 닫았을 때의 차이를 확인하세요.','큰 도로·지상 철도와 창문 방향, 방음 상태를 현장에서 확인하세요.'];
export function noiseReferenceText(reference:NoiseReference){return `${reference.kind==='rail'?'철도':'도로변'} 공식 측정지점 ${reference.name}${reference.lineName?' ('+reference.lineName+')':''}, 선택 주소에서 직선 약 ${Math.round(reference.distanceMeters)}m. 측정지점까지의 거리이며 도로·선로까지의 거리가 아닙니다. 소음 크기나 지상·지하 여부는 판단하지 않습니다. 출처: ${reference.sourceUrl}`;}
export const noiseDisclaimer='측정 지점의 참고값이며 선택한 집의 실제 소음이 아닙니다. 실시간 자료가 아니며 소음·위험 등급을 추정하지 않습니다.';
export function noiseDb(value:unknown):number|null{if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+(\.\d+)?$/.test(value.trim())))return null;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=200?n:null;}
