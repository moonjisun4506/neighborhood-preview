'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useApp} from './app-provider';
import {Button} from './ui';
import {loadKakaoMaps,type KakaoMaps,type KakaoMap,type Marker} from '@/lib/kakao-maps';
import type {Coordinates} from '@/lib/demo-data';
import {useFacilities} from './facilities-provider';
import {facilityCategories,type FacilityPlace} from '@/lib/facilities';
import {useTransit} from './transit-provider';
import {useNoise} from './noise-provider';
import {NoisePointDetails} from './noise-panel';
import {noiseDisclaimer} from '@/lib/noise';
import {MemoLauncher} from './memo-panel';
import {useSafety} from './safety-provider';
import {inspectSafetyRaster} from '@/lib/safety-raster';
import {PlaceWalkingDetails} from './facility-walking';
export function AddressMap({mode='facilities'}:{mode?:'facilities'|'transport'|'summary'}){
  const {data,selected,update,ready}=useApp();const container=useRef<HTMLDivElement>(null);
  const {places:allPlaces,focusId,focus,loading:facilitiesLoading}=useFacilities();
  const {stations:allStations,focusStationId,focusStation}=useTransit();
  const places=useMemo(()=>mode==='facilities'?allPlaces:[],[mode,allPlaces]);
  const stations=useMemo(()=>mode==='facilities'?allStations:[],[mode,allStations]);
  const noise=useNoise();const noisePoints=useMemo(()=>mode==='transport'&&noise.visible?noise.state?.result?.points??[]:[],[mode,noise.visible,noise.state?.result]);const focusedNoise=noisePoints.find(p=>p.id===noise.focusId);
  const safety=useSafety();const safetyResult=safety.state?.result;
  const live=useRef({data,update,selected});live.current={data,update,selected};
  const map=useRef<KakaoMap|null>(null);const sdk=useRef<KakaoMaps|null>(null);const marker=useRef<Marker|null>(null);
  const [loaded,setLoaded]=useState(false);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);const [level,setLevel]=useState(4);
  const [markerPosition,setMarkerPosition]=useState<Coordinates|null>(null);
  const viewportCenter=useRef<Coordinates|null>(null);
  const coordinate=selected?.source==='kakao'?selected.coordinates:null;
  useEffect(()=>{
    if(!ready||!container.current)return;
    let cancelled=false;let observer:ResizeObserver|undefined;let onIdle:(()=>void)|undefined;let currentMap:KakaoMap|undefined;let maps:KakaoMaps|undefined;let resizeFrame=0;
    setLoaded(false);setError('');
    loadKakaoMaps().then(api=>{
      if(cancelled||!container.current)return;
      maps=api;sdk.current=api;const state=live.current;
      const position=state.selected?.source==='kakao'?(state.data.mapCenter??state.selected.coordinates):null;
      currentMap=new api.Map(container.current,{center:new api.LatLng(position?.lat??37.5665,position?.lng??126.9780),level:4});map.current=currentMap;
      const activeMap=currentMap;
      const initialCenter=activeMap.getCenter();viewportCenter.current={lat:initialCenter.getLat(),lng:initialCenter.getLng()};
      let dimensions={width:container.current.clientWidth,height:container.current.clientHeight};let resizing=false;
      onIdle=()=>{
        if(cancelled||resizing||!container.current||container.current.clientWidth!==dimensions.width||container.current.clientHeight!==dimensions.height)return;
        const center=activeMap.getCenter();const next={lat:center.getLat(),lng:center.getLng()};viewportCenter.current=next;const previous=live.current.data.mapCenter;
        if(!previous||Math.abs(previous.lat-next.lat)>1e-8||Math.abs(previous.lng-next.lng)>1e-8)live.current.update({mapCenter:next});
        setLevel(activeMap.getLevel());
      };
      api.event.addListener(activeMap,'idle',onIdle);
      observer=new ResizeObserver(()=>{
        resizing=true;
        const relayout=()=>{if(!container.current||cancelled||!viewportCenter.current)return;const target=viewportCenter.current;activeMap.relayout();activeMap.setCenter(new api.LatLng(target.lat,target.lng));dimensions={width:container.current.clientWidth,height:container.current.clientHeight};};
        relayout();cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{relayout();resizing=false;onIdle?.();});
      });observer.observe(container.current);
      onIdle();setLoaded(true);
    }).catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:'지도를 불러오지 못했습니다.');});
    return()=>{cancelled=true;observer?.disconnect();cancelAnimationFrame(resizeFrame);if(currentMap&&maps&&onIdle)maps.event.removeListener(currentMap,'idle',onIdle);marker.current?.setMap(null);marker.current=null;map.current=null;sdk.current=null;};
  },[ready,attempt]);
  // Only selection changes move the viewport. Map idle events never write selectedId.
  useEffect(()=>{
    const api=sdk.current,activeMap=map.current;if(!loaded||!api||!activeMap)return;
    if(!coordinate){setMarkerPosition(null);return;}
    viewportCenter.current={lat:coordinate.lat,lng:coordinate.lng};const position=new api.LatLng(coordinate.lat,coordinate.lng);activeMap.setCenter(position);
    const pin=new api.Marker({position,map:activeMap,title:'선택한 기준 주소',zIndex:10});marker.current=pin;
    const actual=pin.getPosition();setMarkerPosition({lat:actual.getLat(),lng:actual.getLng()});
    const label=document.createElement('div');label.className='kakao-origin-label';label.textContent=selected?.label??'선택한 기준 주소';
    const overlay=new api.CustomOverlay({position,content:label,map:activeMap,yAnchor:2.8,zIndex:11});
    return()=>{pin.setMap(null);overlay.setMap(null);if(marker.current===pin)marker.current=null;};
  },[loaded,selected?.id,selected?.label,coordinate?.lat,coordinate?.lng]);
  useEffect(()=>{
    const api=sdk.current,activeMap=map.current;if(!loaded||!api||!activeMap||!coordinate)return;
    const circle=new api.Circle({map:activeMap,center:new api.LatLng(coordinate.lat,coordinate.lng),radius:data.radius,strokeWeight:1,strokeColor:'#1b4332',strokeOpacity:.65,strokeStyle:'dash',fillColor:'#52b788',fillOpacity:.1});
    return()=>circle.setMap(null);
  },[loaded,coordinate?.lat,coordinate?.lng,data.radius]);
  useEffect(()=>{
    const api=sdk.current,activeMap=map.current;if(!loaded||!api||!activeMap)return;
    const groups=new Map<string,FacilityPlace[]>();
    for(const place of places){const key=`${place.category}|${place.coordinates.lat.toFixed(5)}|${place.coordinates.lng.toFixed(5)}`;groups.set(key,[...(groups.get(key)??[]),place]);}
    const overlays=[...groups.values()].map(group=>{
      const place=group[0];
      const button=document.createElement('button');button.type='button';button.className='facility-map-marker';
      button.dataset.category=place.category;button.dataset.placeId=place.id;button.dataset.placeIds=group.map(p=>p.id).join(' ');button.dataset.count=String(group.length);button.dataset.lat=String(place.coordinates.lat);button.dataset.lng=String(place.coordinates.lng);button.dataset.distance=String(place.distanceMeters);
      button.setAttribute('aria-label','시설: '+place.name+(group.length>1?` 외 ${group.length-1}곳`:''));button.title=group.map(p=>p.name).join(', ');
      const symbol=document.createElement('span');symbol.className='material-symbols-outlined';symbol.setAttribute('aria-hidden','true');symbol.textContent=facilityCategories.find(c=>c[0]===place.category)?.[2]??'place';button.appendChild(symbol);
      if(group.length>1){const count=document.createElement('span');count.className='facility-marker-count';count.textContent=String(group.length);button.appendChild(count);}
      button.onclick=()=>focus(place.id);
      return new api.CustomOverlay({map:activeMap,position:new api.LatLng(place.coordinates.lat,place.coordinates.lng),content:button,yAnchor:place.distanceMeters<25?-.3:1,zIndex:15});
    });
    return()=>overlays.forEach(overlay=>overlay.setMap(null));
  },[loaded,places,focus]);
  const focused=places.find(place=>place.id===focusId);
  const focusedStation=stations.find(station=>station.id===focusStationId);
  useEffect(()=>{if(noise.focusId){focus(null);focusStation(null);}},[noise.focusId,focus,focusStation]);
  useEffect(()=>{if(focusId||focusStationId)noise.focus(null);},[focusId,focusStationId,noise.focus]);
  useEffect(()=>{const api=sdk.current,activeMap=map.current;if(!loaded||!api||!activeMap)return;const overlays=noisePoints.map(point=>{const button=document.createElement('button');button.type='button';button.className='noise-map-marker';button.dataset.noiseId=point.id;button.setAttribute('aria-label',`소음 측정 지점: ${point.name}`);const icon=document.createElement('span');icon.className='material-symbols-outlined';icon.textContent='volume_up';icon.setAttribute('aria-hidden','true');button.appendChild(icon);button.onclick=()=>noise.focus(point.id);return new api.CustomOverlay({map:activeMap,position:new api.LatLng(point.coordinates.lat,point.coordinates.lng),content:button,yAnchor:1,zIndex:7});});return()=>overlays.forEach(o=>o.setMap(null));},[loaded,noisePoints,noise.focus]);
  useEffect(()=>{if(focusedNoise&&loaded&&sdk.current)map.current?.panTo(new sdk.current.LatLng(focusedNoise.coordinates.lat,focusedNoise.coordinates.lng));},[focusedNoise?.id,loaded]);
  useEffect(()=>{if(focusStationId)focus(null);},[focusStationId,focus]);
  useEffect(()=>{if(focusId)focusStation(null);},[focusId,focusStation]);
  useEffect(()=>{
    const api=sdk.current,activeMap=map.current;if(!loaded||!api||!activeMap)return;
    const overlays=stations.map(station=>{
      const button=document.createElement('button');button.type='button';button.className='transit-map-marker facility-station-marker';button.dataset.kind=station.kind;button.dataset.stationId=station.id;
      button.setAttribute('aria-label',`${station.kind==='bus'?'버스정류장':'지하철역'}: ${station.name}`);button.title=station.name;
      const icon=document.createElement('span');icon.className='material-symbols-outlined';icon.textContent=station.kind==='bus'?'directions_bus':'directions_subway';icon.setAttribute('aria-hidden','true');button.appendChild(icon);button.onclick=()=>focusStation(station.id);
      return new api.CustomOverlay({map:activeMap,position:new api.LatLng(station.coordinates.lat,station.coordinates.lng),content:button,yAnchor:1,zIndex:6});
    });return()=>overlays.forEach(overlay=>overlay.setMap(null));
  },[loaded,stations,focusStation]);
  useEffect(()=>{if(focusedStation&&loaded&&sdk.current)map.current?.panTo(new sdk.current.LatLng(focusedStation.coordinates.lat,focusedStation.coordinates.lng));},[focusedStation?.id,loaded]);
  useEffect(()=>{
    const api=sdk.current,activeMap=map.current;const destination=live.current.data.destinationLocation;if(!loaded||!api||!activeMap||!destination?.coordinates)return;
    const label=document.createElement('div');label.className='destination-map-label';label.textContent='목적지 · '+destination.label;
    const overlay=new api.CustomOverlay({map:activeMap,position:new api.LatLng(destination.coordinates.lat,destination.coordinates.lng),content:label,yAnchor:1,zIndex:9});return()=>overlay.setMap(null);
  },[loaded,data.destinationLocation?.id,data.destinationLocation?.coordinates?.lat,data.destinationLocation?.coordinates?.lng]);
  const coLocated=focused?places.filter(p=>p.category===focused.category&&p.coordinates.lat.toFixed(5)===focused.coordinates.lat.toFixed(5)&&p.coordinates.lng.toFixed(5)===focused.coordinates.lng.toFixed(5)):[];
  useEffect(()=>{
    if(focused&&loaded&&sdk.current)map.current?.panTo(new sdk.current.LatLng(focused.coordinates.lat,focused.coordinates.lng));
  },[focused?.id,loaded]);
  const center=data.mapCenter;
  useEffect(()=>{
    const api=sdk.current,activeMap=map.current,result=safetyResult;if(!loaded||!api||!activeMap||mode!=='transport'||!safety.visible||safety.layerError||result?.status!=='available'||!result.imageUrl)return;
    const bounds=result.bounds,wrapper=document.createElement('div');wrapper.className='safety-overlay';wrapper.dataset.radius='1000';wrapper.dataset.originLat=String(result.origin.lat);wrapper.dataset.originLng=String(result.origin.lng);const img=document.createElement('img');img.className='safety-wms-image';img.alt='공식 범죄주의구간 밀도분석 지도 · 개별 사건 위치 아님';img.width=512;img.height=512;wrapper.appendChild(img);let live=true;
    img.onerror=()=>{if(live)safety.setLayerError(true);};img.onload=()=>{if(!live)return;try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const context=canvas.getContext('2d');if(!context)throw new Error('canvas');context.drawImage(img,0,0);safety.setRaster(inspectSafetyRaster(context.getImageData(0,0,canvas.width,canvas.height).data,result.legend??[]));}catch{if(live)safety.setLayerError(true);}};img.src=result.imageUrl;
    const nw=new api.LatLng(bounds.north,bounds.west),ne=new api.LatLng(bounds.north,bounds.east),sw=new api.LatLng(bounds.south,bounds.west),se=new api.LatLng(bounds.south,bounds.east);
    class SafetyOverlay extends api.AbstractOverlay{
      onAdd(){this.getPanels().overlayLayer.appendChild(wrapper);}
      draw(){const projection=this.getProjection(),a=projection.pointFromCoords(nw),b=projection.pointFromCoords(ne),c=projection.pointFromCoords(sw),d=projection.pointFromCoords(se);const sx=(b.x-a.x)/512,sy=(b.y-a.y)/512,tx=(c.x-a.x)/512,ty=(c.y-a.y)/512;img.style.transform=`matrix(${sx},${sy},${tx},${ty},${a.x},${a.y})`;wrapper.dataset.projectionError=String(Math.hypot(b.x+c.x-a.x-d.x,b.y+c.y-a.y-d.y)/Math.max(.0001,Math.sqrt(Math.abs(sx*ty-sy*tx))));}
      onRemove(){wrapper.remove();}
    }
    const overlay=new SafetyOverlay();overlay.setMap(activeMap);const circle=new api.Circle({map:activeMap,center:new api.LatLng(result.origin.lat,result.origin.lng),radius:1000,strokeWeight:2,strokeColor:'#5b477a',strokeOpacity:.8,strokeStyle:'dash',fillColor:'#5b477a',fillOpacity:0});
    return()=>{live=false;overlay.setMap(null);circle.setMap(null);img.removeAttribute('src');};
  },[loaded,mode,safety.visible,safety.layerError,safetyResult,safety.setLayerError,safety.setRaster]);
  return <section className="address-map" aria-label="선택 주소 카카오 지도"><div className="map-demo-label">카카오맵 · {selected?.source==='kakao'?'선택한 기준 주소 고정':'주소를 검색해 기준 위치를 선택하세요'}</div><div ref={container} className="kakao-map-canvas" data-testid="map-canvas" data-map-ready={loaded} data-marker-lat={markerPosition?.lat??''} data-marker-lng={markerPosition?.lng??''} data-map-level={level}/>
    {mode==='transport'&&safety.visible&&!safety.layerError&&safetyResult?.status==='available'&&<a className="safety-map-credit" href={safetyResult.sourceUrl} target="_blank" rel="noreferrer">생활안전지도·경찰청 · 1km 기준 · 범죄주의구간(개별 사건 아님)</a>}
    {mode==='transport'&&safety.visible&&!safety.layerError&&safetyResult?.status==='available'&&Boolean(safetyResult.legend?.length)&&<div className="safety-map-legend" role="group" aria-label="범죄주의구간 공식 범례"><strong>공식 밀도분석 범례</strong><div>{safetyResult.legend!.map(item=><i key={item.label} title={item.label} style={{background:item.color}}/>)}</div><small>{safetyResult.legend![0].label} ~ {safetyResult.legend!.at(-1)!.label} · 집의 위험 등급 아님</small></div>}
    {focusedNoise&&<div className="facility-popup noise-popup" role="dialog" aria-label="소음 측정 지점 상세"><button type="button" className="facility-popup-close" aria-label="소음 상세 닫기" onClick={()=>noise.focus(null)}>×</button><NoisePointDetails point={focusedNoise}/><small>{noiseDisclaimer}</small></div>}
    {!loaded&&<div className="kakao-map-status" role={error?'alert':'status'}>{error?<><p>{error}</p><Button onClick={()=>setAttempt(v=>v+1)}>지도 다시 불러오기</Button></>:<p>카카오 지도를 불러오는 중입니다…</p>}</div>}
    <div className="map-controls"><Button disabled={!loaded||level<=1} onClick={()=>map.current?.setLevel(Math.max(1,(map.current?.getLevel()??4)-1))}>＋ 확대</Button><Button disabled={!loaded||level>=14} onClick={()=>map.current?.setLevel(Math.min(14,(map.current?.getLevel()??4)+1))}>− 축소</Button><Button disabled={!loaded||!coordinate} onClick={()=>{if(coordinate&&sdk.current)map.current?.panTo(new sdk.current.LatLng(coordinate.lat,coordinate.lng));}}>선택 주소로 복귀</Button></div>
    {focused&&<PlaceWalkingDetails place={focused} onClose={()=>focus(null)}>{coLocated.length>1&&<div className="co-located-places"><small>같은 위치의 {coLocated.length}개 장소</small>{coLocated.map(place=><button type="button" key={place.id} aria-pressed={place.id===focusId} onClick={()=>focus(place.id)}>{place.name}</button>)}</div>}</PlaceWalkingDetails>}
    {focusedStation&&<PlaceWalkingDetails place={focusedStation} onClose={()=>focusStation(null)}/>}
    {loaded&&coordinate&&<div className="facility-map-status" role="status">{mode==='facilities'?`시설 ${places.length}곳${facilitiesLoading?' · 조회 중…':''} · 정류장 ${stations.length}곳`:mode==='transport'?`소음 지점 ${noisePoints.length}곳`:'선택한 집 위치'} · 지도 기본 POI와 별개</div>}
    <div className="map-state"><div data-testid="selected-address" data-address-id={selected?.id??''}><strong>기준 주소</strong><span>{selected?.address??'선택 안 됨'}</span></div><div data-testid="map-center"><strong>지도 화면 중심</strong><span>{loaded&&center?`${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`:'지도 로딩 대기'}</span></div>{selected&&selected.source!=='kakao'&&<small>기존 미확인·예시 기록에는 기준 마커를 표시하지 않습니다. 주소를 다시 검색해 주세요.</small>}<small>지도를 드래그해도 선택한 기준 주소와 마커는 변경되지 않습니다.</small></div>
    <MemoLauncher/>
  </section>;
}
