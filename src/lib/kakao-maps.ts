'use client';
export interface LatLng {getLat():number;getLng():number;}
export interface KakaoMap {getCenter():LatLng;setCenter(position:LatLng):void;panTo(position:LatLng):void;getLevel():number;setLevel(level:number):void;relayout():void;getProjection():{pointFromCoords(position:LatLng):{x:number;y:number}};}
interface Overlay {setMap(map:KakaoMap|null):void;}
interface AbstractOverlay extends Overlay {getProjection():{pointFromCoords(position:LatLng):{x:number;y:number}};getPanels():{overlayLayer:HTMLElement};onAdd():void;draw():void;onRemove():void;}
export interface Marker extends Overlay {getPosition():LatLng;}
export interface KakaoMaps {
  load(callback:()=>void):void;
  LatLng:new(lat:number,lng:number)=>LatLng;
  Map:new(container:HTMLElement,options:{center:LatLng;level:number})=>KakaoMap;
  Marker:new(options:{position:LatLng;map?:KakaoMap;title?:string;zIndex?:number})=>Marker;
  CustomOverlay:new(options:{position:LatLng;content:HTMLElement;xAnchor?:number;yAnchor?:number;zIndex?:number;map?:KakaoMap})=>Overlay;
  AbstractOverlay:new()=>AbstractOverlay;
  Circle:new(options:{center:LatLng;radius:number;strokeWeight:number;strokeColor:string;strokeOpacity:number;strokeStyle:string;fillColor:string;fillOpacity:number;map?:KakaoMap})=>Overlay;
  event:{addListener(target:KakaoMap,event:string,listener:()=>void):void;removeListener(target:KakaoMap,event:string,listener:()=>void):void;};
}
declare global {interface Window {kakao?:{maps:KakaoMaps};}}
let pending:Promise<KakaoMaps>|undefined;
export function loadKakaoMaps():Promise<KakaoMaps>{
  if(pending)return pending;
  const key=process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim();
  if(!key)return Promise.reject(new Error('카카오 지도 JavaScript 키 설정이 필요합니다.'));
  pending=new Promise<KakaoMaps>((resolve,reject)=>{
    let settled=false;let script:HTMLScriptElement;
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){script?.remove();reject(error);}else if(window.kakao?.maps)resolve(window.kakao.maps);else reject(new Error('카카오 지도 SDK를 초기화하지 못했습니다.'));};
    const timer=setTimeout(()=>finish(new Error('지도를 불러오지 못했습니다. 네트워크와 카카오 등록 도메인을 확인한 후 다시 시도해 주세요.')),15000);
    if(window.kakao?.maps){window.kakao.maps.load(()=>finish());return;}
    script=document.createElement('script');script.id='kakao-maps-sdk';script.async=true;
    script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.onload=()=>{if(window.kakao?.maps)window.kakao.maps.load(()=>finish());else finish(new Error('지도 인증을 확인할 수 없습니다. JavaScript 키와 등록 도메인을 확인해 주세요.'));};
    script.onerror=()=>finish(new Error('지도를 불러오지 못했습니다. 네트워크와 카카오 등록 도메인을 확인해 주세요.'));
    document.head.appendChild(script);
  });
  pending.catch(()=>{pending=undefined;});return pending;
}
