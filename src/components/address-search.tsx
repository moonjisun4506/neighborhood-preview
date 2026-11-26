'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useApp} from './app-provider';
import {Icon} from './shell';
import type {AddressRecord} from '@/lib/demo-data';
type SearchResult={results:AddressRecord[];hasMore:boolean;warning?:string;error?:string};
export function AddressSearch({navigateTo='/explore'}:{navigateTo?:string}){
  const {data,update,chooseAddress,ready}=useApp();const router=useRouter();
  const [results,setResults]=useState<AddressRecord[]>([]);const [status,setStatus]=useState<'idle'|'loading'|'done'|'error'>('idle');
  const [error,setError]=useState('');const [warning,setWarning]=useState('');const [page,setPage]=useState(1);const [hasMore,setHasMore]=useState(false);
  const controller=useRef<AbortController|null>(null);const submitted=useRef('');
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function search(nextPage=1){
    const query=data.search.trim();if(!query)return;
    controller.current?.abort();const active=new AbortController();controller.current=active;
    submitted.current=query;setStatus('loading');setError('');setWarning('');if(nextPage===1)setResults([]);
    try{
      const response=await fetch('/api/locations/search?'+new URLSearchParams({q:query,page:String(nextPage)}),{signal:active.signal});
      const body:SearchResult=await response.json();if(active.signal.aborted)return;
      if(!response.ok)throw new Error(body.error||'주소를 검색하지 못했습니다. 다시 시도해 주세요.');
      setResults(previous=>nextPage===1?body.results:[...previous,...body.results.filter(a=>!previous.some(p=>p.id===a.id))]);
      setPage(nextPage);setHasMore(body.hasMore);setWarning(body.warning??'');setStatus('done');
    }catch(reason){if(active.signal.aborted)return;setError(reason instanceof Error?reason.message:'검색에 연결할 수 없습니다.');setStatus('error');}
  }
  return <section className="address-search" aria-label="주소 검색 영역"><form onSubmit={e=>{e.preventDefault();void search();}}><label htmlFor="address-query">관심 있는 집 주소, 건물명 또는 지역</label><div className="search-line"><Icon name="search"/><input id="address-query" value={data.search} maxLength={100} onChange={e=>{controller.current?.abort();update({search:e.target.value});setStatus('idle');setResults([]);setHasMore(false);}} placeholder="예: 서울 마포구 포은로 8, 홍익대학교" required/><button className="ui-button selected" disabled={!ready||!data.search.trim()||status==='loading'}>{status==='loading'?'검색 중…':'주소 검색'}</button></div></form><p className="field-help">카카오 주소·장소 검색 결과에서 기준 위치를 직접 선택하세요.</p>
    {status==='error'&&<p role="alert" className="search-error">{error}</p>}
    {(status==='done'||results.length>0)&&<div className="search-results" aria-live="polite"><h3>‘{submitted.current}’ 검색 결과</h3>{warning&&<p>{warning}</p>}{results.length?results.map(address=><button type="button" key={address.id} className="address-option" onClick={()=>{chooseAddress(address);setResults([]);setStatus('idle');router.push(navigateTo);}}><Icon name="location_on"/><span><strong>{address.label}</strong><small>{address.roadAddress||address.address}</small>{address.jibunAddress&&address.jibunAddress!==address.address&&<small>지번: {address.jibunAddress}</small>}</span><span className="example-chip">{address.lookupType==='place'?'장소':'주소'} 선택</span></button>):<p>검색 결과가 없습니다. 도로명 주소나 다른 건물명으로 다시 검색해 주세요.</p>}{hasMore&&<button type="button" className="ui-button" disabled={status==='loading'} onClick={()=>void search(page+1)}>검색 결과 더 보기</button>}</div>}
  </section>;
}
