# 주변 정류장 조회 분리

2026-11-26, 로컬 환경 검증. GitHub Push 및 Vercel 배포 없음.

## 현재 구현

- 지하철역: 카카오 로컬 `/v2/local/search/category.json`, `category_group_code=SW8`.
- 버스정류장: 서울특별시 정류소정보조회 서비스 `getStationByPos` 서버 연결 코드를 구현했다. **SEOUL_BUS_API_KEY 설정과 사용자 키 인증 성공을 확인했고, 실제 세 주소에서 버스 결과와 지도 ON/OFF를 검증했다.** 최초에는 키가 없었으나 사용자의 등록 안내 후 재검증을 완료했다.
- 학교·직장 경로: 기존 TMAP 경로 버튼과 별도 양방향 조회를 유지했다. 시설 도보 경로도 기존 TMAP 보행자 API를 유지했다. 주변 정류장 모듈은 TMAP을 호출하지 않는다.
- 버스와 지하철이 독립적인 조회 상태를 가진다. 버스 설정·인증 문제로 지하철 결과를 숨기지 않는다. 미설정/인증 오류/권한/한도/연결 실패/빈 결과/지역 미지원은 별개 상태이다.
- 원래 ODsay 정류장 코드는 `/api/transit/odsay-nearby`와 명시적 `fetchOdsayNearby`로 보존했다. 기본 화면과 비교는 이를 호출하지 않는다.

## 공식 출처와 선택 이유

1. 카카오 로컬 카테고리 문서: https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-category
   - 기존 서버 `KAKAO_REST_API_KEY`를 사용한다. 최대 3페이지·45개 검색 노출 한도는 부분 조회로 표시한다.
2. 서울특별시 정류소정보조회 서비스 및 활용 신청: https://www.data.go.kr/data/15000303/openapi.do
   - 공식 주소 `http://ws.bus.go.kr/api/rest/stationinfo/getStationByPos`.
   - `serviceKey`, `tmX`(경도), `tmY`(위도), `radius`(미터), `resultType=json`으로 서버에서만 요청한다.
   - `stationId`, `stationNm`, `gpsX/gpsY`(WGS84), `arsId`를 매핑한다. GRS80 좌표인 `posX/posY`를 위경도로 사용하지 않는다. 제공된 `dist`를 그대로 믿지 않고 실제 좌표로 직선거리를 재계산한다.
   - JSON과 XML 응답을 처리하며 XML의 정류소 번호 앞자리 0을 보존한다. 도착예정 시간·운행 노선은 이 위치 조회로 추정하지 않는다.
   - 인증키 없는 접속 진단은 공식 HTTP 주소에서 401 / serviceKey 필요 응답을 확인했다. 이는 접속 확인일 뿐 사용자의 인증 성공을 의미하지 않는다. 이 환경의 HTTPS 주소 접속은 확인되지 않았다. 공식 문서상 HTTP 서버 주소를 사용하며, 키를 브라우저나 응답·로그로 반환하지 않는다.
3. 서울시 근접정류소 안내: https://data.seoul.go.kr/dataList/OA-15335/F/1/datasetView.do
4. TAGO 대안 조사: https://www.data.go.kr/data/15096280/standard.do
   - 좌표 기반 근접 조회는 공식 설명상 500m 고정이다. 이를 1km 전체 결과로 표시하지 않기 위해 이번에는 연결하지 않았다. 전국 모든 도시를 지원한다고 표시하지 않는다.

## 범위·거리·화면

- 사용자가 선택한 집의 위경도와 기존 300m/500m/1km 조건을 기준으로 요청한다. 지도 이동으로 기준 주소가 바뀌지 않는다.
- 반환 좌표가 유효하고 선택 반경 안에 있는 실제 장소만 정류소 ID로 중복 제거 후 직선거리순으로 표시한다.
- 지하철역 좌표까지의 직선거리이며 실제 출입구까지의 보행 거리가 아니다.
- 서울시 버스는 카카오 행정구역 응답으로 서울 주소인지 확인한 뒤 요청한다. 서울 밖 주소는 버스 미지원으로 표시하며, 지하철 검색은 계속 제공한다.
- 기존 버스/지하철 ON/OFF는 화면 필터만 바꾼다. 해당 조작으로 TMAP이나 정류소 API를 다시 호출하지 않는다.
- 이름·직선거리·출처를 목록과 마커 상세에 표시한다. 조회 상태는 별도로 표시하고 ‘출처·조회 상태’ 상세를 펼쳐 확인할 수 있다.
- 서버/브라우저는 1분 캐시와 진행 중 요청 병합을 사용한다. 재조회 버튼은 해당 좌표·반경의 캐시를 지우고 명시적으로 갱신한다. ODsay의 한도 차단 캐시와도 분리돼 있다.
- AI와 비교는 새 출처를 사용한다. 조회 실패나 미지원 버스를 ‘정류장 0곳’으로 단정하지 않는다. AI는 공개 정류장 자료를 서버에서 다시 확인하며 TMAP 경로를 새로 호출하지 않는다.

## 실제 검증과 미검증

타입 검사·프로덕션 빌드 성공(23개 경로). 전체 회귀 검사 **60개 통과 / 19개 조건부 건너뜀 / 실패 0개**. 별도 실행 조건인 TMAP/ODsay 실호출, 기존 ODsay 전용 UI fixture, 배포 환경 검사는 이번 성공으로 집계하지 않았다. 소스 인증정보 검사 및 기존 서버 키의 브라우저 번들 미포함 검사도 통과했다. 서울 버스 키 등록 후 추가 검사 3개(변환·모의 서버·실제 3곳)가 통과했고, 등록된 키가 브라우저 번들과 Git 후보 소스에 없음을 재확인했다.

실제 주소 3곳:

- 서울 중구 세종대로 110
- 서울 마포구 와우산로 94
- 서울 송파구 올림픽로 300

각 주소 반경 1km의 실제 SW8 및 서울시 버스 원 응답과 앱 결과를 대조했다. 지도는 1km 범위가 화면에 들어오는 축척으로 맞춰 검사했다. 카카오 SDK는 뷰포트 밖 마커 DOM을 생략할 수 있어 기본 축척에서 DOM 개수를 전체 검색 건수로 오해하지 않는다.

- 실제 성공: 카카오 검색·SW8 지하철 결과, 좌표·거리·목록·마커, 지하철 ON/OFF, 기준 주소 유지, PC·모바일 화면.
- 실제 네트워크 검사: 주변 조회 중 TMAP/ODsay 요청 0건. 서버 모듈도 이들 API를 사용하지 않는다.
- 모의 성공: 서울시 JSON/XML 파싱, 정류장 ID·좌표/거리 검증, 인증 실패 시 지하철 유지, 서울 밖 미지원, 버스 정상 응답과 거리순 통합. 모의 버스는 실제 버스 조회 성공으로 집계하지 않는다.
- 추가 실제 성공: 사용자 키로 서울시 버스 인증·정류소 조회, 버스와 지하철을 함께 표시한 PC·모바일 지도, 버스 ON/OFF 및 복원. 세 주소의 버스 원 응답도 별도로 서버에서 직접 받아 앱 결과와 대조했다. 서울시청 반경 500m 사전 확인에서는 실제 버스정류소 41곳이 조회됐다.
- 이번 작업에서 실제 TMAP 경로/보행자 API를 새로 호출하지 않았다. 기존 기능의 모의·회귀 검사와 분리한다.

## 필요한 설정

1. 위 공공데이터포털 서비스 활용 신청 후 발급 인증키를 서버 `.env.local`의 `SEOUL_BUS_API_KEY`에 넣는다. 실제 값은 채팅·Git에 넣지 않는다.
2. 개발 서버를 재시작하고 승인 전파가 끝난 뒤 ‘정류장 다시 조회’를 누른다. 개발 계정 트래픽 및 승인 상태는 발급 페이지에서 확인한다.
3. 인증 오류가 계속되면 해당 **정류소정보조회 서비스**의 승인 여부를 확인한다. 기존 MOLIT/TMAP 키를 자동으로 재사용하지 않는다.
4. 향후 Vercel을 사용할 때도 서버 환경변수를 별도 등록해야 한다. 이번에는 배포하지 않았다.

## 변경 파일

- `src/lib/nearby-stations.ts`: 공식 결과 변환·소스·AI 근거·오류 구분.
- `src/lib/nearby-stations.server.ts`: 카카오 SW8·행정구역 및 서울 버스 API 연결·캐시.
- `src/lib/nearby-stations-client.ts`: 경로/ODsay 한도 캐시와 별도인 정류장 캐시.
- `src/app/api/transit/nearby/route.ts`: 기본 공공 정류장 API.
- `src/app/api/transit/odsay-nearby/route.ts`: 기존 ODsay 서버 코드 보존.
- `src/lib/transit.ts`, `src/lib/transit-client.ts`: 소스별 조회 상태 및 기본 공급자 전환.
- `src/components/transit-provider.tsx`, `transit-panel.tsx`, `address-map.tsx`: 재조회·지도·목록·ON/OFF·출처 표시.
- `src/lib/ai-evidence.server.ts`, `address-evidence.server.ts`: 실제 출처와 부분 조회/미확인 상태 반영.
- `src/components/shell.tsx`, `src/lib/demo-data.ts`, `README.md`, `.env.example`: 안내·설정.
- `scripts/check-client-secrets.cjs`: 서울 버스 서버 키 검사 추가.
- `tests/public-stations.spec.ts`, `tests/workspace.spec.ts`: 실제 SW8 3곳·모의 버스·기존 UI 검사.
