import type {Coordinates} from './demo-data';
export const noiseSourceUrl='https://www.noiseinfo.or.kr/noise/data.do';
export type NoiseMetric={label:string;db:number};
export type NoisePoint={id:string;kind:'environment'|'rail';name:string;address:string;coordinates:Coordinates;distanceMeters:number;measuredPeriod:string;metrics:NoiseMetric[];source:string;sourceUrl:string};
export type NoiseResult={origin:Coordinates;radius:number;points:NoisePoint[];warnings:string[];fetchedAt:string;period:string;limited:boolean};
export const noiseDisclaimer='측정 지점의 참고값이며 선택한 집의 실제 소음이 아닙니다. 실시간 자료가 아니며 소음·위험 등급을 추정하지 않습니다.';
export function noiseDb(value:unknown):number|null{if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+(\.\d+)?$/.test(value.trim())))return null;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=200?n:null;}
