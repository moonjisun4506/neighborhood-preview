// Read configured secret values in memory; never print them or write them to reports.
const fs=require('node:fs');const path=require('node:path');
require('@next/env').loadEnvConfig(process.cwd());
const names=['KAKAO_REST_API_KEY','OPENAI_API_KEY','ODSAY_SERVER_API_KEY','DATABASE_URL','MOLIT_API_KEY','SAFEMAP_API_KEY','TMAP_APP_KEY','SEOUL_BUS_API_KEY'];
const publicWeb=process.env.NEXT_PUBLIC_TRANSIT_MODE==='web'?process.env.NEXT_PUBLIC_ODSAY_WEB_API_KEY?.trim():undefined;
if(process.env.ODSAY_API_KEY?.trim()!==publicWeb)names.push('ODSAY_API_KEY');
const files=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(/\.(js|json|html|map)$/.test(entry.name))files.push(file);}}
visit('.next/static');
let leaked=false;for(const name of names){const value=process.env[name]?.trim();if(!value)continue;const found=files.some(file=>fs.readFileSync(file,'utf8').includes(value));console.log(`${name}: ${found?'FAIL: present in browser asset':'PASS: absent from browser assets'}`);leaked||=found;}
if(publicWeb)console.log('ODsay Web/URI key: intentionally browser-visible in explicitly configured Web mode.');
console.log(`Checked ${files.length} browser assets.`);if(leaked)process.exitCode=1;
