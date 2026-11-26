# TMAP 대중교통·보행자 연결

검증일: 2026-11-26 (한국시간). GitHub Push 및 Vercel 배포 없음.

## 공식 문서와 권한

- 대중교통 안내/Free 요금: https://transit.tmapmobility.com/ — Free 하루 10건, 한도 초과 시 자동 차단, 유료 전환은 별도 상품 변경.
- 대중교통 요청·응답·오류 규격: https://transit.tmapmobility.com/docs/routes
- 대중교통 상세 문서: https://tmap-public-skopenapi.readme.io/reference/대중교통-api
- 보행자 경로 규격: https://tmap-skopenapi.readme.io/reference/보행자-경로안내
- TMAP 이용 조건: https://tmapapi.tmapmobility.com/terms.html — 저장 후 24시간 이상 사용 금지.
- TMAP Free 일반 경로안내 한도: https://openapi.sk.com/products/calc?menuSeq=5&svcSeq=4 — 하루 1,000건.

서버의 `TMAP_APP_KEY` 설정을 확인했고, 실제 대중교통과 보행자 API 모두 인증·조회에 성공했다. 키 값은 코드·브라우저·보고서에 넣지 않았다. 계정의 실제 상품·결제 설정 화면에는 접근하지 않았으므로 Free 가입 상태 자체를 별도로 인증한 것은 아니다. 공식 Free 정책과 사용자의 Free 활성화 확인을 전제로 구현했으며, 앱에는 상품 변경·결제·유료 자동 전환 코드가 없다. 제공사 응답을 받기 전에도 DB 카운터로 앱의 무료 한도를 제한한다.

## 실제 조회 검증

| 출발지 | 등록 목적지 | 실제 검증 |
|---|---|---|
| 서울 은평구 은평로 195 (은평구청) | 서울 서대문구 연세로 50 (연세대학교) | 가는 편·오는 편, 승하차·노선·환승·요금·월 비용, 가까운 시설 보행 거리·시간 |
| 서울 송파구 올림픽로 300 (롯데월드타워) | 서울 중구 세종대로 110 (서울시청) | 동일 항목, 모바일 화면 포함 |

새 외부 요청은 대중교통 **4건**(2쌍 × 양방향), 보행자 **2건**이었다. 키별 서버 카운터에서도 이 수량을 확인했다. 이후 같은 좌표 조회는 기존 결과를 재사용하며 신규 요청 여부를 카운터로 다시 확인한다. 3번째 쌍은 무료 한도 절약을 위해 조회하지 않았다.

- `/transit/routes`의 `metaData.plan.itineraries`를 사용하며 최대 응답 수 `count:1`로 요청한다.
- `totalTime`, `legs.sectionTime`은 초 → 올림 분으로 표시한다. `legs.start/end.name`, `legs.route`를 순서대로 표시한다. `transferCount`는 실제 반환값만 사용한다.
- `fare.regular.totalFare`와 `currencyCode:KRW`를 확인한 경우에만 원화 요금으로 사용한다.
- 가는 편과 오는 편을 별도로 요청한다. 월 비용은 선택한 양방향 요금 합계 × 입력 일수이다. 귀가 요금이 없으면 계산하지 않는다.
- 보행자는 `/tmap/routes/pedestrian?version=1`의 GeoJSON `features[].properties.totalDistance/totalTime`을 사용한다. 시설 카드의 직선거리와 구분한다. 임의 보행 속도 계산은 없다.
- 실제 화면의 시간·노선·승하차 이름·환승·요금 및 월 비용을 서버 응답과 비교했다. 원본 초→분 변환 및 누락 필드 처리는 별도 합성 응답 검사로 확인했다. 경로 없음·인증 오류·한도 초과를 실제로 발생시킨 것은 아니며 아래 모의 검사와 구분한다.

## 호출 및 유효기간

- 대중교통은 경로 조회 버튼, 보행자는 시설 목록·마커 선택 시에만 호출한다. 반경·주소 변경 자체나 탭 진입으로 대중교통 경로를 자동 요청하지 않는다.
- 브라우저 세션 캐시와 Neon의 방향별 공유 캐시를 사용한다. 인메모리 요청 병합 및 DB 잠금으로 중복 호출을 방지한다. 다른 서버가 조회 중이면 새 외부 요청 대신 BUSY 상태를 반환한다.
- 최초 조회부터 23시간 이내에 만료한다. 재사용 때 유효기간을 연장하지 않는다. 양방향 결과는 더 먼저 만료되는 방향을 기준으로 한다.
- 만료된 캐시를 읽지 않으며 다음 DB 접근 때 삭제한다. 화면의 경로·보행 정보도 만료되면 숨긴다. 서비스가 꺼져 있는 동안 DB 행을 정기 삭제하는 별도 스케줄러는 없지만 만료 자료는 재사용하지 않는다.
- TMAP 근거를 포함하는 AI 요약은 같은 유효기간을 적용한다. DB 저장 가능 기간도 줄이고, 만료된 저장 요약은 읽을 때 제거하며 화면에서도 내용을 숨긴다. 비교·AI는 유효한 기존 경로만 사용하고 TMAP 경로를 새로 조회하지 않는다.
- Neon의 일일 카운터는 키 해시·한국시간 날짜·API 종류별로 분리한다. 대중교통 10건, 보행자 1,000건까지만 허용한다. 실패한 외부 요청도 사용량에 포함해 보수적으로 제한한다. DB 장애 시 새 호출은 중단한다. 외부 콘솔/다른 앱의 사용량까지 이 카운터가 알 수는 없으며 제공사 제한도 적용된다.
- 인증·상품 권한, 네트워크/제공사 오류, 경로 없음, 한도 초과를 분리한다. 자동 재시도는 없다. 귀가 조회가 실패하면 가는 편은 표시하되 월 비용은 계산하지 않으며 사용자가 다시 눌렀을 때만 귀가 재조회를 시도할 수 있다.

## 유지한 기능과 한계

- 카카오맵·주소 검색·카테고리별 가까운 2곳·필터·검색 반경·치안/소음/월세·메모·저장 기능을 유지했다.
- ODsay 주변 정류장·지하철역 기능과 기존 서버/Web 경로 코드는 유지했다. 기본 경로만 TMAP이다. 명시적 기존 모드는 `NEXT_PUBLIC_TRANSIT_ROUTE_PROVIDER=odsay`이며 변경 후 서버 재시작/재빌드가 필요하다. 오류 시 ODsay로 자동 전환하지 않는다.
- 비교 화면은 각 주소에서 사용자가 먼저 조회한 유효 경로를 사용한다. 캐시가 없으면 교통 탭에서 직접 조회하라는 안내를 표시한다.
- 버스·지하철·도보 이외 이동수단이 포함된 결과는 현재 경로 컴포넌트에서 임의로 변환하지 않고 미지원으로 처리한다.
- 탑승 방면은 현재 매핑한 공식 필드가 없어 생성하지 않는다. API의 구간 시작/종료와 노선만 보여 주며 방향 미제공을 안내한다.
- 도보의 실제 출입구·대기·개별 보행 속도, 대중교통 실제 운행·교통카드 할인 요금을 보장하지 않는다.
- AI 시설 설명은 기존 직선거리 근거를 유지한다. 보행자 조회를 AI 때문에 추가하지 않는다.

## 설정

1. 서버 `.env.local`: `TMAP_APP_KEY` (설정 및 실제 호출 확인 완료), 기존 `DATABASE_URL`.
2. `npm run db:migrate:tmap`: `np_tmap_cache`, `np_tmap_daily`, `np_tmap_locks` 생성. 현재 연결된 Neon에서 적용 완료.
3. 기본 경로는 TMAP. `NEXT_PUBLIC_TRANSIT_ROUTE_PROVIDER=tmap`은 선택적 명시 설정이며 이 변수에 키를 넣지 않는다.
4. 향후 배포 시 서버 환경변수와 DB 테이블을 준비해야 한다. 이번에는 배포하지 않았다.

## 검사 구분

- 최종 전체 검사: **57개 통과 / 19개 조건부 건너뜀 / 실패 0개**. 건너뜀은 ODsay 전용 UI 7개, ODsay 실호출 6개, ODsay 실비교 1개, 배포 3개, 별도 실행하는 TMAP 실검사 2개이다.
- 별도 실제 TMAP 2쌍 검사: **2개 통과**. 최초에 필요한 실제 데이터를 조회한 뒤, 마지막 재검사와 화면 촬영은 캐시로 수행했으며 카운터는 대중교통 4건·보행자 2건으로 유지됐다.
- 타입 검사와 프로덕션 빌드 성공(22개 경로). TMAP_APP_KEY 및 기존 서버 키가 브라우저 번들에 없는지 검사했고 Git 후보 파일 인증정보 검사도 통과했다.
- 검사 중 탭 이동이 완료되기 전에 이전 검색 폼을 제출하던 기존 테스트의 경쟁 상태를 수정했다. 이동 URL과 선택 탭을 기다리도록 한 뒤 최종 전체 검사에서 통과했다.
- 실제: 위 2쌍 왕복·시설 보행, 실제 카카오 SDK PC/모바일, 실제 Neon 캐시/카운터 확인.
- 모의: 노선·구간 변환, 없는 귀가 요금, 오류/경로 없음 구분, 주소 변경 후 늦은 응답 차단, 새로고침/탭 캐시, 만료 후 자동 호출 없음, 동시 요청 병합, 10건 상한 및 제공사 한도 차단. DB 검사도 임시 키 네임스페이스만 사용하고 정리한다.
- ODsay 전용 기존 UI fixture 7개는 ODsay 모드에서만 실행하도록 남겼다. 기본 TMAP 모드는 새 TMAP UI/서버 검사로 검증한다. 실제 ODsay 통합 검사와 실제 TMAP 통합 검사는 각각 `RUN_ODSAY_LIVE=1`, `RUN_TMAP_LIVE=1`일 때만 실행한다.
- 기존 시설 검사에서는 보행자 호출을 모의 실패로 격리해, 전체 검사를 반복해도 TMAP 무료 한도를 쓰지 않도록 했다. 실제 보행 성공은 별도 TMAP 실검사에서만 확인한다.

## 변경 파일

- API/서버: `src/app/api/tmap/{transit,walk}/route.ts`, `src/lib/tmap{,.server,-route.server,-client}.ts`, `scripts/migrate-tmap.cjs`.
- 연결/표시/만료: `src/lib/transit{,-client}.ts`, `src/components/{transit-provider,transit-panel,address-map,facility-walking,comparison-results,ai-summary-panel}.tsx`, `src/components/use-data-expiry.ts`, `src/lib/comparison.ts`, `src/app/globals.css`.
- AI·저장 연계: `src/lib/{ai-evidence.server,address-evidence.server,ai-summary,ai.server,saved.server}.ts`.
- 안내·보안: `src/components/shell.tsx`, `src/lib/demo-data.ts`, `.env.example`, `package.json`, `README.md`, `scripts/check-{client,git}-secrets.cjs`.
- 검사: `tests/tmap{,-server}.spec.ts`, 기존 ODsay 전용 UI 및 시설 관련 테스트의 조건·호출 격리 조정.

새 API 키는 브라우저에 전달하지 않으며 `.env.local`은 Git 제외 상태를 유지한다.
