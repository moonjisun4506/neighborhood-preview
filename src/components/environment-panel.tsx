'use client';
import Link from 'next/link';
import {useApp} from './app-provider';
import {useFacilities} from './facilities-provider';
import {FacilityResults,FacilitySummary} from './facility-results';
import {Button,SaveButton,MemoEditor} from './ui';
import {Icon} from './shell';
import {facilityCategories} from '@/lib/facilities';
import {NoisePanel} from './noise-panel';
import {RentPanel} from './rent-panel';
import {DestinationSearch} from './destination-search';
import {TransitSummary,TransitNearbyPanel,TransitJourney,RouteSummary} from './transit-panel';
export function FacilityFilters(){
  const {data,update,selected}=useApp();const {available,categories,places}=useFacilities();
  return <div className="facility-filters"><h2><Icon name="tune"/> 주변 시설 필터</h2><p>선택 주소를 기준으로 실제 조회한 시설입니다.</p><fieldset><legend>시설 검색 반경</legend><div className="radius-options">{([300,500,1000] as const).map(r=><button key={r} type="button" aria-pressed={data.radius===r} className={'ui-button '+(data.radius===r?'selected':'')} onClick={()=>update({radius:r})}>{r===1000?'1km':r+'m'}</button>)}</div></fieldset><div className="facility-list">{facilityCategories.map(([id,label,icon])=>{
    const state=categories[id],on=data.layers.includes(id);
    const description=!on?'지도에서 숨김':!available?'기준 주소 선택 필요':!state||state.status==='loading'?'조회 중…':state.status==='error'?'조회 실패 · 재시도 가능':state.response?.places.length?`가까운 ${places.filter(p=>p.category===id).length}곳 표시${state.response.warning?' · 일부 실패':state.response.limited?' · 일부 결과':''}`:'검색 결과 없음';
    return <label key={id} data-category={id}><Icon name={icon}/><span>{label}<small>{description}</small></span><input type="checkbox" aria-label={label} checked={on} onChange={()=>update({layers:on?data.layers.filter(x=>x!==id):[...data.layers,id]})}/></label>;
  })}</div><p className="field-help">카카오의 등록 분류·명칭을 기준으로 구분합니다. 편의점의 24시간 영업 여부는 확인하지 않습니다.</p><div className="origin-note" data-testid="facility-origin" data-origin-id={selected?.id??''} data-origin-lat={selected?.coordinates?.lat??''} data-origin-lng={selected?.coordinates?.lng??''}><strong>시설 검색 기준 주소</strong><p>{selected?.address??'주소를 먼저 선택해 주세요'}</p><small>{available?`카카오 검색 좌표 ${selected!.coordinates!.lat.toFixed(6)}, ${selected!.coordinates!.lng.toFixed(6)}`:'좌표 미확인 · 시설 검색 불가'}</small><p>지도를 움직여도 기준 주소와 시설 검색 범위는 바뀌지 않습니다.</p></div></div>;
}
export function DestinationForm(){return <DestinationSearch/>;}
export function MissingInformation({compact=false}:{compact?:boolean}){const {data}=useApp();return <><div className={'information-sections '+(compact?'compact':'')}><section><h3><Icon name="storefront"/> 주변 생활시설</h3><FacilitySummary/></section><section><h3><Icon name="directions_subway"/> 주변 대중교통</h3><TransitSummary/></section><section><h3><Icon name="route"/> 학교 / 직장까지 경로</h3><RouteSummary/></section><section><h3><Icon name="payments"/> 지역별 월세 참고 통계</h3><strong>조건별 조회</strong><p>아래에서 주택 유형·보증금·계약월을 선택해 시·군·구 통계를 조회하세요.</p></section></div><FacilityResults/><TransitNearbyPanel/><RentPanel/><NoisePanel/></>;}
export function AddressDetails(){const {selected,data,toggleCompare}=useApp();return selected?<><div className="address-detail-heading"><span className="eyebrow">사용자가 선택한 기준 주소</span><h2>{selected.label}</h2><p>{selected.address}</p><span className="example-chip">{selected.source==='kakao'?'카카오 검색 결과 · 사용자가 선택한 위치':selected.source==='demo'?'UI 예시 주소 · 실제 조회 결과 아님':'직접 작성한 기록 · 좌표 미확인'}</span></div><div className="address-actions"><SaveButton id={selected.id}/><Button className={data.compare.includes(selected.id)?'selected':''} disabled={!data.compare.includes(selected.id)&&data.compare.length>=3} onClick={()=>toggleCompare(selected.id)}>{data.compare.includes(selected.id)?'비교 선택됨':'비교함 담기'} ({data.compare.length}/3)</Button></div><MissingInformation compact/><DestinationForm/><TransitJourney/><Link className="summary-link" href="/summary"><Icon name="auto_awesome"/> AI 주변 환경 요약 보기 →</Link><MemoEditor id={selected.id}/></>:<div className="empty-state"><h2>주소를 먼저 선택해 주세요</h2><Link href="/">주소 검색으로 이동 →</Link></div>;}
