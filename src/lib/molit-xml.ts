import {XMLParser,XMLValidator} from 'fast-xml-parser';
import type {RentTrade} from './rent';
export class RentError extends Error{constructor(public code:string,message:string,public status=502){super(message);}}
const parser=new XMLParser({parseTagValue:false,ignoreAttributes:true,processEntities:false});
function amount(value:unknown):number|null{const s=String(value??'').trim();if(!/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(s))return null;const n=Number(s.replaceAll(',',''));return Number.isFinite(n)&&n>=0?n:null;}
export function parseRentXml(xml:string,code:string,month:string){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw new RentError('RESPONSE','실거래 응답 형식을 확인할 수 없습니다.');
  const parsed=parser.parse(xml),root=parsed.response;
  const resultCode=String(root?.header?.resultCode??parsed.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode??'');
  if(resultCode==='03')return {total:0,itemsCount:0,trades:[] as RentTrade[],excluded:0,page:null};
  if(['22','020','20','30','31','32','33'].includes(resultCode))throw new RentError('AUTH_LIMIT','국토교통부 인증·활용 승인·유효기간 또는 요청 한도를 확인해 주세요.');
  if(!root?.header||!['00','000'].includes(resultCode))throw new RentError('UPSTREAM','국토교통부 실거래 서비스가 오류를 반환했습니다. 잠시 후 다시 시도해 주세요.');
  const body=root.body,total=Number(body?.totalCount);
  if(!Number.isSafeInteger(total)||total<0)throw new RentError('RESPONSE','거래 건수 응답을 확인할 수 없습니다.');
  const raw=body?.items?.item,items=raw?(Array.isArray(raw)?raw:[raw]):[];
  const trades:RentTrade[]=[];let excluded=0;
  for(const item of items){
    const deposit=amount(item.deposit),monthlyRent=amount(item.monthlyRent);
    const year=Number(item.dealYear),m=Number(item.dealMonth),day=Number(item.dealDay);
    const validDate=Number.isInteger(day)&&day>=1&&day<=31&&new Date(Date.UTC(year,m-1,day)).getUTCMonth()===m-1;
    if(String(item.sggCd)!==code||`${year}${String(m).padStart(2,'0')}`!==month||!validDate||deposit===null||monthlyRent===null){excluded++;continue;}
    trades.push({deposit,monthlyRent,year,month:m,day,houseType:String(item.houseType??'')});
  }
  return {total,itemsCount:items.length,trades,excluded,page:body.pageNo===undefined?null:Number(body.pageNo)};
}
