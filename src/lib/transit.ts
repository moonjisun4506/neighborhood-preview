import type {Coordinates} from './demo-data';
export type TransitStation={id:string;name:string;kind:'bus'|'subway';coordinates:Coordinates;distanceMeters:number;lineName:string|null;arsId:string|null};
export type TransitNearby={provider:'odsay';origin:Coordinates;radius:number;stations:TransitStation[];fetchedAt:string};
export type TransitLeg={mode:'bus'|'subway'|'walk';minutes:number|null;lines:string[];startName:string|null;endName:string|null;direction?:string|null;wayCode?:1|2|null;distanceMeters?:number|null;stationCount?:number|null;startExit?:string|null;endExit?:string|null;transferDoor?:string|null};
export type TransitPath={id:string;minutes:number|null;fare:number|null;transfers:number|null;legs:TransitLeg[]};
export type TransitDirection={status:'ok'|'no_route'|'error';paths:TransitPath[];message?:string;code?:string};
export type TransitRoutes={provider:'odsay';origin:Coordinates;destination:Coordinates;outbound:TransitDirection;inbound:TransitDirection;fetchedAt:string};
export function validCoordinates(value:unknown):value is Coordinates{
  if(!value||typeof value!=='object')return false;const point=value as Coordinates;
  return typeof point.lat==='number'&&typeof point.lng==='number'&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180;
}
export function monthlyTransportCost(outboundFare:number|null,inboundFare:number|null,days:number,roundTrip:boolean):number|null{
  if(!Number.isInteger(days)||days<0||days>31||outboundFare===null||!Number.isFinite(outboundFare)||outboundFare<0)return null;
  if(roundTrip&&(inboundFare===null||!Number.isFinite(inboundFare)||inboundFare<0))return null;
  return Math.round((outboundFare+(roundTrip?inboundFare!:0))*days);
}
