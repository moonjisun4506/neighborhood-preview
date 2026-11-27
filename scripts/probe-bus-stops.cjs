const {loadEnvConfig}=require('@next/env');const fs=require('node:fs/promises');const {XMLParser}=require('fast-xml-parser');
loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const parser=new XMLParser({parseTagValue:false});
async function main(){console.log(JSON.stringify({SEOUL_BUS_API_KEY:!!process.env.SEOUL_BUS_API_KEY?.trim(),MOLIT_API_KEY:!!process.env.MOLIT_API_KEY?.trim()}));const observations=[];
for(const q of ['서울 중구 세종대로 110','서울 마포구 와우산로 94','서울 송파구 올림픽로 300']){
 const search=await fetch('https://dapi.kakao.com/v2/local/search/address.json?query='+encodeURIComponent(q),{headers:{Authorization:'KakaoAK '+process.env.KAKAO_REST_API_KEY.trim()}}),location=(await search.json()).documents[0],origin={lat:Number(location.y),lng:Number(location.x)};
 const local=await(await fetch('http://localhost:3000/api/transit/nearby?'+new URLSearchParams({...origin,radius:'500',refresh:'1'}))).json();
 const keyword={};for(const query of ['버스정류장','정류장']){const params=new URLSearchParams({query,x:String(origin.lng),y:String(origin.lat),radius:'500',sort:'distance',size:'15'});const r=await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?'+params,{headers:{Authorization:'KakaoAK '+process.env.KAKAO_REST_API_KEY.trim()}});const b=await r.json();keyword[query]={http:r.status,total:b.meta?.total_count,names:b.documents?.slice(0,5).map(d=>d.place_name)};}
 observations.push({q,origin,stations:local.stations,sources:local.sources});
 const prod=await(await fetch('https://neighborhood-preview-kzcj.vercel.app/api/transit/nearby?'+new URLSearchParams({...origin,radius:'500'}))).json();
 console.log(JSON.stringify({q,origin,keyword,local:{sources:local.sources,buses:local.stations?.filter(s=>s.kind==='bus').length},production:{sources:prod.sources,buses:prod.stations?.filter(s=>s.kind==='bus').length}}));
}
await fs.mkdir('test-results/bus-investigation',{recursive:true});await fs.writeFile('test-results/bus-investigation/official-stops.json',JSON.stringify(observations,null,2));}
main().catch(()=>{console.error('Bus probe failed; request credentials withheld.');process.exitCode=1;});
