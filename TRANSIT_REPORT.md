# 대중교통 연동 결과

## 제공자 및 키 확인

카카오 공식 제휴 대중교통 API에 현재 REST 키로 요청한 결과 HTTP 403, code -5(permission denied)가 발생했습니다. 해당 키의 권한 부족을 확인했으며 계정의 계약·승인 상태는 콘솔에서 별도로 확인해야 합니다. 카카오 지도·주소·생활시설은 그대로 카카오를 사용합니다.

기존 ODsay 키는 사용자가 확인한 Web/URI 키입니다. 서버 호출에서는 ApiKeyAuthFailed가 발생했지만, 등록된 http://localhost:3000의 실제 Chrome 브라우저에서 pointSearch와 searchPubTransPathT 호출이 모두 성공했습니다. Referer를 위조하지 않았습니다. 현재 기능에 별도 Server 키는 필요하지 않습니다.

현재 무시되는 .env.local에 NEXT_PUBLIC_TRANSIT_MODE=web 및 NEXT_PUBLIC_ODSAY_WEB_API_KEY를 설정했습니다. 기존 .env는 유지했습니다. Web 키는 공식 플랫폼 특성상 브라우저에 공개됩니다. ODsay 콘솔의 Service URI에 실제 접속 주소를 등록해야 하며, localhost와 127.0.0.1은 같은 등록 주소로 가정하지 않습니다. 공개 환경변수 변경 후 재시작·재빌드가 필요합니다. 카카오 REST·OpenAI·DB 등의 비밀 값은 클라이언트에 전달하지 않습니다.

선택 가능한 서버 구현도 유지했습니다. 서버 방식으로 전환하려면 ODsay에서 Server 플랫폼 키를 발급하고 실행 서버의 공인 송신 IP를 등록한 후 ODSAY_SERVER_API_KEY를 설정하고 NEXT_PUBLIC_TRANSIT_MODE=server로 재빌드합니다. Server 키를 NEXT_PUBLIC 변수에 넣으면 안 됩니다. Server 키가 없어 서버 방식의 성공 응답은 아직 실검증하지 않았습니다.

공식 근거: [ODsay Web 안내](https://lab.odsay.com/guide/guide?platform=web), [API 명세](https://lab.odsay.com/guide/releaseReference), [Web Referer 인증 안내](https://lab.odsay.com/community/boardView?seq=674), [Server IP 안내](https://lab.odsay.com/community/boardView?seq=498), [카카오 제휴 대중교통](https://developers.kakaomobility.com/affiliate/publictransit/start).

## 구현

- 선택한 집 주소 기준 300m·500m·1km 정류장 조회, 버스·지하철 ON/OFF, 지도 마커·목록·직선거리. 지도 이동으로 기준 주소가 바뀌지 않습니다.
- 기존 카카오 주소 검색으로 학교·직장을 별도 등록하고 목적지 좌표·일수·왕복 설정을 브라우저에 저장합니다. 기존 주소·메모·비교 기능을 유지했습니다.
- 실제 왕복 경로를 각각 조회하고 경로 선택, 소요 시간, 노선, 환승 횟수, 제공되는 요금을 표시합니다. 같은 구간의 대체 노선은 추가 환승으로 계산하지 않습니다.
- 월 비용은 선택한 실제 가는 편 요금과 오는 편 요금의 합 × 입력 일수입니다. 편도 선택은 가는 편 요금 × 일수입니다. 필요한 요금이 없으면 정보 없음입니다. 할인·정기권을 보장하는 청구 금액은 아닙니다.
- 인증 오류·한도·타임아웃·빈 정류장·경로 없음·방향별 부분 실패·누락 요금 처리. 주소·반경 변경 시 이전 요청 취소 및 오래된 결과 숨김. 가상 결과는 생성하지 않습니다.

## 실제 검증

실제 Chrome에서 카카오로 주소를 검색하고 ODsay 응답과 표시값을 대조했습니다. 아래는 최초 성공 시점의 선택 경로이며 조회 시점·선택 경로에 따라 달라질 수 있습니다.

| 출발 → 목적지 | 500m 정류장 | 편도 시간 | 편도 요금 | 환승 | 22일 왕복 비용 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 망원시장 → 홍익대학교 | 34 | 17분 | 1,500원 | 0 | 59,400원 |
| 은평구청 → 연세대학교 | 17 | 33분 | 1,500원 | 1 | 66,000원 |
| 롯데월드타워 → 서울시청 | 27 | 38분 | 1,650원 | 0 | 72,600원 |

망원시장 경로의 귀가 요금은 실제 응답 1,200원이므로 편도 요금을 임의로 두 배로 하지 않았습니다. 세 번째 조합은 모바일 390px에서도 검증했습니다. 결과는 test-results/**/transit-live-result.json 및 transit-live-1.png~3.png에 생성됩니다.

## 파일 및 한계

최종 검사: `npm.cmd run typecheck` 통과, `npm.cmd run build` 통과, `npm.cmd test` **18개 통과(34.3초)**. 기존 12개 회귀 테스트와 대중교통 6개를 포함합니다. `node scripts/check-client-secrets.cjs`에서 카카오 REST·OpenAI·DB 값이 브라우저 정적 파일에 없음을 확인했습니다. 의도적으로 공개한 ODsay Web 키는 비밀 키 검사와 구분합니다.

주요 추가: transit-provider.tsx, transit-panel.tsx, destination-search.tsx, transit.ts, transit-client.ts, odsay-data.ts, odsay.server.ts, api/transit/nearby·routes, tests/transit.spec.ts, scripts/probe-odsay-web.cjs. 기존 app-provider·layout·address-map·environment-panel·design-screen·globals.css에 상태와 UI를 연결했습니다. 기존 색상·로컬 폰트·반응형 레이아웃을 유지하고 정보 카드에 교통 영역을 추가했습니다.

경로는 상세 텍스트로 표시하며 지도 경로 선, 실시간 도착, 시외 경로 통합, 비교표의 주소별 교통 집계, 할인 요금 모델은 미구현입니다. 월세·AI 요약도 미연결입니다. 실기기·Safari는 검증하지 않았습니다. 기존 카카오 지도·주소 검색·시설 검색은 유지했으며 GitHub Push·배포는 하지 않았습니다.
