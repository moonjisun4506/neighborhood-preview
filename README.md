# 동네 미리보기

사용자가 직접 검색한 집 주소의 주변 생활환경을 지도에서 확인하고, 관심 주소를 저장·메모·비교하는 웹앱입니다. AI는 실제 조회한 자료를 요약하며 주소를 추천하거나 순위를 매기지 않습니다.

현재 기본 대중교통 경로와 시설 상세의 보행자 경로는 **TMAP 서버 API**를 사용합니다. `.env.local`에 서버 전용 `TMAP_APP_KEY`를 설정하고 `npm run db:migrate:tmap`으로 Neon 캐시·일일 한도 테이블을 준비하세요. 같은 SK 앱에 TMAP 및 TMAP 대중교통 Free 상품을 연결해야 합니다. 키를 `NEXT_PUBLIC_` 변수로 설정하지 마세요. 기존 ODsay 주변 정류장 기능과 경로 코드는 유지되며, `NEXT_PUBLIC_TRANSIT_ROUTE_PROVIDER=odsay`로 명시적으로 기존 경로 방식으로 돌아갈 수 있습니다. 기본값은 `tmap`입니다.

TMAP 경로는 직접 경로 버튼을 눌렀을 때만 왕복을 별도 조회합니다(캐시가 없으면 최대 2건). 시설 클릭 시에만 실제 보행 거리·시간을 조회하며 직선거리와 구분합니다. 캐시는 최초 조회 시점부터 23시간 이내에 만료되고 탭 전환·새로고침으로 갱신하지 않습니다. 비교와 AI는 유효한 기존 경로만 사용합니다. 서버는 DB의 원자적 카운터로 대중교통 하루 10건, 보행자 하루 1,000건 이하로 제한하며 DB 장애 시 새 외부 호출을 중단합니다. 실제 콘솔 사용량은 다른 앱/콘솔 호출도 합산될 수 있으며 유료 상품 변경 기능은 구현하지 않습니다. 최신 검증은 [TMAP_REPORT.md](./TMAP_REPORT.md)를 참고하세요.

교통·소음·치안 탭의 **주변 치안 정보**에서 생활안전지도 범죄주의구간 WMS를 켜고 끌 수 있습니다. 선택 주소 기준 1km를 둘러싼 사각 영상이며 모서리에는 약 1.42km까지의 자료가 포함될 수 있습니다. 사건 위치·발생 건수·집의 안전 점수를 제공하지 않습니다. 서버 전용 `SAFEMAP_API_KEY`를 사용하며 상세 검증·이용 조건·기준 시점은 [SAFETY_REPORT.md](./SAFETY_REPORT.md)를 확인하세요.

시설 목록과 지도 마커는 모두 선택한 집 좌표를 기준으로 종류별 가장 가까운 2곳만 직선거리순으로 표시합니다. 1곳이면 1곳, 없으면 검색 결과 없음으로 표시합니다. 자세한 검증은 [NEAREST_FACILITIES_REPORT.md](./NEAREST_FACILITIES_REPORT.md)를 확인하세요. ODsay 조회는 같은 브라우저 탭에서 24시간 캐시하고 새로고침·탭 전환·AI 요약의 중복 호출을 줄입니다. 한도 오류 후 자동 재시도하지 않습니다. AI 단일 주소 요약은 **한눈에 보는 동네·주변 생활 편의성·통학 및 출퇴근·주거비 참고·계약 전 확인할 점**의 5개 카드로 표시합니다. 시설 상세는 TMAP 보행자 경로의 실제 거리·시간을 추가 표시하며, AI의 시설 거리 설명은 계속 카카오 좌표 기준 직선거리입니다. 최신 내용은 [AI_CARDS_REPORT.md](./AI_CARDS_REPORT.md), 이전 간소화 변경·캐시 범위는 [CONCISE_ENVIRONMENT_REPORT.md](./CONCISE_ENVIRONMENT_REPORT.md)에 있습니다.

## 주요 기능

- 카카오 주소·건물·장소 검색, 기준 주소 마커와 주변 생활시설 10종, 300m·500m·1km 필터
- ODsay 주변 정류장·지하철역, 학교·직장 목적지 등록, TMAP 대중교통 경로와 실제 왕복 요금 기준 월 교통비
- 공식 소음 측정자료와 국토교통부 주택 유형·보증금 조건별 월세 실거래 참고 통계
- Neon 익명 세션 기반 관심 주소·개인 메모 저장, 주소 2~3곳 동일 조건 비교
- OpenAI 근거 기반 생활환경 요약·저장과 주소 간 차이 설명
- 주변 시설 / 교통·소음·치안 / AI 요약 탭, PC·모바일 공통 주소와 반응형 지도·메모

Next.js App Router · TypeScript · React · Tailwind CSS로 구현했습니다. 외부 데이터의 누락·오류는 그대로 안내하며 임의의 수치로 대체하지 않습니다.

## 빠른 시작

Node.js 20.9 이상과 npm이 필요합니다.

```bash
git clone https://github.com/moonjisun4506/neighborhood-preview.git
cd neighborhood-preview
npm ci
```

`.env.example`을 `.env.local`로 복사한 뒤 본인의 API 키와 Neon 연결 문자열을 입력하세요. PowerShell에서는 `Copy-Item .env.example .env.local`, macOS/Linux에서는 `cp .env.example .env.local`을 사용합니다. 실제 키·비밀번호가 들어 있는 파일은 Git에 포함하지 않습니다.

```bash
npm run db:migrate
npm run dev
```

`http://localhost:3000`으로 접속합니다. 카카오 JavaScript SDK 도메인과 ODsay Web/URI Service URI에 이 주소를 등록해야 합니다. 각 API 설정과 제한은 아래 설명을 참고하세요. 프로덕션 실행은 `npm run build` 후 `npm start`입니다.

화면을 공통 집 주소 검색과 **주변 시설 / 교통·소음·치안 / AI 요약** 3개 탭으로 정리했습니다. 지도 오른쪽 아래 메모 버튼은 PC 팝업·모바일 하단 시트로 열리고 기존 주소별 메모 저장 기능을 사용합니다. 상단 메뉴에서 저장한 집과 주소 비교로 이동합니다. 변경 파일과 최신 검증 범위는 [UI_REFACTOR_REPORT.md](./UI_REFACTOR_REPORT.md)를 확인하세요.

TMAP 대중교통은 이동 순서별 도보·승하차·환승 안내와 `1달 교통비 계산하기`를 제공합니다. 실제 양방향 요금이 있어야 월 비용을 계산하며, 제공되지 않는 방면이나 도보 시간을 만들지 않습니다. 이전 ODsay 실제 3쌍 호출은 일일 한도 오류로 완료하지 못했고, 최신 TMAP 실제 2쌍 결과는 TMAP_REPORT.md에 있습니다. 변경과 검증 범위는 [TRANSIT_GUIDANCE_REPORT.md](./TRANSIT_GUIDANCE_REPORT.md)에 있습니다.

주변 소음은 국가소음정보시스템의 공개 환경(자동)·철도 측정자료로 조회합니다. 현재 공개 확정 기간은 환경 2026년 6월, 철도 2026년 상반기이며 실시간이 아닙니다. 측정 지점의 수치를 집의 실제 소음으로 환산하지 않습니다. 데이터 접근 방식·제한·실제 주소 3곳 검증 결과는 [NOISE_REPORT.md](./NOISE_REPORT.md)에 정리했습니다. 현재 연결 방식에는 추가 인증키가 필요하지 않습니다.

최신 전체 점검 결과는 [FULL_AUDIT_REPORT.md](./FULL_AUDIT_REPORT.md)에 있습니다. 수정 후 회귀 검사 31개가 통과했으며, ODsay 실제 성공 조회는 일일 한도 초과로 별도 재검증이 필요합니다.

사용자가 관심 있는 **집 주소·건물명·지역을 직접 입력**하고, 선택한 위치 주변의 생활환경을 확인하며 여러 후보 주소를 저장·메모·비교하는 Next.js App Router / TypeScript / Tailwind CSS 웹앱입니다.

AI는 주소를 고르거나 평가하지 않습니다. **카카오 주소·장소·주변 시설 검색과 지도**, **ODsay 주변 정류장·TMAP 대중교통 경로**를 사용합니다. 국토교통부 3종 월세 API의 실제 조회·계산 검증을 완료했고 OpenAI 생활환경 요약을 연결했습니다. AI는 조회된 근거 항목을 선택해 요약하며 수치·장소·순위를 임의로 생성하지 않습니다.

## AI 요약

서버 환경변수 `OPENAI_API_KEY`를 설정합니다. 모델은 `OPENAI_SUMMARY_MODEL`로 변경할 수 있으며 기본값은 실제 검증한 `gpt-4.1-mini`입니다. `npm run db:migrate`로 AI 전용 테이블도 준비하세요. /summary의 AI 요약하기, /compare의 AI 차이점 요약하기에서 실행합니다. 개인 메모를 전송하지 않으며 생성한 단일 주소 요약은 관심 주소에 따로 저장합니다. 새 요약은 1일 임시 보관하고, 직접 저장한 요약은 해당 주소의 익명 세션과 함께 보관합니다. 상세 변경·검증 결과는 [AI_SUMMARY_REPORT.md](./AI_SUMMARY_REPORT.md)에 있습니다.

## 실행

관심 주소·메모는 Neon PostgreSQL에 저장합니다. `.env.local`에 서버 전용 `DATABASE_URL`을 설정한 뒤 `npm run db:migrate`로 전용 테이블을 준비하세요. 현재 작업에서는 실제 연결·테이블 생성·저장/복원 검증을 완료했습니다. 익명 세션은 30일이며 쿠키 삭제·만료 후에는 이전 보관함을 복구할 수 없습니다. 기존 브라우저 기록은 보존하고 카드의 `DB로 이전`으로 개별 이전합니다. 상세 변경·보안·테스트 결과는 [SAVED_COMPARE_REPORT.md](./SAVED_COMPARE_REPORT.md)에 있습니다. 만료 자료 정리는 `npm run db:cleanup`으로 실행하며 정기 실행은 아직 구성하지 않았습니다.

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인합니다. Windows PowerShell에서 npm.ps1 실행이 차단되면 `npm.cmd run dev`를 사용하세요. Node.js 20.9 이상이 필요합니다.

`.env.example`을 참고해 `.env.local` 또는 기존 `.env`에 아래 변수를 설정하세요. 기존 키 값은 수정하지 않았습니다.

```dotenv
NEXT_PUBLIC_KAKAO_JS_KEY=카카오_JavaScript_키
KAKAO_REST_API_KEY=카카오_REST_API_키
NEXT_PUBLIC_TRANSIT_MODE=web
NEXT_PUBLIC_ODSAY_WEB_API_KEY=ODsay_Web_URI_키
```

월세 기능은 `.env.local`에 `MOLIT_API_KEY`를 설정한 후 서버를 재시작하세요. 공공데이터포털에서 단독/다가구·연립다세대·오피스텔 **전월세** API 3종을 각각 활용 신청해야 합니다. 인증키는 서버에서만 사용합니다. 선택 주소 좌표를 법정 지역으로 확인한 뒤 앞 5자리 시·군·구 코드와 계약월로 조회합니다. 주택 유형·보증금 조건에 맞는 월세 거래의 평균·중앙값·보증금 중앙값을 표시합니다. 자세한 계산·테스트·미검증 사항은 [RENT_REPORT.md](./RENT_REPORT.md)에 정리했습니다.

ODsay Web 키는 브라우저 공개를 전제로 한 키이며 콘솔의 Service URI에 `http://localhost:3000`을 등록해야 합니다. 현재 기존 URI 키로 브라우저 직접 호출을 검증했습니다. Server 키는 공개 변수에 넣지 마세요. 서버 방식은 별도의 Server 플랫폼 키·공인 IP 등록 후 `ODSAY_SERVER_API_KEY` 및 `NEXT_PUBLIC_TRANSIT_MODE=server`를 설정합니다. 자세한 인증·실제 조회 결과는 [TRANSIT_REPORT.md](./TRANSIT_REPORT.md)를 참고하세요.

JavaScript 키는 브라우저 지도 로딩에 사용하는 공개 키입니다. 카카오 개발자 콘솔의 JavaScript SDK 도메인에 `http://localhost:3000`을 등록하고, `127.0.0.1`로 접속하려면 해당 도메인도 등록하세요. 카카오맵 사용 권한도 활성화되어 있어야 합니다. 공개 키 변경 후 개발 서버를 다시 시작하고 프로덕션은 다시 빌드하세요.

REST 키는 `/api/locations/search`, `/api/facilities` 및 `/api/rent`의 법정 지역 확인 서버 코드에서만 사용합니다. `NEXT_PUBLIC_` 접두사를 붙이거나 `next.config`의 클라이언트 환경 설정에 넣지 마세요. 브라우저는 같은 출처의 서버 검색 경로만 호출하며 REST 키를 전달받지 않습니다. 키가 없는 설정, 권한 오류, 시간 초과, 요청 한도 초과는 오류 안내로 표시하며 예시 응답으로 대체하지 않습니다.

| 경로 | 화면 |
| --- | --- |
| `/` | 홈 · 주소 검색 및 선택 |
| `/explore` | 주변 시설 탭 · 지도 · 시설 필터 · 검색 반경 |
| `/transport` | 교통·소음·치안 탭 · 목적지 · 경로 · 월 교통비 · 측정자료 |
| `/summary` | AI 요약 탭 · 요약 조건 · 별도 월세 통계 카드 |
| `/saved` | 저장한 주소 · 직접 작성한 메모 |
| `/compare` | 사용자가 선택한 저장 주소 2~3곳 비교 |
| `/recommend` | 기존 링크 호환용 `/summary` 리다이렉트 |

## 현재 구현

- 집 주소·건물명·장소명을 카카오 주소 검색과 키워드 검색으로 조회해 실제 도로명·지번 주소와 좌표를 표시합니다. 검색 결과 선택과 추가 결과 불러오기, 로딩·빈 결과·오류 상태를 제공합니다.
- 실제 카카오 지도, 선택 주소 기준 마커·라벨, 실제 미터 단위의 반경 원, 드래그·휠·확대·축소·선택 주소로 복귀. PC·모바일 크기 변경 시 SDK relayout으로 지도를 갱신합니다.
- `selectedId`의 주소 좌표와 `mapCenter` 상태 분리. 주소 선택 시에만 해당 위치로 화면 중심을 변경합니다. 지도 이동 이벤트는 `mapCenter`만 변경합니다. 시설 기준과 마커는 항상 선택 주소에 고정됩니다.
- 편의점, 마트·슈퍼, 다이소, 올리브영, 일반 카페, 스터디카페, 프린트카페, 세탁소, 공원, 병원·약국의 10개 시설 필터와 300m/500m/1km 실제 반경 검색. PC·모바일이 같은 상태를 사용하고 새로고침 후 복원합니다.
- 선택한 주소의 좌표로만 시설을 조회하며 지도 이동으로 조회 기준을 바꾸지 않습니다. 실제 API에서 받은 장소만 종류별 마커와 목록에 표시합니다. 마커를 누르면 장소명, 도로명·지번 주소, 기준 주소에서의 직선거리를 확인할 수 있습니다.
- 같은 종류·위치의 시설은 묶음 마커로 표시해 겹침을 줄이며 상세 카드에서 개별 장소를 선택할 수 있습니다. 화면 기본 POI는 검색 마커와 별개입니다.
- 카테고리 검색(CS2/MT1/CE7/HP8/PM9)과 시설별 키워드 검색을 조합하고 API가 제공하는 최대 3페이지/검색어를 조회합니다. 노출 한도 때문에 누락될 수 있는 결과는 ‘일부 결과’로 표시하며 조회 수를 전체 시설 수로 주장하지 않습니다.
- 종류별 로딩·결과 없음·오류·부분 실패·재시도. 반경/주소 변경 시 이전 요청을 취소하고 이전 결과를 즉시 숨깁니다. 동시에 최대 3개 시설 종류를 조회하고 세션 메모리 캐시를 사용합니다.
- 학교/직장 목적지를 실제 카카오 검색 결과로 등록하고 좌표를 저장합니다. 집 주소 선택과 독립적으로 관리합니다.
- ODsay로 선택 주소 주변 버스정류장·지하철역을 조회하고 종류별 지도 표시를 켜고 끕니다. TMAP 실제 왕복 경로의 소요 시간·노선·환승·요금을 표시하고, 입력한 통학 일수로 월 예상 교통비를 계산합니다. 누락된 요금은 정보 없음으로 표시합니다.
- 주소 저장/해제, 메모 작성·수정·저장·삭제, 메모 여부 필터, 저장 순/주소 이름 정렬.
- 비교 후보 최대 3곳 선택·추가·제외, 실제 선택한 주소와 직접 쓴 메모로 비교표 구성, 먼저 볼 항목 변경, 브라우저 인쇄/PDF.
- 비교함에 추가하면 주소함에도 저장됩니다. 저장을 해제하면 비교함에서도 제외되지만 메모는 삭제하지 않습니다.
- 모바일 필터 열기/닫기, 상세 시트 접기/펼치기, 하단 메뉴.
- 추천 순위, 적합도·매칭 점수, 가상 월세/통학/시설 수, 환경 우열 판단 제거.

## 정보 없음 및 미구현 범위

주소 입력 중 자동완성, 지도 경로 선, 실시간 도착, 시외 경로 통합은 미구현입니다. 월세 통계와 AI 요약은 연결되어 있습니다. 지도 배경의 기본 POI는 카카오가 제공하는 지도 표기이며 필터로 숨기는 대상은 앱이 조회한 시설 마커입니다. 기존 좌표 미확인·UI 예시 기록은 보존하지만 실제 지도에 기준 마커를 임의 생성하지 않으며 주소를 다시 검색하도록 안내합니다.

시설은 카카오, 주변 정류장은 ODsay, 대중교통·보행자 경로는 TMAP 실제 조회 결과를 표시합니다. 월세는 조건별 조회하며 응답에 없는 정보는 **정보 없음**입니다. AI 요약은 사용자가 버튼을 누를 때 조회 근거만으로 생성합니다. 소음·범죄·안전성은 추정하지 않습니다. 시설의 명칭·분류는 카카오 등록 정보 기준이며 영업시간이나 24시간 운영을 검증하지 않습니다. 직선거리는 좌표 간 계산값이며 도보 거리·시간이 아닙니다. 비교표에서 같은 반경·목적지·일수·월세 조건으로 실제 정보를 조회할 수 있습니다. API 오류나 누락 정보는 추정하지 않습니다.

로그인·다른 기기와 동기화·실제 공유 링크·전용 PDF 보고서·매물 연동은 제공하지 않습니다. 관심 주소와 개인 메모는 Neon의 익명 DB 보관함에 저장합니다. 비교 선택·목적지·검색 조건은 브라우저에 보관합니다. 실기기/Safari 검증은 수행하지 않았습니다. 조회 실패를 API 결과처럼 보이는 가상 데이터로 대체하지 않습니다.

## 기존 기록 보존

`neighborhood-preview-v1` 기록이 있으면 `neighborhood-preview-v2`로 한 번 이전합니다. 기존 동네 저장/비교/메모/목적지를 보존하되 동네 기록을 정확한 집 주소로 간주하지 않고 **상세 주소 미확인**으로 표시합니다. 기존 통학·예산·태그는 `legacyPreferences`에 보관하며 현재 화면의 선택이나 평가에는 사용하지 않습니다. 이전 키는 삭제하지 않습니다. 새 브라우저에서는 저장 주소와 비교함이 비어 있습니다.

## 재사용 구조

- 공통 `Header`, `Footer`, `Icon`, `Button`, `SaveButton`, `MemoEditor`, localStorage Provider 및 기존 Stitch 색상·로컬 글꼴·카드·비교표 CSS를 재사용합니다.
- 기존 `design-screen.tsx`, `neighborhood-card.tsx`, `saved-screen.tsx`, `compare-screen.tsx` 파일을 주소 중심 화면으로 변경했습니다. `neighborhood-card.tsx`는 파일 위치를 보존하고 `AddressCard`를 내보냅니다.
- `AddressSearch`, `AddressMap`, `FacilityFilters`, `AddressDetails`, `MissingInformation`, `DestinationForm`으로 입력·지도·필터·정보 영역을 나눕니다.
- `src/app/api/locations/search/route.ts`는 서버 전용 카카오 검색, `src/lib/kakao-maps.ts`는 공개 JavaScript 키를 사용하는 클라이언트 SDK 로더입니다.
- `src/app/api/facilities/route.ts`는 서버 전용 카카오 시설 검색, `src/lib/facilities.ts`는 공통 종류/응답 타입·직선거리 계산, `FacilitiesProvider`는 조회·취소·캐시·필터 공유, `FacilityResults`는 실제 조회 목록을 담당합니다.
- 원본 `stitch_ui_ux`, 로컬 이미지/글꼴, 정적 디자인 자료와 재생성 도구는 보존했습니다. 기존 추천용 마크업 JSON은 현재 앱에서 import하거나 렌더링하지 않습니다.
- `.env`의 키 값은 변경하거나 출력하지 않았습니다. GitHub Push와 배포를 하지 않았습니다.

## 검사

```bash
npm run typecheck
npm run build
npm test
node scripts/check-client-secrets.cjs
node scripts/check-git-secrets.cjs
```

브라우저 테스트는 설치된 Google Chrome을 사용하며 실제 카카오 키·허용 도메인·외부 네트워크가 필요합니다. `npm test`에는 실제 주소 3곳을 조회하는 통합 테스트가 포함됩니다. `test-results/screens/`에 반응형 스크린샷, `test-results/kakao-live-1.png`~`3.png`에 실제 지도 스크린샷을 생성합니다. 비밀 키 검사는 빌드 후 `.next/static`에서 설정된 서버 키 값이 포함되는지 검사하며 값 자체는 출력하지 않습니다.

ODsay 실제 정류장·경로 통합 검사 6개는 일일 호출 한도를 보호하기 위해 기본적으로 건너뜁니다. 한도가 남아 있을 때 PowerShell에서 `$env:RUN_ODSAY_LIVE='1'`을 설정하고 실행하세요. 건너뛴 검사는 실제 API 성공으로 집계하지 않습니다. `check-git-secrets.cjs`는 Git에 포함될 후보 파일에서 설정된 키와 DB 접속정보를 검사하며 값은 출력하지 않습니다.

실제 배포 검증은 PowerShell에서 `$env:PRODUCTION_URL='https://배포주소'`를 설정하고 `npm.cmd test -- tests/production.spec.ts`로 실행합니다. 지정하지 않으면 이 3개 검사는 건너뜁니다. 실제 API·AI를 호출하고 격리된 익명 세션에 임시 저장한 주소·메모·요약은 검사 후 삭제합니다. ODsay 한도 오류는 성공 경로로 집계하지 않습니다.

최신 시설 연결 결과는 [FACILITIES_REPORT.md](./FACILITIES_REPORT.md), 이전 카카오 지도 연결 기록은 [KAKAO_MAP_REPORT.md](./KAKAO_MAP_REPORT.md)를 참고하세요. 시설 검증에는 실제 API 10종 × 3개 반경, 실제 마커 클릭/거리/PC·모바일 필터와 오류·빈 결과·늦은 응답·10개 토글 검사가 포함됩니다. 실제 조회 결과 표는 `test-results/**/real-facility-results.json`, 화면은 `test-results/facilities-live-desktop.png`와 `facilities-live-mobile.png`에 생성됩니다.

치안 지도 표시 점검은 [SAFETY_DISPLAY_REPORT.md](./SAFETY_DISPLAY_REPORT.md)를 참고하세요. 교통·소음·치안 탭에서 주변 치안 정보를 열고 지도 표시를 ON으로 전환합니다. 실제 PNG의 투명 여부와 공식 범례 색상을 구분하며, 투명한 영상은 안전한 지역을 뜻하지 않습니다. 집 중심 1km 원을 둘러싼 사각 WMS 영상의 모서리에는 약 1.42km 거리의 자료도 포함됩니다.
