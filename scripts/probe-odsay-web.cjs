// The user confirmed ODSAY_API_KEY is a Web/URI key and authorized browser use.
require('@next/env').loadEnvConfig(process.cwd());
const {chromium}=require('@playwright/test');const fs=require('node:fs');
(async()=>{
 const key=process.env.NEXT_PUBLIC_ODSAY_WEB_API_KEY?.trim();if(!key)throw new Error('WebKeyMissing');const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage();await page.goto('http://localhost:3000',{waitUntil:'domcontentloaded'});
 const results=await page.evaluate(async key=>{
   const results=[];
   for(const [endpoint,params]of [['pointSearch',{x:'126.903',y:'37.556',radius:'500',stationClass:'1:2'}],['searchPubTransPathT',{SX:'126.903',SY:'37.556',EX:'126.9250355422',EY:'37.5525245968145',SearchType:'0',OPT:'0'}]]){
    try{const url=new URL(`https://api.odsay.com/v1/api/${endpoint}`);url.search=new URLSearchParams({...params,apiKey:key,lang:'0',output:'json'}).toString();const response=await fetch(url,{signal:AbortSignal.timeout(15000)});const body=await response.json();const error=Array.isArray(body.error)?body.error[0]:body.error;
    results.push({endpoint,httpStatus:response.status,errorCode:error?.code,errorMessage:String(error?.message??'').split(key).join('[redacted]'),stationCount:body.result?.station?.length,pathCount:body.result?.path?.length,body});
    }catch(error){results.push({endpoint,error:error.name});}
   }return results;
 },key);
 for(const {body,...summary}of results)console.log(JSON.stringify(summary,null,2));
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/odsay-web-access.json',JSON.stringify(results,null,2).split(key).join('[redacted]'));
 }finally{await browser.close();}
})().catch(error=>{console.log(JSON.stringify({error:error.name}));process.exitCode=1;});
