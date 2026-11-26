# UI 정리 및 검증 결과

## 화면 구성

- 집 주소 검색과 현재 선택 주소를 3개 탭 위에 공통 배치했습니다. 다른 탭에서 검색해도 해당 탭을 유지하며, 지도 이동으로 기준 주소를 바꾸지 않습니다.
- `/`, `/explore`: 주변 시설 지도, 10개 시설 필터, 300m·500m·1km 반경. 시설 목록은 기본 접힘, 모바일 필터는 버튼으로 엽니다.
- `/transport`: 목적지 등록·대중교통 경로·월 교통비. 주변 정류장과 소음 측정자료는 각각 접어서 표시합니다. 시설 마커는 숨기고 교통·소음 마커만 표시합니다.
- `/summary`: AI 요약 버튼과 결과. 상세 요약 조건과 별도 월세 통계 카드는 접어서 표시합니다. 다른 종류의 지도 마커는 숨깁니다.
- 저장한 집과 2~3곳 주소 비교는 PC·모바일 상단 메뉴에서 계속 접근합니다.
- 기존 녹색·연한 청색·흰색, 폰트, 둥근 카드 스타일을 유지하고 PC는 넓은 지도와 오른쪽 도구, 모바일은 지도 아래 해당 탭 도구를 배치했습니다. 종전의 여러 정보가 한꺼번에 나오는 레이아웃은 변경했습니다.

## 메모

- 긴 지도 화면 인라인 메모를 없애고 지도 오른쪽 아래 메모 버튼으로 변경했습니다.
- PC는 작은 팝업, 모바일은 하단 시트입니다. 닫기·Escape·주소 변경으로 닫을 수 있습니다.
- 주소별 저장 전 작성 내용은 탭 이동과 다른 주소를 조회했다 돌아오는 동안 유지합니다. 저장 전 초안은 메모리에만 있으므로 새로고침 시 보장하지 않습니다.
- 기존 메모 저장·수정·삭제 함수를 재사용합니다. DB에 저장한 주소의 메모는 익명 보관함에 저장하며 새로고침 후 복원됩니다. 저장 전 주소 메모는 기존대로 이 브라우저 기록이며, 주소를 DB에 저장할 때 함께 보관합니다.
- 개인 메모와 API 확인 정보·AI 요약의 구분은 유지했습니다. 저장한 집 목록의 메모 편집은 유지했습니다.

## 수정한 오류

- 미완성 상태였던 `AddressMap`의 탭별 `mode` 속성을 구현해 타입 오류를 해결했습니다.
- 메모 팝업과 탭·닫기 버튼의 겹침을 수정했습니다.
- 주소 선택과 지도 크기 변경이 겹치면 이전 지도 중심을 복원하던 타이밍 문제를 수정했습니다. 선택·이동 시 최신 중심을 공유하고 relayout에서 사용합니다.
- 이전 카드 위치를 찾던 테스트는 새로운 탭과 접이식 카드에서 같은 기능을 확인하도록 수정했습니다.

## 실제 API·DB 검증

- 카카오 실제 주소 3곳: 서울 중구 세종대로 110, 서울 마포구 와우산로 94, 서울 송파구 올림픽로 300. 검색·선택·마커 좌표·지도 중심·확대·드래그·복귀·고정 기준 주소를 검증했습니다.
- 카카오 주변 시설: 10개 종류와 3개 반경의 실제 응답, 거리 범위·마커·필터·직선거리 팝업을 검증했습니다.
- 학교·직장 등록: 실제 건물명과 목적지 검색 결과가 화면의 주소와 일치했습니다.
- 국가소음정보시스템: 실제 주소 3곳의 공개 측정값·측정 시점·출처와 지도 표시, 비교·AI 근거를 검증했습니다. 집 자체의 소음으로 표시하지 않습니다.
- 국토교통부: 3개 주택 유형의 실제 XML, 페이지 수집·평균·중앙값 계산과 화면 값을 검증했습니다.
- Neon: 익명 세션 분리, 쿠키·CSRF·입력 검증, 주소 저장·삭제, 지도 팝업 메모 저장 및 새로고침 복원, 저장 목록 메모 수정·삭제를 검증했습니다. 테스트가 만든 DB 기록은 정리합니다.
- OpenAI: 실제 단일 주소·비교 요약, 조회 근거와 출력의 일치, 소음 출처·시점, AI 저장·복원 및 개인 메모 미전송을 검증했습니다.

## ODsay 제한과 모의 응답 검증

기존 Web/URI 호출 방식·키 설정을 유지했습니다. 실제로 다음 세 쌍의 왕복 경로를 호출했으나 모두 응답 본문에 `429 / Daily quota exceeded`가 반환됐습니다.

1. 망원시장 → 홍익대학교
2. 은평구청 → 연세대학교
3. 롯데월드타워 → 서울시청

따라서 이번 작업에서 **실제 정류장·노선·소요 시간·왕복 요금의 성공 조회와 실제 월 비용은 검증하지 못했습니다.** 정류장 및 경로 UI, 탑승·하차·환승 순서, 방향·도보 시간 누락, 빈 결과·오류, 월 계산 버튼·일수 입력·양방향 요금 합산은 테스트용 응답으로 검증했습니다. 예: 편도 1,500원+1,700원, 22일은 70,400원. 실제 서비스에서는 오류를 표시하며 대체 경로나 요금을 생성하지 않습니다.

## 테스트

- `npm.cmd test -- --grep-invert "real Web/URI transit|LIVE comparison|LIVE direct route guidance" --output=test-results/ui-final-regression`: **39개 통과**.
- 별도 `LIVE direct route guidance` 3개: 위 한도 오류로 실패, 성공으로 집계하지 않습니다. 한도 의존 정류장·실제 비교 추가 검사 4개는 최종 회귀 실행에서 제외했습니다.
- PC 1440px, 모바일 390px 및 기존 반응형 테스트로 탭·가로 넘침·지도 높이·메모 크기·상단 저장/비교 접근을 확인했습니다.
- `npm.cmd run typecheck`: 통과. `npm.cmd run build`: 통과, `/transport` 포함 모든 페이지 생성 완료.
- `node scripts/check-client-secrets.cjs`: 브라우저 자산 14개 검사 통과. 설정된 카카오 REST·OpenAI·Neon·MOLIT 비밀값이 포함되지 않았습니다. ODsay Web/URI 키는 플랫폼 특성상 브라우저 공개 키로 유지합니다.
- 스크린샷: `test-results/workspace-facilities-desktop.png`, `workspace-facilities-mobile.png`, `workspace-transport-mobile.png` 및 각 실제 API 검증 테스트 산출물. 테스트용 주소·시설을 사용한 UI 캡처는 실제 조회 결과 증빙과 구분합니다.

## 변경 파일

화면·공통 UI:

- `src/app/transport/page.tsx` (신규)
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/design-screen.tsx`
- `src/components/shell.tsx`
- `src/components/address-search.tsx`
- `src/components/address-map.tsx`
- `src/components/memo-panel.tsx` (신규)
- `src/components/ui.tsx`
- `src/components/ai-summary-panel.tsx`

탭별 조회 활성화 범위:

- `src/components/facilities-provider.tsx`
- `src/components/transit-provider.tsx`
- `src/components/noise-provider.tsx`

검증·문서:

- `tests/workspace.spec.ts` (신규)
- `tests/app.spec.ts`, `tests/audit.spec.ts`, `tests/kakao-live.spec.ts`
- `tests/facilities.spec.ts`, `tests/transit.spec.ts`, `tests/transit-guidance.spec.ts`
- `tests/noise.spec.ts`, `tests/rent.spec.ts`, `tests/ai-summary.spec.ts`, `tests/saved-db.spec.ts`
- `README.md`, `UI_REFACTOR_REPORT.md`

서버 API·DB 스키마·외부 API 호출 규격은 변경하지 않았습니다.

## 유지·미지원

기존 지도, 시설, 교통, 소음, 월세, 저장, 비교, AI 기능을 유지했습니다. 새 외부 API나 가상 데이터로 대체하는 기능은 추가하지 않았습니다. ODsay 실제 데이터 성공 검증은 제공사의 한도 회복 후 재실행이 필요합니다. GitHub Push·배포는 하지 않았습니다.
