import {createHash} from 'node:crypto';
import {XMLParser} from 'fast-xml-parser';
import type {Coordinates} from './demo-data';
import {safetyBounds,safetyCatalog,safetySource,safetySourceUrl,type SafetyResult,type SafetyStatus} from './safety';
type Entry={until:number;result:SafetyResult;image?:Buffer};
const cache=new Map<string,Entry>(),pending=new Map<string,Promise<Entry>>();
export const safetyService='IF_0087_WMS';
function namespace(){return createHash('sha256').update(process.env.SAFEMAP_API_KEY?.trim()??'').digest('hex');}
function cacheKey(origin:Coordinates){return namespace()+':'+origin.lat+':'+origin.lng;}
function keyValue(){const key=process.env.SAFEMAP_API_KEY?.trim();if(!key)return '';try{return decodeURIComponent(key);}catch{return key;}}
export function classifySafetyError(code:unknown):SafetyStatus{const c=String(code);if(['30','31','21'].includes(c))return 'auth_error';if(['20','32','33'].includes(c))return 'permission_error';if(['22','23','429'].includes(c))return 'rate_limited';if(['03','3'].includes(c))return 'empty';return 'unavailable';}
export function safetyErrorCode(bytes:Buffer):string|null{
  const text=bytes.toString('utf8');try{const body=JSON.parse(text);return body.header?.resultCode===undefined?null:String(body.header.resultCode);}catch{try{const body=new XMLParser().parse(text),header=body?.OpenAPI_ServiceResponse?.cmmMsgHeader??body?.header;return header?.returnReasonCode===undefined?null:String(header.returnReasonCode);}catch{return null;}}
}
const messages:Record<SafetyStatus,string>={available:'공식 범죄주의구간 WMS 이미지 조회 완료 · 개별 사건 위치·발생 건수 자료가 아닙니다.',auth_error:'인증 오류 · 해당 WMS 서비스의 키 등록·만료·사용신청 승인 상태를 확인해야 합니다.',permission_error:'이용 권한 부족 · 해당 데이터 사용승인과 호출 서버/IP 등록 조건을 확인해야 합니다.',empty:'공식 응답에 조회 자료 없음이 표시되었습니다. 안전한 지역이라는 뜻이 아닙니다.',rate_limited:'호출 제한 · 자동 재시도하지 않습니다. 제공사 한도 회복 후 확인해 주세요.',unavailable:'공식 서비스 응답을 확인하지 못했습니다. 자료 없음이나 안전으로 판단하지 않습니다.',config_error:'서버의 SAFEMAP_API_KEY 설정이 필요합니다.'};
export async function safetyData(origin:Coordinates):Promise<Entry>{
  const id=cacheKey(origin),hit=cache.get(id);if(hit&&hit.until>Date.now())return hit;if(pending.has(id))return pending.get(id)!;
  const task=(async()=>{
    const bounds=safetyBounds(origin),base={origin,radius:1000 as const,bounds,fetchedAt:new Date().toISOString(),source:safetySource,sourceUrl:safetySourceUrl,catalog:safetyCatalog};let result:SafetyResult={...base,status:'config_error',message:messages.config_error};let image:Buffer|undefined;
    if(keyValue())try{const url=new URL('https://www.safemap.go.kr/openapi2/'+safetyService);url.search=new URLSearchParams({serviceKey:keyValue(),srs:'EPSG:4326',bbox:[bounds.west,bounds.south,bounds.east,bounds.north].join(','),format:'image/png',width:'512',height:'512',transparent:'TRUE'}).toString();const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
      const size=Number(response.headers.get('content-length'));if(size>4*1024*1024)throw new Error('oversize');const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>4*1024*1024)throw new Error('oversize');
      const png=bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(16)===512&&bytes.readUInt32BE(20)===512;
      if(response.ok&&png){image=bytes;let legend:SafetyResult['legend'];try{const legendUrl=new URL('https://www.safemap.go.kr/openapi2/lgdInfo');legendUrl.search=new URLSearchParams({serviceKey:keyValue(),intId:'IF_0087'}).toString();const r=await fetch(legendUrl,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)}),body=await r.json();const items=body.body?.items?.item;if(r.ok&&Array.isArray(items))legend=items.filter(i=>i.LAYER==='A2SM_CRMNLHSPOT_TOT'&&i.STYLE==='A2SM_CrmnlHspot_Tot_Tot'&&typeof i.LGD_NM==='string'&&i.LGD_NM.length<80&&typeof i.IMAGE==='string'&&/^#[\da-f]{6}$/i.test(i.IMAGE)).sort((a,b)=>Number(a.LGD_NO)-Number(b.LGD_NO)).slice(0,10).map(i=>({label:i.LGD_NM,color:i.IMAGE}));}catch{/* Do not invent a missing legend. */}result={...base,status:'available',message:messages.available,imageUrl:'/api/safety/image?'+new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng)}),...(legend?.length?{legend}:{})};}
      else{const code=safetyErrorCode(bytes)??(response.status===403?'20':response.status===401?'30':response.status===429?'429':null),status=code?classifySafetyError(code):'unavailable';result={...base,status,message:messages[status],...(code?{code}:{})};}
    }catch{result={...base,status:'unavailable',message:messages.unavailable};}
    const entry={result,image,until:Date.now()+(result.status==='available'?60*60*1000:result.status==='rate_limited'?5*60*1000:60*1000)};if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(id,entry);return entry;
  })().finally(()=>pending.delete(id));pending.set(id,task);return task;
}
