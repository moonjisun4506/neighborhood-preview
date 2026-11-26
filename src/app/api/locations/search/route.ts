import type {AddressRecord} from '@/lib/demo-data';

export const runtime = 'nodejs';
type Document = {id?:string;address_name?:string;road_address_name?:string;place_name?:string;place_url?:string;x?:string;y?:string;road_address?:{address_name?:string;building_name?:string};address?:{address_name?:string}};
type SearchResponse = {documents:Document[];meta?:{is_end?:boolean}};
class UpstreamError extends Error {constructor(public status:number){super('Kakao search failed');}}
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const query=(params.get('q')??'').trim();const page=Number(params.get('page')??1);
  if(!query||query.length>100||!Number.isInteger(page)||page<1||page>45)return respond({error:'검색어는 1~100자, 페이지는 1~45로 입력해 주세요.'},400);
  const key=process.env.KAKAO_REST_API_KEY?.trim();
  if(!key)return respond({error:'주소 검색 서버 설정이 필요합니다. 관리자에게 문의해 주세요.'},503);
  async function search(kind:'address'|'keyword'):Promise<SearchResponse>{
    const url=new URL(`https://dapi.kakao.com/v2/local/search/${kind}.json`);
    url.search=new URLSearchParams({query,page:String(page),size:'10'}).toString();
    const response=await fetch(url,{headers:{Authorization:`KakaoAK ${key}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new UpstreamError(response.status);
    const result=await response.json();if(!Array.isArray(result.documents))throw new UpstreamError(502);
    return result;
  }
  const responses=await Promise.allSettled([search('address'),search('keyword')]);
  const succeeded=responses.filter((r):r is PromiseFulfilledResult<SearchResponse>=>r.status==='fulfilled');
  if(!succeeded.length){
    const rateLimited=responses.some(r=>r.status==='rejected'&&r.reason instanceof UpstreamError&&r.reason.status===429);
    const unauthorized=responses.some(r=>r.status==='rejected'&&r.reason instanceof UpstreamError&&[401,403].includes(r.reason.status));
    return respond({error:rateLimited?'검색 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.':unauthorized?'카카오 검색 인증 또는 사용 권한을 확인해 주세요.':'주소 검색에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'},rateLimited?429:502);
  }
  const results:AddressRecord[]=[];const seen=new Set<string>();
  responses.forEach((response,index)=>{
    if(response.status!=='fulfilled')return;
    for(const doc of response.value.documents){
      const lat=Number(doc.y),lng=Number(doc.x);
      if(!doc.y||!doc.x||!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180)continue;
      const roadAddress=doc.road_address?.address_name||doc.road_address_name||'';
      const jibunAddress=doc.address?.address_name||doc.address_name||'';const address=roadAddress||jibunAddress;
      if(!address)continue;
      const label=doc.place_name||doc.road_address?.building_name||address;
      const identity=`${label}|${address}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
      if(seen.has(identity))continue;seen.add(identity);
      results.push({id:index===1&&doc.id?`kakao-place-${doc.id}`:`kakao-address-${lat}-${lng}`,label,address,coordinates:{lat,lng},source:'kakao',roadAddress,jibunAddress,lookupType:index===0?'address':'place',...(doc.place_url&&/^https?:\/\/place\.map\.kakao\.com\/[0-9]+$/.test(doc.place_url)?{placeUrl:doc.place_url.replace(/^http:/,'https:')}:{})});
    }
  });
  return respond({results,hasMore:page<45&&succeeded.some(r=>r.value.meta?.is_end===false),...(succeeded.length<2?{warning:'일부 검색 유형을 조회하지 못했습니다. 표시된 결과는 카카오에서 조회한 결과입니다.'}:{})});
}
