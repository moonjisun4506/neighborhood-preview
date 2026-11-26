// Server-key mode only. The user's existing URI/Web key is never used here.
import {OdsayError,parseOdsayBody} from './odsay-data';
export {OdsayError,normalizeDirection} from './odsay-data';
export async function callOdsay(endpoint:'pointSearch'|'searchPubTransPathT',params:Record<string,string>,signal:AbortSignal){
  const key=process.env.ODSAY_SERVER_API_KEY?.trim();if(!key)throw new OdsayError('CONFIG',503,'ODsay Server 키 설정이 필요합니다. Server 모드는 별도의 키와 호출 서버의 공인 IP 등록이 필요합니다.');
  let response:Response;
  try{response=await fetch(`https://api.odsay.com/v1/api/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({...params,apiKey:key,lang:'0',output:'json'}),cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});}
  catch{throw new OdsayError('NETWORK',502,'ODsay에 연결하지 못했습니다. 잠시 후 다시 조회해 주세요.');}
  if(!response.ok)throw new OdsayError(response.status===429?'QUOTA':'UPSTREAM',response.status===429?429:502,'대중교통 제공사 요청을 처리하지 못했습니다.');
  let body;try{body=await response.json();}catch{throw new OdsayError('UPSTREAM',502,'대중교통 응답을 읽지 못했습니다.');}
  return parseOdsayBody(body,'server');
}
