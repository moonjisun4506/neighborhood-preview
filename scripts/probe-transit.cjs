// Inspect configured API access without printing keys or authenticated URLs.
require('@next/env').loadEnvConfig(process.cwd());
const keys=[process.env.KAKAO_REST_API_KEY,process.env.ODSAY_API_KEY].filter(Boolean);
const clean=value=>keys.reduce((s,key)=>s.split(key).join('[redacted]'),String(value??''));
(async()=>{
 const url=new URL('https://apis-navi.kakaomobility.com/affiliate/publictransit/v1/multimodal/directions');
 url.search=new URLSearchParams({start:'126.903,37.556',goal:'126.925,37.5525',date:'-1',hhmmss:'-1',day_type:'Weekday',route_type:'All'}).toString();
 const response=await fetch(url,{headers:{Authorization:`KakaoAK ${process.env.KAKAO_REST_API_KEY}`},signal:AbortSignal.timeout(15000)});
 const body=await response.json();console.log(JSON.stringify({provider:'kakao',status:response.status,errorCode:body.code??body.error_code,message:clean(body.msg??body.message??body.error),topLevelFields:Object.keys(body)},null,2));
})().catch(error=>{console.log(JSON.stringify({provider:'kakao',error:error.name}));process.exitCode=1;});
