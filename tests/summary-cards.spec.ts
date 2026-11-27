import {test,expect} from '@playwright/test';
import {addressSummarySections,renderAddressPlan,type Evidence} from '../src/lib/ai-summary';

test('seven-card schema rejects cross-card IDs and duplicate evidence',()=>{
  const prefix=String.fromCodePoint(0xC8FC,0xC18C,32,0xCE74,0xB4DC,32,0xB7,32);
  const evidence:Evidence[]=Object.keys(addressSummarySections).map((section,i)=>({id:'e'+i,section:section as Evidence['section'],text:'Verified evidence '+i,source:prefix+'official source'}));
  const plan=Object.fromEntries(evidence.map(e=>[e.section,[e.id]]));
  expect(renderAddressPlan(plan,evidence).map(s=>s.title)).toEqual(Object.values(addressSummarySections));
  expect(()=>renderAddressPlan({...plan,facilities:plan.overview},evidence)).toThrow();
  expect(()=>renderAddressPlan({...plan,noise:[...plan.noise,...plan.noise]},evidence)).toThrow();
  expect(()=>renderAddressPlan({...plan,safety:['invented crime incident']},evidence)).toThrow();
  expect(()=>renderAddressPlan({...plan,checks:[]},evidence)).toThrow();
});

// Live three-address grounding, walking-cache use and responsive checks are in practical-summary.spec.ts.
// Backward-compatible saved five-card rendering is checked in ai-readability.spec.ts.
