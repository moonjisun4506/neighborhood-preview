import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root='stitch_ui_ux';
fs.mkdirSync('src/design',{recursive:true});fs.mkdirSync('public/assets',{recursive:true});
const config=fs.readFileSync(`${root}/1._1/code.html`,'utf8').match(/<script id="tailwind-config">([\s\S]*?)<\/script>/)[1];
const context={tailwind:{}};vm.runInNewContext(config,context);
const theme=context.tailwind.config;
for(const k of Object.keys(theme.theme.extend.fontFamily))theme.theme.extend.fontFamily[k]=['Plus Jakarta Sans','Pretendard','Arial','sans-serif'];
theme.content=['./src/**/*.{ts,tsx,json}'];
fs.writeFileSync('tailwind.config.js','module.exports = '+JSON.stringify(theme,null,2));
const mapping={home:'1._1',explore:'2._explore_1',recommend:'3._ai_recommend',saved:'4._saved',compare:'5._compare',mobileHome:'1._2',mobileExplore:'2._explore_2'};
const urls=new Set(); const inventory=[];
for(const folder of fs.readdirSync(root)){
 const path=`${root}/${folder}/code.html`;if(!fs.existsSync(path))continue;
 const s=fs.readFileSync(path,'utf8'); const assets=[...s.matchAll(/https:\/\/lh3\.googleusercontent\.com\/[^'"\s)<>]+/g)].map(x=>x[0]);
 assets.forEach(u=>urls.add(u)); inventory.push({folder,bytes:fs.statSync(path).size,screenshot:fs.existsSync(`${root}/${folder}/screen.png`),images:assets.length,role:Object.values(mapping).includes(folder)?'selected':'previous / alternative',sha256:crypto.createHash('sha256').update(s).digest('hex')});
}
const assetMap={};
await Promise.all([...urls].map(async(url)=>{const name=crypto.createHash('sha256').update(url).digest('hex').slice(0,16)+'.jpg';try{const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error(res.status);fs.writeFileSync('public/assets/'+name,Buffer.from(await res.arrayBuffer()));assetMap[url]='/assets/'+name;}catch(e){console.log('Asset unavailable:',name,e.message);assetMap[url]='/assets/placeholder.svg';}}));
const screens={};
for(const [key,folder]of Object.entries(mapping)){
 let s=fs.readFileSync(`${root}/${folder}/code.html`,'utf8');
 s=s.slice(s.indexOf('<main'),s.lastIndexOf('</main>')+7).replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\s+on[a-z]+="[^"]*"/g,'');
 // No factual verification, live API, identity, or authentic review claims survive the export.
 const replacements=[['실시간','예시'],['실거래가 연동','예시 시세'],['공공데이터 동기화 완료','API 미연결 · 예시 데이터'],['공공데이터 연동 완료','API 미연결 · 예시 데이터'],['공공데이터 연동','예시 데이터'],['공공데이터를 기반','예시 데이터를 기반'],['검증 완료','미검증 예시'],['측정 완료','예시 측정값'],['교차 검증','예시 비교'],['빅데이터','샘플 데이터'],['검증 리뷰','예시 리뷰'],['GPS 인증','가상'],['실거주 청년 인증','가상 후기'],['실사진','디자인 참고 이미지'],['현장 검증 사진','디자인 이미지'],['현장 분위기','예시 분위기'],['최근 2주 내 갱신','Stitch 디자인 이미지'],['오늘 09:30 기준','브라우저에 저장'],['1분 전 갱신','실제 갱신 없음'],['검증','예시'],['동기화','예시 표시'],['연동됩니다','연동되지 않습니다'],['김서연 님','체험 사용자'],['서연 님','체험 사용자'],['서연님','안녕하세요'],['홍대생 김서연','대학생 체험 사용자'],['2024년 10월 최신 기준','실제 최신 데이터 아님'],['데이터 상태 정상 작동 중','외부 API 미연결'],['응답속도 42ms','네트워크 요청 없음'],['v2.5 Ready','UI Preview'],['AI 학습','가상 예시'],['공공데이터 수집 준비 중','외부 API 미연결'],['측정 센서 평균','가상 예시 지표'],['전수 분석','예시 분석'],['매일 오전 6시 동기화','실제 수집 없음']];
 for(const [a,b]of replacements)s=s.replaceAll(a,b);
 for(const term of ['평균 원룸 시세','원룸 평균 시세','평균 시세','원룸 평균 월세','야간 안심지표','야간 안심 지수','안심 치안','야간 소음','라이프스타일 매트릭스 지표','실시간 라이프 스코어','자취 4년차 멘토의 솔직 팁','홍대 공대생 리뷰'])s=s.replaceAll(term,term+' (예시)');
 s=s.replaceAll('경찰청 생활안전지도 연동','경찰청 데이터 미연결').replaceAll('CCTV 142대 가동','CCTV 142대 (가상 예시)').replaceAll('국토부 전월세 실거래가 매일 오전 6시 예시 표시','실거래가 API 미연결').replaceAll('데이터 근거:','예시 시나리오 · 실제 데이터 근거 없음:').replaceAll('현재 안녕하세요께 가장 유리한 곳','현재 조건으로 살펴볼 예시 동네').replaceAll('AI 라이프스타일 매칭 완료','AI 매칭 화면 예시 (실제 분석 미실행)');
 s=s.replace(/https:\/\/lh3\.googleusercontent\.com\/[^'"\s)<>]+/g,u=>assetMap[u]);
 s=s.replace(/<img\b([^>]*?)>/g,(_,attrs)=>'<img '+attrs.replace(/\sdata-alt=/,' alt=')+'>');
 // Original exports contain nested main landmarks.
 let first=true;s=s.replace(/<main\b/g,()=>{if(first){first=false;return '<div data-design-main="true"';}return '<div';}).replaceAll('</main>','</div>');
 s=s.replace(/입력하신[\s\S]*?후보군입니다\./,'아래 동네와 점수는 디자인을 체험하기 위한 고정 예시입니다. 입력한 조건은 저장되지만 실제 AI 분석이나 공공데이터 조회는 수행하지 않습니다.');
 s=s.replaceAll('전용 분석 결과','전용 추천 화면 예시').replaceAll('공공데이터 AI 진단 결과 확인','예시 추천 화면 확인').replaceAll('실제 자취생 가상 후기 기반','가상의 자취 후기 기반');
 screens[key]=s;
}
fs.writeFileSync('src/design/screens.json',JSON.stringify(screens,null,2));
fs.writeFileSync('src/design/inventory.json',JSON.stringify({files:inventory,assets:assetMap},null,2));
console.log(`Prepared ${inventory.length} HTML files, ${Object.keys(screens).length} selected layouts, ${urls.size} assets.`);
