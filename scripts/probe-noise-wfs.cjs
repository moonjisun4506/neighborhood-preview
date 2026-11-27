const {loadEnvConfig}=require('@next/env');const proj4=require('proj4');const fs=require('node:fs/promises');
loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const utm='+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs';
async function main(){let key=process.env.MOLIT_API_KEY.trim();if(/%[0-9a-f]{2}/i.test(key))key=decodeURIComponent(key);
 for(const [name,bbox]of [['seoul',(()=>{const [x,y]=proj4('EPSG:4326',utm,[126.977918,37.566371]);return [x-510,y-510,x+510,y+510].join(',');})()],['national','73297.40248257795,3506059.085416644,803828.180558938,4444265.837193642']]){
 const p=new URLSearchParams({ServiceKey:key,srsName:'EPSG:32652',bbox,maxFeatures:'3',resultType:'results'});const r=await fetch('https://apis.data.go.kr/1480523/NoiseVibrationService/getInfoWFS?'+p,{signal:AbortSignal.timeout(25000)});const raw=await r.text();const clean=raw.split(key).join('[REDACTED]').split(encodeURIComponent(key)).join('[REDACTED]');await fs.writeFile('test-results/noise-public/wfs-'+name+'.xml',clean);console.log(JSON.stringify({name,http:r.status,body:clean.slice(0,3600)}));}
}
main().catch(()=>{console.error('WFS probe failed; no credential values printed.');process.exitCode=1;});
