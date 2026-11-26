export const housingTypes={sh:'단독·다가구',rh:'연립·다세대',offi:'오피스텔'} as const;
export type HousingType=keyof typeof housingTypes;
export type RentTrade={deposit:number;monthlyRent:number;year:number;month:number;day:number;houseType:string};
export type RentStatistics={count:number;meanRent:number|null;medianRent:number|null;medianDeposit:number|null;smallSample:boolean};
export type RentResult={region:{code:string;name:string};month:string;type:HousingType;minDeposit:number;maxDeposit:number|null;statistics:RentStatistics;fetchedCount:number;excludedCount:number;retrievedAt:string};
export function summarizeRent(trades:RentTrade[],min:number,max:number|null):RentStatistics{
  const filtered=trades.filter(t=>Number.isFinite(t.monthlyRent)&&t.monthlyRent>0&&Number.isFinite(t.deposit)&&t.deposit>=min&&(max===null||t.deposit<=max));
  const median=(values:number[])=>{values.sort((a,b)=>a-b);const n=values.length;return n?(values[Math.floor(n/2)]+values[Math.ceil(n/2)-1])/2:null;};
  return {count:filtered.length,meanRent:filtered.length?filtered.reduce((s,t)=>s+t.monthlyRent,0)/filtered.length:null,medianRent:median(filtered.map(t=>t.monthlyRent)),medianDeposit:median(filtered.map(t=>t.deposit)),smallSample:filtered.length>0&&filtered.length<5};
}
// Completed calendar months in Korea, newest first. Recent filings can be revised.
export function rentMonths(now=new Date()):string[]{
  const date=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Seoul'}));
  return Array.from({length:24},(_,i)=>{const d=new Date(Date.UTC(date.getFullYear(),date.getMonth()-1-i,1));return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}`;});
}
