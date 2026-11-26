import type {Coordinates} from './demo-data';

export const facilityCategories = [
  ['convenience','편의점','storefront'], ['market','마트·슈퍼','shopping_cart'],
  ['daiso','다이소','shopping_bag'], ['oliveyoung','올리브영','shopping_bag'],
  ['cafe','일반 카페','local_cafe'], ['study','스터디카페','school'],
  ['print','프린트카페','print'], ['laundry','세탁소','local_laundry_service'],
  ['park','공원','park'], ['medical','병원·약국','local_hospital'],
] as const;
export type FacilityCategory = typeof facilityCategories[number][0];
export type FacilityPlace = {
  id:string;name:string;address:string;jibunAddress:string;coordinates:Coordinates;
  category:FacilityCategory;categoryName:string;distanceMeters:number;placeUrl?:string;
};
export type FacilityResponse = {
  source:'kakao';origin:Coordinates;radius:number;category:FacilityCategory;places:FacilityPlace[];
  limited:boolean;warning?:string;fetchedAt:string;
};
export function isFacilityCategory(value:string):value is FacilityCategory{return facilityCategories.some(c=>c[0]===value);}
export function straightLineDistance(a:Coordinates,b:Coordinates){
  const rad=(v:number)=>v*Math.PI/180;
  const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
  return 6371008.8*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
