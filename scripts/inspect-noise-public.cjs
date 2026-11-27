// Never print request URLs or credentials. Public portal metadata only.
const fs=require('node:fs/promises');
const {loadEnvConfig}=require('@next/env');
loadEnvConfig(process.cwd(),false,{info(){},error(){}});
async function main(){
 const dir='test-results/noise-public';await fs.mkdir(dir,{recursive:true});
 for(const id of ['15164190','15142831','15065396']){
  const html=await(await fetch(`https://www.data.go.kr/data/${id}/${id==='15065396'?'fileData.do':'openapi.do'}`)).text();
  if(id==='15065396'){
   const linked=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]??'{}');
   console.log(JSON.stringify({id,distribution:linked.distribution}));
   await fs.writeFile(dir+'/csv-page.html',html);
   console.log(html.split('\n').filter(l=>/fn.*[Dd]own|[Dd]ownload|fileList|fileDetail|fileNo|fileSn|publicDataPk|atchFileId|fileSeq|fileUrl|csv/.test(l)&&!(/serviceKey|appkey|token/i.test(l))).map(l=>l.trim().slice(0,400)).slice(-45).join('\n'));
   continue;
  }
  const literal=html.match(/const swaggerJson = (`[\s\S]*?`);/)?.[1];if(!literal)throw Error('Official Swagger missing');
  const spec=JSON.parse(literal.slice(1,-1).replace(/\\\\/g,'\\').replace(/\\`/g,'`'));
  await fs.writeFile(dir+'/'+id+'-swagger.json',JSON.stringify(spec,null,2));
  console.log(JSON.stringify({id,host:spec.host,basePath:spec.basePath,paths:Object.entries(spec.paths).map(([path,v])=>({path,parameters:v.get?.parameters?.map(p=>({name:p.name,required:p.required,default:p.default,description:p.description}))}))}));
 }
}
main().catch(()=>{console.error('Public metadata inspection failed; no credential values printed.');process.exitCode=1;});
