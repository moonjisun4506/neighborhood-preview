'use client';
import type {TransitLeg} from '@/lib/transit';
export function JourneySteps({legs,origin,destination}:{legs:TransitLeg[];origin:string;destination:string}){
  const firstRide=legs.find(l=>l.mode!=='walk');
  return <ol className="route-legs journey-steps">
    {legs.length>0&&legs[0].mode!=='walk'&&<li className="missing-walk"><strong>출발지 → {firstRide?.startName??'첫 탑승 위치'}</strong><p>출발지 연결 도보 구간 정보가 제공되지 않았습니다.</p></li>}
    {legs.map((leg,index)=>{
      const previous=[...legs.slice(0,index)].reverse().find(l=>l.mode!=='walk'),next=legs.slice(index+1).find(l=>l.mode!=='walk');
      const direction=leg.direction??(leg.wayCode===1?'상행 (방면명 미제공)':leg.wayCode===2?'하행 (방면명 미제공)':null);
      if(leg.mode==='walk')return <li key={index} className="journey-walk"><strong>{previous?(next?'환승 도보 이동':'마지막 하차 후 목적지까지 도보'):next?'출발지에서 첫 탑승 위치까지 도보':'출발지에서 목적지까지 도보'}</strong><p>{leg.startName??previous?.endName??(previous?'이동 시작 위치 미제공':origin)} → {leg.endName??next?.startName??(next?'도착 위치 미제공':destination)}</p><small>도보 시간: {leg.minutes===null?'제공되지 않음':`${leg.minutes}분`}{leg.distanceMeters!==null&&leg.distanceMeters!==undefined?` · 도보 거리 ${Math.round(leg.distanceMeters)}m`:''}</small></li>;
      return <li key={index} className={'journey-ride '+leg.mode}><strong>{previous?'환승 후 탑승':'탑승'} · {leg.mode==='bus'?'버스':'지하철'}</strong>{previous&&<p className="transfer-location">환승 위치: {previous.endName??'직전 하차 위치 미제공'} → {leg.startName??'다음 탑승 위치 미제공'}{legs[index-1]?.mode!=='walk'&&<small>환승 이동 구간·도보 시간은 제공되지 않았습니다.</small>}</p>}<dl><div><dt>탑승 정류장·역</dt><dd>{leg.startName??'제공되지 않음'}</dd></div><div><dt>이용 노선</dt><dd>{leg.lines.length?leg.lines.join(' 또는 '):'제공되지 않음'}</dd></div><div><dt>탑승 방향</dt><dd>{direction??'제공되지 않음 · 현장 노선 표지를 확인하세요.'}</dd></div><div><dt>하차 정류장·역</dt><dd>{leg.endName??'제공되지 않음'}</dd></div></dl><small>탑승 구간 시간: {leg.minutes===null?'제공되지 않음':`${leg.minutes}분`}{leg.stationCount!==null&&leg.stationCount!==undefined?` · 이동 정거장 ${leg.stationCount}개`:''}</small>{leg.startExit&&<small>탑승역 진입 출구: {leg.startExit}번</small>}{leg.endExit&&<small>하차역 출구: {leg.endExit}번</small>}{leg.transferDoor&&<small>빠른 환승 위치 (제공값): {leg.transferDoor}</small>}</li>;
    })}
    {legs.length>0&&legs.at(-1)!.mode!=='walk'&&<li className="missing-walk"><strong>마지막 하차 → {destination}</strong><p>목적지 연결 도보 구간 정보가 제공되지 않았습니다.</p></li>}
    {!legs.length&&<li>이동 구간 정보가 제공되지 않았습니다.</li>}
  </ol>;
}
