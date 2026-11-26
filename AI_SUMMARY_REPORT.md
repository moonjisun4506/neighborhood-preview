# AI 생활환경 요약 연결 결과

2026-11-26 OpenAI Responses API의 실제 호출로 단일 주소 요약과 두 주소의 차이점 요약을 검증했습니다. 모델은 서버 환경변수 OPENAI_SUMMARY_MODEL(기본 gpt-4.1-mini)을 사용하며 OPENAI_API_KEY는 서버에서만 읽습니다. 새 라이브러리나 외부 검색 도구를 추가하지 않았습니다.

## 기능과 데이터 흐름

- /summary의 AI 요약하기를 누르면 시설 10종·주요 장소 직선거리와 월세 통계를 서버에서 조회해 요약 근거를 만듭니다. 같은 조건의 공공 조회 자료만 최대 3분 메모리 캐시합니다. 주택 유형·계약월·보증금 범위와 시설 반경을 표시합니다.
- 대중교통은 현재 선택 주소에 대한 ODsay 응답을 사용합니다. 경로가 없고 목적지가 등록되어 있으면 조회를 시도하되, 이미 한도 오류가 확인된 경우 반복 호출하지 않습니다. 좌표·반경·목적지·조회 시각을 검사하고 15분이 지난 자료를 제외합니다. 직선거리는 좌표로 다시 계산합니다.
- 한 줄 요약, 생활시설, 교통·통학, 월세, 편리할 수 있는 점, 계약 전 확인 사항의 6개 섹션을 표시합니다. 출처와 전체 근거, 생성 시각·조건도 확인할 수 있습니다.
- 관심 주소에 AI 요약 저장을 누르면 필요 시 해당 주소를 먼저 저장하고, AI 요약을 별도 DB 테이블에 저장합니다. 개인 메모는 덮어쓰거나 AI로 전송하지 않습니다. 새로고침 및 localStorage 삭제 후에도 같은 익명 세션으로 복원됩니다.
- /compare에서 같은 조건의 비교 조회를 마친 뒤 AI 차이점 요약하기를 누르면 2~3곳의 차이를 설명합니다. 시설 비교 항목은 각 주소의 동일 반경 조회 건수를 나란히 제시하는 근거만 선택하도록 제한했습니다. 특정 주소의 추천·순위를 만들지 않습니다.

## 허위 정보 방지 방식

AI에 임의의 수치·장소를 포함한 자유 문장을 작성하게 하지 않습니다. 서버가 실제 조회 결과로 만든 근거 문장과 ID를 주고, Structured Outputs로 섹션별 근거 ID만 선택하게 합니다. 서버에서 ID·섹션·중복·개수를 검증한 뒤 원래 근거 문장을 조립합니다. 따라서 모델이 응답에 다른 숫자나 장소를 넣어도 표시할 수 없습니다. AI는 핵심 근거의 선택과 배열을 수행하며, 문장의 수치와 이름은 원자료에서 구성합니다.

누락 정보는 정보 없음·추가 확인 필요로 표시합니다. 시설 개수로 소음·범죄·치안·안전을 추론하는 근거는 만들지 않습니다. 편리할 수 있는 점은 조회된 시설 위치를 생활 동선 확인에 참고할 수 있다는 조건부 안내입니다. 시설 운영시간·실제 보행·배차·계약 조건은 추가 확인 대상으로 남깁니다.

시설·월세 자료는 서버의 기존 실제 조회 코드를 재사용합니다. ODsay는 기존 Web 키 정책을 유지하기 위해 브라우저가 조회한 응답을 전달받습니다. 서버에서 제공사에 재인증한 자료라는 의미는 아니며, 입력의 좌표·시간·구조를 검사합니다. 출처에도 앱 전달 자료임을 표시합니다. 제공사 응답의 위변조까지 서버에서 독립 검증하려면 별도 ODsay Server 키가 필요합니다.

## 서버·저장·오류 처리

실제 선택 주소와 조회 자료는 사용자가 버튼을 누른 후 OpenAI에 전달되며 화면에 이를 안내합니다. 개인 메모·익명 쿠키·DB 연결정보·제공사 인증키는 AI 입력에 넣지 않습니다. Responses API는 store:false로 호출합니다. 이것이 제공사의 모든 로그 보관이 없다는 보장은 아닙니다.

기존 HttpOnly 익명 세션과 동일 Origin 검사를 사용합니다. 세션당 10분에 최대 5회 요청하도록 DB 트랜잭션과 잠금으로 제한합니다. 생성 결과는 본인 소유의 임시 레코드에 보관하고, 저장 요청에는 클라이언트가 작성한 요약 본문을 받지 않습니다. 생성 ID와 주소를 검증해 서버에 보관된 결과만 저장합니다. 다른 세션의 생성 ID로 저장할 수 없습니다.

임시 생성 자료는 1일 후 저장 접근이 만료됩니다. 직접 저장한 요약은 주소 삭제·익명 세션 삭제 시 함께 삭제됩니다. 물리적인 만료 자료 정리는 기존 npm run db:cleanup에 포함했으며 정기 실행은 배포하지 않았습니다.

OpenAI 인증·권한·한도·시간 초과, 미완료 응답, 거부·형식 오류, 근거 불일치, DB 저장 오류를 처리합니다. 실패 시 가짜 요약으로 대체하지 않습니다. 조건·주소 변경 시 이전 결과를 숨기고 브라우저 요청을 취소합니다.

## 실제 검증

- OpenAI 단일 주소: 서울 마포구 월드컵로13길 19의 실제 시설·월세 자료로 6개 섹션 생성 성공. 모든 표시 문장을 근거 ID와 대조하고, 시설 조회 수를 별도 실제 카카오 응답과 대조했습니다.
- OpenAI 비교: 위 주소와 서울 은평구 은평로 195의 같은 반경·월세 조건으로 실제 생성 성공. 시설 차이는 두 주소의 조회 건수를 함께 담은 근거에서만 선택했음을 확인했습니다.
- 실제 결과 예: 2026년 10월 단독·다가구, 보증금 하한 0만원·상한 없음에서 마포구 월세 거래 362건·월세 중앙값 65만원·보증금 중앙값 1,000만원이 근거 및 요약에 동일하게 표시되었습니다. 은평구는 348건·50만원·1,000만원이었습니다. 개별 집 월세가 아닌 조회 시점 지역 통계입니다.
- 사용자가 설정한 MOLIT_API_KEY로 단독·다가구, 연립·다세대, 오피스텔 3종의 실제 XML 전체 페이지를 조회하고 월세 평균·중앙값·건수를 독립 계산과 대조해 통과했습니다. 이전 보고서의 키 미설정 제한은 해소되었습니다.
- 실제 Neon 저장·복원, 개인 메모 유지, 타 세션 저장 차단, 잘못된 근거 ID 거부, API 오류 안내, 조건 변경 후 이전 요약 숨김을 검증했습니다. PC·390px 모바일의 레이아웃도 확인했습니다.

최종 검사: npm.cmd run typecheck 통과, npm.cmd run build 통과. npm.cmd test -- --grep-invert "real Web/URI transit"는 **29개 통과·1개 보류**였습니다. 확인된 ODsay 일일 한도로 기존 실제 경로 재호출 3개를 제외했고, 별도의 전체 실제 비교 호출 1개는 기본 비활성 상태입니다. 이번 실제 AI 성공 검증에서는 교통을 정보 없음으로 처리했으며 실제 대중교통 경로를 재검증했다고 주장하지 않습니다. ODsay 한도 회복 후 해당 3개와 RUN_LIVE_COMPARISON=1 검사가 필요합니다.

비밀 값 검사에서 OpenAI·카카오 REST·MOLIT·DB 값이 브라우저 정적 파일에 없음을 확인했습니다. ODsay Web 키는 기존 정책대로 의도적으로 브라우저에서 사용합니다.

결과 파일: test-results/**/ai-live-summary.json, ai-live-comparison.json, test-results/molit-verification/**/molit-live-statistics.json. 화면: test-results/ai-summary-desktop.png, ai-summary-mobile.png. 해당 결과에는 인증키가 없습니다.

## 변경 파일

신규: src/lib/ai-summary.ts, src/lib/ai-evidence.server.ts, src/lib/ai.server.ts, src/components/ai-summary-panel.tsx, src/app/api/ai/summary/route.ts, src/app/api/ai/summary/save/route.ts, tests/ai-summary.spec.ts, AI_SUMMARY_REPORT.md.

수정: design-screen.tsx, comparison-results.tsx, compare-screen.tsx, neighborhood-card.tsx, app-provider.tsx, saved-database.ts, saved.server.ts, demo-data.ts, globals.css, scripts/migrate-saved.cjs, scripts/cleanup-saved.cjs, tests/rent.spec.ts, .env.example, README.md, RENT_REPORT.md, SAVED_COMPARE_REPORT.md.

기존 Stitch 색상·폰트·카드·PC/모바일 구조와 주소 검색·지도·시설·대중교통·월세·메모 기능을 유지했습니다. AI 요약 카드와 조회 조건을 추가하고 기존 AI 미연결 영역을 교체했습니다. GitHub Push·배포는 하지 않았습니다.

공식 근거: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), [검증한 모델](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
