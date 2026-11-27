# 공식 소음 API·CSV 연동 검증 (2026-11-27)

현재 소음 조회는 선택한 집 좌표 기준 **반경 1km 고정**이다. 생활시설·정류장 반경 선택과 분리했으며 서버 API, 카드·지도, 주소 비교, AI 요약에 같은 기준을 적용한다. 아래의 초기 500m 검증 기록은 원본 수치 확인 이력으로 남겨 두었다.

## 고정 1km 검증

- `tests/noise-radius.spec.ts`: 좌표 기반 999.99m 포함 / 1000.01m 제외, 허위 거리 필드 무시, 과거 자료·AI 근거의 범위 밖 지점 제외를 검증한다.
- API는 반경 생략 또는 1000만 허용한다. 300·500·1001·2000 요청은 외부 조회 전에 거절한다. 서버 조회 함수는 반경 인자를 받지 않는다.
- 기본 카드·지도·AI에는 가장 가까운 확인 지점부터 표시한다. 가장 가까운 지점을 기본으로 펼치고 환경·철도 유형은 구분한다. 표시 거리 반올림 전에 실제 좌표로 1km 이내 여부를 판정한다.
- 서울 종로구 우정국로 55: 1km 안 최신 지점 5곳. 가장 가까운 조계사 후문 앞 약 46m, 2026년 2분기 주간 63 / 야간 51 dB(A).
- 서울 영등포구 경인로82길 3-4: 1km 안 영등포 센터플러스 지점. 2026년 상반기 지면 주간 66 / 야간 22시 64 dB(A). 기존 과거 철도 API 자료는 접이식 카드로 유지한다.
- 서울 마포구 하늘공원로 95: 연결된 공식 자료에서 1km 안 확인 가능한 측정값이 반환되지 않았다. 이는 조용한 지역이라는 뜻이 아니며 범위 밖 측정값으로 대체하지 않는다.
- 실제 세 주소에서 생활시설 반경 300m 상태로 소음 1km 카드·지도·AI 일치를 확인한다. PC·모바일 경계 테스트는 모의 좌표·응답으로 별도 구분한다.
- 안내 문구: “선택한 주소 반경 1km 이내에 확인 가능한 공식 소음 측정자료가 없습니다.”

## 실제 인증과 스키마

기존 `MOLIT_API_KEY`를 서버에서만 읽는다. 키가 URL 인코딩되어 있으면 한 번 디코딩한 후 URLSearchParams로 요청을 구성한다. 월세 코드·환경변수는 변경하지 않았다. 요청 URL·키·원본 예외 객체를 로그로 출력하지 않는다.

| 출처 | 실제 확인 | 연결 방식 |
|---|---|---|
| [한국환경공단 철도소음 API](https://www.data.go.kr/data/15164190/openapi.do) | HTTP 200, resultCode=200, 총 82건. 모두 2025년 반기 자료 | GET `https://apis.data.go.kr/B552584/rnmsManualDataService/getRnmsInfo`, `serviceKey`, `pageNo`, `numOfRows`, `returnType=json` |
| [국립환경과학원 환경영향평가 API](https://www.data.go.kr/data/15142831/openapi.do) | 속성 HTTP 201, resultCode=00. WFS HTTP 200 GML 정상 수신 | GET `https://apis.data.go.kr/1480523/NoiseVibrationService/getInfo`, `ServiceKey`, `mgtNo`, `type=json`; WFS는 `getInfoWFS`, `ServiceKey`, `srsName`, `bbox`, `maxFeatures`, `resultType` |
| [한국환경공단 환경소음 CSV](https://www.data.go.kr/data/15065396/fileData.do) | 실제 원본 다운로드 HTTP 200, EUC-KR, 563,055바이트, 5,880행 | `data/noise/environment-2025.csv`; 체크섬·다운로드 시점은 `csv-provenance.json` |

공식 포털 페이지의 Swagger 원문과 [제공기관 가이드](https://www.eiass.go.kr/openapiguide/kei_html/chapter04_13.html)를 확인했다. WFS 가이드의 파라미터 표에는 srs로 쓰인 부분도 있으나 포털 Swagger의 srsName과 실제 EPSG:32652 요청 성공을 기준으로 연결했다. 갱신주기 메타데이터의 실시간 표현을 실제 과거 측정값의 시점으로 사용하지 않는다. CSV는 연간 공개 파일이며 확보한 원본은 2025년 자료다.

## 위치·값·기준

- 철도: 실제 응답에는 좌표가 없다. 국가소음정보시스템 R 측정망의 **동일 지점명·동일 대표노선이 유일한 경우** 공식 좌표와 연결한다. 유일하지 않은 원본 2건은 제외했다. 주소 검색 결과나 건물 중심으로 좌표를 새로 만들지 않는다.
- 철도 필드: `grondDdtmAvgNvl`(지면 주간), `grond22pmMsrmtNvl`(지면 22시), `hnefDdtmAvgNvl`(최고소음도 예상층 주간), `hnef22pmMsrmtNvl`(해당 층 22시), 단위 dB(A). 22시 값을 야간 전체 평균으로 바꾸지 않는다. 최고소음도 예상층은 측정 위치명이며 예측 소음값이라는 뜻으로 사용하지 않는다. `msrmtYr` 및 `frhfyrShyrSeNm`을 표시하고 개별 측정일은 미제공이라고 명시한다.
- CSV: 원본은 측정망·도시·측정지점·지역·측정연도·분기·4회 주간·주간평균·2회 야간·야간평균을 제공한다. 좌표와 개별 측정일은 없다. 도시와 지점명이 공식 EM 위치 목록과 유일하게 일치하는 5,676행만 연결했으며 불명확한 204행은 제외했다. 지점별 최신 유효 분기 1,419곳을 서버 전용 JSON으로 준비했다. 원본의 주간평균·야간평균을 그대로 사용하며 재평균하지 않는다.
- 좌표 결합은 현재 공식 측정망의 동일 지점 위치에 근거한다. 과거 측정 당시 지점 이전 여부를 확인하는 이력 필드는 없다. 해당 한계가 있는 과거 참고 위치이며 집의 정확한 소음 측정 위치가 아니다.
- EIA: WFS의 EPSG:32652 실제 GML Point만 proj4로 WGS84 변환한다. `USE_YN=Y`만 사용하고 선택 주소의 반경 원으로 다시 필터링한다. 속성의 X/Y는 좌표계가 불명확하므로 사용하지 않는다. WFS의 사업코드·조사구분·지점명 모두가 일치하는 속성만 연결한다.
- EIA 자료는 상시 측정망이 아닌 사업 조사 결과다. 별도 진동(dB(V))은 소음으로 사용하지 않는다. 조사 응답에 실측/예측 구분 필드가 없어 분류가 불명확한 수치는 화면·지도·AI 근거로 사용하지 않는다. 영등포 검증 범위에는 지점 1곳과 속성 1곳이 연결됐지만 유효 소음 수치는 0건이었다. 이를 자료 미제공 상태로 표시한다. 임의로 예측 또는 측정으로 분류하지 않는다.

## 표시·캐시

기존 자동·수동·철도 측정망을 유지한다. 동일 공식 지점의 최신 기간 값을 기본 카드·지도·AI에 사용하고, API/CSV의 이전 자료는 별도 접이식 카드로 제공한다. 서로 다른 측정 기준·기간을 평균하거나 집의 실내/현재 소음으로 해석하지 않는다. 모든 거리는 측정지점까지의 직선거리이며 반경을 자동 확대하지 않는다.

원본 API 응답·사업 속성·주소별 WFS는 서버 메모리에서 1시간 캐시하고 진행 중 요청을 병합한다. 인증/한도/조회 실패는 5분 보관하며 자동 재시도하지 않는다. 재시작/다중 서버 간 공유 캐시는 아니다. CSV는 다운로드 시점이 기록된 공개 스냅샷이며 제공조건은 이용허락범위 제한 없음이다. WFS 최대 100개, 사업 속성 최대 3개를 조회하며 상한에 도달하면 일부 자료임을 알린다. 기존 TMAP/월세의 호출 코드·한도·캐시와 분리했다.

## 실제 서울 3곳 검증

반경 500m: 종로구 우정국로 55 / 용산구 녹사평대로 136 / 영등포구 경인로82길 3-4.

- 종로 조계사 후문: 기존 2026년 2분기 주간 63 / 야간 51 dB(A)를 기본값으로 유지. 실제 CSV의 2025년 4분기 주간 60 / 야간 49는 과거 카드에 별도 표시.
- 용산 크라운호텔 앞: 2026년 6월 30일 자동 일평균 75.65, 2026년 2분기 수동 주간 78 / 야간 79. CSV의 2025년 4분기 주간 79 / 야간 76을 별도 표시. 일평균과 주·야간 값은 합치지 않는다.
- 영등포 센터플러스: 기존 2026년 상반기 지면 주간 66 / 22시 64 유지. 실제 철도 API의 2025년 하반기 지면 주간 65 / 22시 63을 과거 카드로 표시. 환경영향평가 WFS/속성은 인증·조회에 성공했으나 연결 지점에 수치가 없었다.

공식 자료가 없거나 조회 실패/인증 실패/한도 초과/수치 미제공이면 출처별 상태를 구분한다. 안전/위험·조용/시끄러움 등급, 소음지도, 범위 밖 측정값, 임의의 주·야간 평균은 생성하지 않는다.

## 재현

1. `node scripts/inspect-noise-public.cjs`: 포털 Swagger 확보.
2. `node scripts/probe-noise-authorized.cjs`: 키를 출력하지 않고 실제 권한 및 CSV 다운로드 메타데이터 확인.
3. `node scripts/download-noise-csv.cjs`: 공식 다운로드 제한 확인 후 원본 확보. 캡차가 필요하면 우회하지 않고 중단.
4. `node scripts/prepare-noise-csv.cjs`: 원본과 공식 위치를 보수적으로 연결해 서버용 JSON 생성.
5. `npm test -- tests/noise-public.spec.ts`: CSV 체크섬/원본 값, 좌표·예외 처리, 실제 서울 3곳, AI·PC/모바일 검증. 실제 호출을 포함한다.

새 환경변수는 필요 없다. 환경영향평가 수치 표시를 확대하려면 제공기관의 실측/예측 구분 정의와 지점별 유효 수치가 필요하다. 키 재발급은 필요하지 않다.

## 이번 연결 작업의 변경 파일

- 런타임: `src/lib/noise-public.server.ts`, `src/lib/noise.server.ts`, `src/lib/noise.ts`, `src/components/noise-panel.tsx`, `src/components/design-screen.tsx`, `src/app/globals.css`
- 공개 데이터: `data/noise/environment-2025.csv`, `data/noise/csv-provenance.json`, `src/data/noise-csv-2025.json`
- 조사·갱신 스크립트: `scripts/inspect-noise-public.cjs`, `scripts/probe-noise-authorized.cjs`, `scripts/probe-noise-wfs.cjs`, `scripts/download-noise-csv.cjs`, `scripts/prepare-noise-csv.cjs`
- 검증: `tests/noise-public.spec.ts`, `tests/noise.spec.ts`, `tests/noise-practical.spec.ts`, `tests/concise-environment.spec.ts`
- 의존성·기록: `package.json`, `package-lock.json`(proj4 추가), `docs/noise-public-data.md`, `docs/noise-data-review.md`

이 작업 이전부터 남아 있던 도보 상세 UI 등 다른 미커밋 변경은 그대로 보존했다.
