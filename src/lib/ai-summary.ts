import type {AddressRecord} from './demo-data';
import type {TransitNearby,TransitRoutes} from './transit';
export const summarySections={overview:'한 줄 생활환경 요약',facilities:'주변 생활 편의시설의 특징',transit:'대중교통 및 통학 정보',rent:'월세 참고 정보',benefits:'생활하면서 편리할 수 있는 점',checks:'계약 전 추가 확인 사항'} as const;
export type SectionKey=keyof typeof summarySections;
export type Evidence={id:string;section:SectionKey;text:string;source:string};
export type AiSummary={id:string;mode:'address'|'compare';style?:'concise';addressIds:string[];generatedAt:string;model:string;conditions:{radius:number;destination:string|null;days:number;roundTrip:boolean;month:string;type:string;min:number;max:number|null};sections:{key:SectionKey;title:string;items:{evidenceId:string;text:string;source:string}[]}[];evidence:Evidence[]};
export type SummaryRequest={addresses:AddressRecord[];radius:number;destination:AddressRecord|null;days:number;roundTrip:boolean;month:string;type:string;min:number;max:number|null;transit:{addressId:string;nearby:TransitNearby|null;routes:TransitRoutes|null}[]};
export type SummaryPlan=Record<SectionKey,string[]>;
export function renderPlan(plan:unknown,evidence:Evidence[]):AiSummary['sections']{
  if(!plan||typeof plan!=='object'||Array.isArray(plan))throw new Error('AI 응답 형식이 올바르지 않습니다.');
  return (Object.keys(summarySections) as SectionKey[]).map(key=>{
    const ids=(plan as SummaryPlan)[key];if(!Array.isArray(ids)||!ids.length||ids.length>(key==='overview'?1:6)||new Set(ids).size!==ids.length)throw new Error('AI 요약 항목을 확인하지 못했습니다.');
    const items=ids.map(id=>{const fact=evidence.find(e=>e.id===id&&e.section===key);if(!fact)throw new Error('조회 근거와 일치하지 않는 AI 응답입니다.');return {evidenceId:fact.id,text:fact.text,source:fact.source};});
    return {key,title:summarySections[key],items};
  });
}
