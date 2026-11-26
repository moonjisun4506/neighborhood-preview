// Check candidate source files without printing credential values or matching lines.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
require('@next/env').loadEnvConfig(process.cwd());
const names=Object.keys(process.env).filter(name=>/API_KEY|APP_KEY|DATABASE_URL|TOKEN|PASSWORD|SECRET/.test(name));
const secrets=names.flatMap(name=>{const value=process.env[name]?.trim();if(!value||value.length<12)return [];const variants=new Set([value,encodeURIComponent(value)]);try{variants.add(decodeURIComponent(value));}catch{}return [...variants].map(value=>({name,value}));});
const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(Boolean);
let failed=false;
for(const file of files){if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;const content=fs.readFileSync(file);for(const {name,value} of secrets)if(content.includes(Buffer.from(value))){console.error(`FAIL: configured ${name} found in ${file}`);failed=true;}if(/(?:^|\/)\.env(?:\.|$)/.test(file)&&file!=='.env.example'){console.error(`FAIL: environment file included: ${file}`);failed=true;}const text=content.toString('utf8');if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/.test(text)){console.error(`FAIL: credential pattern in ${file}`);failed=true;}}
console.log(`Source credential scan: ${failed?'FAIL':'PASS'} (${files.length} candidate files; no values printed)`);if(failed)process.exitCode=1;
