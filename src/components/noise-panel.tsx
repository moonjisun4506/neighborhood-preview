'use client';
import {useNoise} from './noise-provider';
import {noiseDisclaimer,noiseSourceUrl,type NoisePoint} from '@/lib/noise';
export function NoisePointDetails({point}:{point:NoisePoint}){return <><strong>{point.kind==='rail'?'철도':'환경'} · {point.name}</strong><p>{point.address}</p><p>선택 주소에서 직선 약 {Math.round(point.distanceMeters)}m</p><p>측정 기준: {point.measuredPeriod}</p><ul>{point.metrics.map(m=><li key={m.label}>{m.label}: <b>{m.db} dB</b></li>)}</ul><a href={point.sourceUrl} target="_blank" rel="noreferrer">출처: {point.source}</a></>;}
export function NoisePanel(){
  const {state,visible,setVisible,focus,retry}=useNoise();const result=state?.status==='success'?state.result:null,hasPoints=Boolean(result?.points.length);
  return <section className="noise-panel" aria-label="공식 소음 측정자료"><h3>소음 참고 정보</h3>
    {!state?<p>실제 주소를 검색·선택해 주세요.</p>:state.status==='loading'?<p role="status">공식 소음 자료 조회 중…</p>:<>
      {!hasPoints&&<p>해당 주소의 소음 정보는 확인할 수 없습니다</p>}
      {state.status==='error'&&<div role="alert"><p>{state.error}</p><button type="button" className="ui-button" onClick={retry}>소음 자료 다시 조회</button></div>}
      {hasPoints&&<><p>{noiseDisclaimer}</p><label><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> 소음 측정 지점 지도 표시</label>{result!.points.map(point=><article key={point.id}><NoisePointDetails point={point}/><button type="button" className="ui-button" onClick={()=>{setVisible(true);focus(point.id);}}>측정 지점 지도에서 보기</button></article>)}</>}
      <details className="noise-source-details"><summary>측정 범위·출처 확인</summary><p>선택 주소 반경 {result?.radius??'선택 범위'}m 내 환경 자동·철도 측정망의 공개 자료입니다. 집 자체의 소음·층간소음·실시간 상태는 알 수 없습니다.</p>{result&&<><p>공개 기준 기간: {result.period}</p>{!hasPoints&&<p>{result.warnings.some(w=>w.includes('실패'))?'일부 조회 실패 · 측정자료 유무는 확인할 수 없습니다.':'소음 측정자료 없음 (이 반경·공개기간의 연결된 측정망 기준)'}</p>}{result.warnings.map(w=><p className="field-help" key={w}>{w}</p>)}</>}<p>환경소음 일평균값은 주간 평균이 아닙니다. 철도 야간값은 22시 측정값이며 야간 전체 평균이 아닙니다. 조용함·보통·시끄러움 등의 등급은 제공하지 않습니다.</p><a href={noiseSourceUrl} target="_blank" rel="noreferrer">국가소음정보시스템 · 한국환경공단</a></details>
    </>}
  </section>;
}
