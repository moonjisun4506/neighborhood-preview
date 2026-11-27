const fs=require('node:fs/promises'),{createHash}=require('node:crypto');
async function main(){
 const sourceUrl='https://data.seoul.go.kr/dataList/OA-15067/S/1/datasetView.do',html=await(await fetch(sourceUrl)).text();
 const match=html.match(/title="(서울시버스정류소위치정보\((\d{8})\)\.xlsx)" onclick="javascript:downloadFile\('(\d+)'\)/);if(!match)throw Error('Official file reference missing');
 const r=await fetch('https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?useCache=false',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({infId:'OA-15067',infSeq:'1',seq:match[3],seqNo:''}),signal:AbortSignal.timeout(30000)}),bytes=Buffer.from(await r.arrayBuffer());
 if(!r.ok||bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('Official XLSX not returned');await fs.mkdir('data/transit',{recursive:true});await fs.writeFile('data/transit/seoul-stops.xlsx',bytes);
 const metadata={sourceUrl,provider:'서울특별시 교통정보과 · 서울 열린데이터광장',fileName:match[1],asOf:match[2],downloadedAt:new Date().toISOString(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),license:'공공누리 제1유형 · 출처표시'};
 await fs.writeFile('data/transit/seoul-stops-provenance.json',JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata));
}
main().catch(()=>{console.error('Official Seoul stop download failed. No keys used.');process.exitCode=1;});
