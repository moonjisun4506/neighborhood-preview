import {isFacilityCategory,straightLineDistance,type FacilityCategory,type FacilityPlace} from '@/lib/facilities';

export const runtime='nodejs';
type Document={id:string;place_name:string;address_name:string;road_address_name:string;x:string;y:string;category_name:string;category_group_code:string;place_url?:string};
type Lookup={code?:string;query?:string};
const recipes:Record<FacilityCategory,Lookup[]>={
  convenience:[{code:'CS2'}],market:[{code:'MT1'},{query:'슈퍼'},{query:'마트'}],
  daiso:[{query:'다이소'}],oliveyoung:[{query:'올리브영'}],cafe:[{code:'CE7'}],
  study:[{query:'스터디카페'}],print:[{query:'프린트카페'}],
  laundry:[{query:'세탁소'},{query:'코인세탁'}],park:[{query:'공원'}],medical:[{code:'HP8'},{code:'PM9'}],
};
function matches(category:FacilityCategory,doc:Document){
  const name=doc.place_name??'',taxonomy=doc.category_name??'',text=name+' '+taxonomy;
  if(category==='cafe')return doc.category_group_code==='CE7'&&!/스터디|독서실|프린트|인쇄|출력/.test(text);
  if(category==='market')return doc.category_group_code==='MT1'||/슈퍼마켓|마트|슈퍼/.test(taxonomy);
  if(category==='daiso')return /다이소/.test(name)&&!/주차|입구|출구/.test(name);
  if(category==='oliveyoung')return /올리브영/.test(name)&&!/주차|입구|출구/.test(name);
  if(category==='study')return /스터디\s*카페/.test(text);
  if(category==='print')return /프린트\s*카페/.test(text);
  if(category==='laundry')return /세탁|빨래/.test(taxonomy);
  if(category==='park')return /공원/.test(taxonomy)&&!/주차장/.test(taxonomy);
  return true;
}
class UpstreamError extends Error{constructor(public status:number){super('Facility API failed');}}
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const lat=Number(params.get('lat')),lng=Number(params.get('lng')),radius=Number(params.get('radius')),category=params.get('category')??'';
  if(!params.get('lat')?.trim()||!params.get('lng')?.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180||![300,500,1000].includes(radius)||!isFacilityCategory(category))return respond({error:'기준 좌표, 시설 종류와 반경(300/500/1000m)을 확인해 주세요.'},400);
  const key=process.env.KAKAO_REST_API_KEY?.trim();if(!key)return respond({error:'시설 검색 서버 설정이 필요합니다.'},503);
  const origin={lat,lng};
  const lookups=await Promise.allSettled(recipes[category].map(async recipe=>{
    const documents:Document[]=[];let limited=false;let partial=false;
    // Kakao exposes at most 45 documents per search. Read all available pages.
    for(let page=1;page<=3;page++){
      try{
        const url=new URL(`https://dapi.kakao.com/v2/local/search/${recipe.code?'category':'keyword'}.json`);
        url.search=new URLSearchParams({x:String(lng),y:String(lat),radius:String(radius),sort:'distance',size:'15',page:String(page),...(recipe.code?{category_group_code:recipe.code}:{query:recipe.query!})}).toString();
        const response=await fetch(url,{headers:{Authorization:`KakaoAK ${key}`},cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});
        if(!response.ok)throw new UpstreamError(response.status);
        const body=await response.json();if(!Array.isArray(body.documents))throw new UpstreamError(502);
        documents.push(...body.documents);
        limited ||= Number(body.meta?.total_count)>Number(body.meta?.pageable_count)||page===3&&body.meta?.is_end===false;
        if(body.meta?.is_end!==false)break;
      }catch(error){if(!documents.length)throw error;partial=true;break;}
    }return {documents,limited,partial};
  }));
  const successful=lookups.filter((r):r is PromiseFulfilledResult<{documents:Document[];limited:boolean;partial:boolean}>=>r.status==='fulfilled');
  if(!successful.length){
    const rateLimited=lookups.some(r=>r.status==='rejected'&&r.reason instanceof UpstreamError&&r.reason.status===429);
    return respond({error:rateLimited?'시설 검색 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.':'시설 정보를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.'},rateLimited?429:502);
  }
  const places:FacilityPlace[]=[];const seen=new Set<string>();
  for(const {value:{documents}} of successful)for(const doc of documents){
    if(!doc?.id||!doc.place_name||!doc.x||!doc.y||seen.has(doc.id)||!matches(category,doc))continue;
    const coordinates={lat:Number(doc.y),lng:Number(doc.x)};
    if(!Number.isFinite(coordinates.lat)||!Number.isFinite(coordinates.lng)||Math.abs(coordinates.lat)>90||Math.abs(coordinates.lng)>180)continue;
    const distanceMeters=straightLineDistance(origin,coordinates);if(distanceMeters>radius)continue;
    const address=doc.road_address_name||doc.address_name;if(!address)continue;seen.add(doc.id);
    places.push({id:doc.id,name:doc.place_name,address,jibunAddress:doc.address_name,coordinates,category,categoryName:doc.category_name,distanceMeters,...(doc.place_url&&/^https?:\/\/place\.map\.kakao\.com\/[0-9]+$/.test(doc.place_url)?{placeUrl:doc.place_url.replace(/^http:/,'https:')}:{})});
  }
  places.sort((a,b)=>a.distanceMeters-b.distanceMeters);
  const partial=successful.length<lookups.length||successful.some(r=>r.value.partial);
  return respond({source:'kakao',origin,radius,category,places,limited:successful.some(r=>r.value.limited),...(partial?{warning:'일부 검색 요청이 실패했습니다. 성공한 요청에서 조회된 장소만 표시합니다.'}:{}),fetchedAt:new Date().toISOString()});
}
