require('@next/env').loadEnvConfig(process.cwd());
const fs=require('node:fs');
const key=process.env.ODSAY_SERVER_API_KEY?.trim();
const clean=value=>String(value??'').split(key??'__unset__').join('[redacted]').split(encodeURIComponent(key??'__unset__')).join('[redacted]');
(async()=>{
 if(!key){console.log('Server probe skipped: configure a Server-platform ODSAY_SERVER_API_KEY and allowed public IP.');return;}const report=[];
 for(const [endpoint,params]of [['pointSearch',{x:'126.903',y:'37.556',radius:'500',stationClass:'1:2'}],['searchPubTransPathT',{SX:'126.903',SY:'37.556',EX:'126.9250355422',EY:'37.5525245968145',SearchType:'0',OPT:'0'}]]){
  const url=new URL(`https://api.odsay.com/v1/api/${endpoint}`);url.search=new URLSearchParams({...params,apiKey:key,output:'json',lang:'0'}).toString();
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});const body=await response.json();const error=Array.isArray(body.error)?body.error[0]:body.error;
  console.log(JSON.stringify({provider:'odsay',endpoint,httpStatus:response.status,errorCode:error?.code,errorMessage:clean(error?.message),resultFields:body.result?Object.keys(body.result):[],stationCount:body.result?.station?.length,pathCount:body.result?.path?.length},null,2));
  report.push({endpoint,httpStatus:response.status,body:JSON.parse(clean(JSON.stringify(body)))});
 }
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/odsay-access-probe.json',JSON.stringify(report,null,2));
})().catch(error=>{console.log(JSON.stringify({provider:'odsay',error:error.name}));process.exitCode=1;});
