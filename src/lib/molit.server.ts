import {RentError,parseRentXml} from './molit-xml';
import {type HousingType,type RentTrade} from './rent';
const endpoints={sh:'SHRent',rh:'RHRent',offi:'OffiRent'} as const;
const cache=new Map<string,{expires:number;trades:RentTrade[];total:number;excluded:number;retrievedAt:string}>();
export async function rentRegion(lat:number,lng:number){
  const key=process.env.KAKAO_REST_API_KEY?.trim();if(!key)throw new RentError('CONFIG','지역 확인 서버 설정이 필요합니다.',503);
  const url=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');url.search=new URLSearchParams({x:String(lng),y:String(lat)}).toString();
  const response=await fetch(url,{headers:{Authorization:`KakaoAK ${key}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new RentError('REGION','선택 주소의 법정 지역을 확인할 수 없습니다.');
  const body=await response.json();const region=body.documents?.find((d:{region_type:string;code:string})=>d.region_type==='B'&&/^\d{10}$/.test(d.code));
  if(!region?.region_1depth_name||(!region?.region_2depth_name&&!region?.code.startsWith('36110')))throw new RentError('REGION','실거래 조회가 가능한 시·군·구를 확인하지 못했습니다.',422);
  return {code:region.code.slice(0,5) as string,name:[region.region_1depth_name,region.region_2depth_name].filter(Boolean).join(' ')};
}
export async function loadRent(code:string,month:string,type:HousingType){
  let key=process.env.MOLIT_API_KEY?.trim();if(!key)throw new RentError('CONFIG','월세 정보 없음 · MOLIT_API_KEY 설정과 3종 전월세 API 활용 승인이 필요합니다.',503);
  // Accept a portal decoded or URL-encoded key, then encode exactly once.
  if(/%[0-9a-f]{2}/i.test(key)){try{key=decodeURIComponent(key);}catch{throw new RentError('CONFIG','실거래 인증키 인코딩을 확인해 주세요.',503);}}
  const identity=`${code}:${month}:${type}`,hit=cache.get(identity);if(hit&&hit.expires>Date.now())return hit;
  let total=0,excluded=0;const trades:RentTrade[]=[];let received=0;
  for(let page=1;page<=100;page++){
    const svc=endpoints[type],url=new URL(`https://apis.data.go.kr/1613000/RTMSDataSvc${svc}/getRTMSDataSvc${svc}`);
    url.search=new URLSearchParams({serviceKey:key,LAWD_CD:code,DEAL_YMD:month,pageNo:String(page),numOfRows:'1000'}).toString();
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new RentError('UPSTREAM','국토교통부 실거래 조회에 실패했습니다. 인증·승인·요청 한도를 확인해 주세요.');
    const parsed=parseRentXml(await response.text(),code,month);
    if(parsed.page!==null&&parsed.page!==page)throw new RentError('PAGE','거래 페이지 응답이 요청과 달라 통계를 제공하지 않습니다.');
    if(page>1&&parsed.total!==total)throw new RentError('CHANGED','조회 중 거래 자료가 변경되었습니다. 다시 조회해 주세요.');
    total=parsed.total;received+=parsed.itemsCount;excluded+=parsed.excluded;trades.push(...parsed.trades);
    if(received===total){if(total>0&&!trades.length)throw new RentError('FIELDS','거래의 필수 금액·지역·계약일을 확인할 수 없어 통계를 제공하지 않습니다.');const value={trades,total,excluded,retrievedAt:new Date().toISOString(),expires:Date.now()+15*60*1000};if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(identity,value);return value;}
    if(!parsed.itemsCount||received>total)break;
  }
  throw new RentError('INCOMPLETE','전체 거래 자료를 확보하지 못해 통계를 제공하지 않습니다. 다시 조회해 주세요.');
}
