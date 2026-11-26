'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useApp} from './app-provider';
import {AddressSearch} from './address-search';
import {AddressMap} from './address-map';
import {FacilityFilters,DestinationForm} from './environment-panel';
import {FacilityResults} from './facility-results';
import {Button,SaveButton} from './ui';
import {AiSummaryPanel} from './ai-summary-panel';
import {TransitJourney,TransitNearbyPanel} from './transit-panel';
import {NoisePanel} from './noise-panel';
import {RentPanel} from './rent-panel';
export function DesignScreen({page}:{page:'home'|'explore'|'transport'|'summary'}){
  const {selected,data,toggleCompare}=useApp();const [filters,setFilters]=useState(false);
  const tab=page==='transport'?'transport':page==='summary'?'summary':'facilities';
  const path=tab==='transport'?'/transport':tab==='summary'?'/summary':'/explore';
  return <div className="preview-app"><header className="workspace-search"><AddressSearch navigateTo={path}/><div className="selected-home-strip"><div><small>현재 선택한 집 주소</small><strong>{selected?.address??'주소·건물명을 검색해 집을 선택하세요'}</strong>{selected&&selected.source!=='kakao'&&<small>기존 예시·미확인 기록 · 실제 정보를 보려면 다시 검색하세요.</small>}</div>{selected&&<div className="address-actions"><SaveButton id={selected.id}/><Button disabled={!data.compare.includes(selected.id)&&data.compare.length>=3} onClick={()=>toggleCompare(selected.id)}>{data.compare.includes(selected.id)?'비교 선택됨':'비교함 담기'} ({data.compare.length}/3)</Button></div>}</div></header>
    <nav className="workspace-tabs" role="tablist" aria-label="주소 생활환경 탭">{[['facilities','/explore','주변 시설'],['transport','/transport','교통·소음'],['summary','/summary','AI 요약']].map(([id,href,label])=><Link key={id} href={href} role="tab" id={'tab-'+id} aria-selected={tab===id} aria-controls="workspace-panel">{label}</Link>)}</nav>
    <section id="workspace-panel" role="tabpanel" aria-labelledby={'tab-'+tab} className={'preview-split tab-'+tab}>
      <div className="workspace-map"><AddressMap mode={tab}/></div>
      <aside className="workspace-side" aria-label={tab==='facilities'?'주변 시설 도구':tab==='transport'?'교통 소음 도구':'AI 요약 도구'}>
        {tab==='facilities'?<><div className="workspace-card"><button type="button" className="ui-button mobile-filter-button" aria-expanded={filters} onClick={()=>setFilters(!filters)}>시설 필터</button><div className={'workspace-filters '+(filters?'filters-open':'')}><FacilityFilters/>{filters&&<Button onClick={()=>setFilters(false)}>필터 닫기</Button>}</div></div><details className="workspace-card facility-list-disclosure"><summary>가까운 시설 · 종류별 2곳</summary><FacilityResults/></details></>:
        tab==='transport'?<><div className="workspace-card"><DestinationForm/></div><div className="workspace-card"><TransitJourney/></div><details className="workspace-card transit-disclosure"><summary>주변 버스정류장·지하철역</summary><TransitNearbyPanel/></details><details className="workspace-card noise-disclosure"><summary>주변 소음 측정자료</summary><NoisePanel/></details></>:
        <><div className="workspace-card">{selected?<AiSummaryPanel/>:<p>주소를 선택하면 실제 조회 정보를 요약할 수 있습니다.</p>}</div><details className="workspace-card rent-disclosure"><summary>월세 실거래 참고 통계</summary><RentPanel/></details></>}
      </aside>
    </section>
  </div>;
}
