'use client';
import {useFacilities} from './facilities-provider';
import {facilityCategories} from '@/lib/facilities';
import {Button} from './ui';
export function FacilitySummary(){
  const {places,loading,available,enabled,categories}=useFacilities();
  const failed=enabled.filter(c=>categories[c]?.status==='error');
  return <><strong>{!available?'기준 주소 필요':!enabled.length?'표시 항목 없음':places.length?`표시된 ${places.length}곳`:loading?'시설 조회 중…':failed.length?'시설 조회 실패':'검색 결과 없음'}</strong><p>{available?'선택 주소 중심의 카카오 조회 결과 · 직선거리 기준':'실제 검색 결과에서 주소를 먼저 선택해 주세요.'}</p>{failed.length>0&&<p>{failed.length}개 종류 조회 실패 · 표시된 결과만 확인할 수 있습니다.</p>}</>;
}
export function FacilityResults(){
  const {places,loading,available,enabled,categories,retry,focus}=useFacilities();
  const failed=enabled.filter(c=>categories[c]?.status==='error');const partial=enabled.filter(c=>categories[c]?.response?.warning);
  const limited=enabled.some(c=>categories[c]?.response?.limited);
  const groups=facilityCategories.filter(([category])=>enabled.includes(category)).map(([category,label])=>({category,label,places:places.filter(p=>p.category===category)}));
  if(!available)return null;
  return <section className="facility-results" aria-label="주변 시설 검색 결과"><div className="facility-results-heading"><h3>주변 생활시설</h3><span>표시된 {places.length}곳</span></div>{loading&&<p role="status">선택한 시설을 조회하고 있습니다…</p>}{!enabled.length&&<p>표시할 시설 종류를 켜 주세요.</p>}{!loading&&enabled.length>0&&!places.length&&!failed.length&&<p>이 반경에서 선택한 시설의 검색 결과가 없습니다.</p>}{(failed.length>0||partial.length>0)&&<div className="facility-errors" role="alert">{failed.map(c=><p key={c}>{facilityCategories.find(x=>x[0]===c)?.[1]}: {categories[c]?.error}</p>)}{partial.map(c=><p key={c}>{facilityCategories.find(x=>x[0]===c)?.[1]}: {categories[c]?.response?.warning}</p>)}<Button onClick={retry}>실패한 시설 다시 조회</Button></div>}{limited&&<p className="field-help">카카오 검색 노출 한도로 일부 장소만 조회될 수 있습니다. 표시 수는 전체 시설 수가 아닙니다.</p>}
    <div className="facility-result-list">{groups.map(group=><section className="nearest-facility-group" data-category={group.category} key={group.category}><h4>{group.label} · 가까운 최대 2곳</h4>{group.places.map(place=><button type="button" key={place.category+'-'+place.id} className="facility-result" data-category={place.category} data-place-id={place.id} onClick={()=>focus(place.id)}><span><strong>{place.name}</strong></span><span>직선 약 {Math.round(place.distanceMeters)}m</span></button>)}{!group.places.length&&categories[group.category]?.status==='success'&&<p>검색 결과 없음</p>}</section>)}</div><p className="field-help">조회된 시설 중 종류별 가까운 2곳입니다. 직선거리이며 도보 거리·시간이 아닙니다. 지도에도 목록과 동일한 시설만 표시합니다.</p></section>;
}
