import fs from 'node:fs';
fs.mkdirSync('public/fonts',{recursive:true});
const korean=await fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2');
if(!korean.ok)throw Error('Pretendard download failed');
fs.writeFileSync('public/fonts/pretendard.woff2',Buffer.from(await korean.arrayBuffer()));
for(const [name,url]of [['jakarta','https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'],['symbols','https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200']]){
 const css=await(await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'}})).text();const matches=[...css.matchAll(/url\((https:[^)]+)\)/g)];const font=await fetch(matches.at(-1)[1]);fs.writeFileSync(`public/fonts/${name}.woff2`,Buffer.from(await font.arrayBuffer()));console.log(name,font.status);
}
