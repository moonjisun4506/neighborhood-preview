const fs=require('node:fs/promises');const {createHash}=require('node:crypto');
async function main(){
 const metadata=JSON.parse(await fs.readFile('test-results/noise-public/csv-download-metadata.json','utf8'));
 const params={atchFileId:metadata.atchFileId,fileDetailSn:metadata.fileDetailSn};
 const check=await fetch('https://www.data.go.kr/cmm/cmm/check-limit.json',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
 const limit=await check.json();if(!check.ok||limit.needCaptcha){console.log('CSV download requires portal verification; no bypass attempted.');return;}
 const url=new URL('https://www.data.go.kr/cmm/cmm/fileDownload.do');url.search=new URLSearchParams({...params,dataNm:metadata.dataSetFileDetailInfo.dataNm}).toString();
 const r=await fetch(url,{signal:AbortSignal.timeout(30000)}),buffer=Buffer.from(await r.arrayBuffer());
 if(!r.ok||!r.headers.get('content-disposition')||/text\/html/.test(r.headers.get('content-type')??''))throw Error('CSV not returned');
 await fs.mkdir('data/noise',{recursive:true});await fs.writeFile('data/noise/environment-2025.csv',buffer);
 let text=new TextDecoder('utf-8',{fatal:true});let decoded,encoding='utf-8';try{decoded=text.decode(buffer);}catch{encoding='euc-kr';decoded=new TextDecoder(encoding,{fatal:true}).decode(buffer);}
 console.log(JSON.stringify({status:r.status,bytes:buffer.length,encoding,sha256:createHash('sha256').update(buffer).digest('hex'),firstRows:decoded.split(/\r?\n/).slice(0,3)}));
 await fs.writeFile('data/noise/csv-provenance.json',JSON.stringify({sourceUrl:'https://www.data.go.kr/data/15065396/fileData.do',fileName:metadata.fileDataRegistVO.orginlFileNm,downloadedAt:new Date().toISOString(),encoding,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')},null,2));
}
main().catch(()=>{console.error('CSV download failed; no credentials used or printed.');process.exitCode=1;});
