# 주변 버스정류장 수정 (2026-11-27)

추가 배포 검증: 아래 초기 로컬 수정 이후 `a1ce061`을 GitHub main에 Push하고 Vercel 자동 배포 완료를 확인했다. 실제 `https://neighborhood-preview-kzcj.vercel.app`에서 서울 3곳의 공식 파일 기반 조회·마커·버스 ON/OFF·TMAP 도보·재클릭 캐시가 통과했다. `tests/production-bus-stops.spec.ts`와 `test-results/production-bus-final`이 배포 검증 근거다. 키를 출력하지 않았고 위치 파일 방식은 그대로 유지했다.

## 원인과 실제 조사

- 기존 배포 주소 `https://neighborhood-preview-kzcj.vercel.app`의 주변 조회 API는 서울 세 주소 모두 버스 `config_error`와 0건을 반환했다. 원인은 서버 `SEOUL_BUS_API_KEY` 미설정이다. 지하철은 정상 조회됐다. 로컬에서는 해당 키가 있었으므로 배포와 상태가 달랐다.
- 카카오 실제 키워드 검색(반경 500m): ‘버스정류장’은 시청·홍익대·롯데월드타워 모두 0건, ‘정류장’은 시청·홍익대 0건, 롯데월드타워는 택시정류장 1건만 반환했다. 이 검색을 전체 버스정류소 목록으로 사용하지 않았다.
- 카카오 공식 문서: https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
- 원래 서울시 정류소 API 안내: https://www.data.go.kr/data/15000303/openapi.do
- 해당 API의 HTTPS 호출은 타임아웃으로 인증 응답을 확인하지 못했다. HTTP 주소로 공통 키를 보내는 검증은 평문 키 전송 위험으로 자동 승인 검토에서 거절됐다. HTTP 인증 호출·다른 서버를 통한 우회는 수행하지 않았다. `MOLIT_API_KEY`의 이 서비스 이용 권한은 미검증이며, 권한이 없다고 단정하지 않는다.

## 안전하게 연결한 공식 데이터

- 서울특별시 교통정보과, 서울 열린데이터광장 ‘서울시 버스정류소 위치정보’:
  https://data.seoul.go.kr/dataList/OA-15067/S/1/datasetView.do
- 실제 HTTPS 다운로드: `서울시버스정류소위치정보(20261102).xlsx`, 기준 2026-11-02, 게시 2026-11-24. 원본 741,535바이트. 다운로드·체크섬은 `data/transit/seoul-stops-provenance.json`에 기록했다.
- 원본 11,223행 중 한강 선착장 8행을 제외한 실제 도로 버스정류소 11,215곳을 사용한다. 원본 NODE_ID / ARS_ID / 정류소명 / X좌표 / Y좌표 / 정류소타입을 보존한다. 정류소와 좌표를 임의로 생성하지 않는다.
- 포털 설명에는 ‘WGS84 (EPSG-5179)’라는 불일치 표기가 있으므로 실제 원본 값을 확인했다. X=126~127도, Y=37도 형태의 경위도이며 정규화 자료는 원본 값을 그대로 사용한다. 미터 좌표로 잘못 해석하거나 임의 투영 변환하지 않는다.
- 출처표시 조건: 동일 데이터의 공공데이터포털 안내 https://www.data.go.kr/data/15051741/fileData.do (공공누리 제1유형). 서비스 카드에도 서울시 공식 출처 링크와 기준일을 표시한다.
- 원본 ZIP/XLSX를 Python 표준 라이브러리로 읽어 서버 전용 JSON을 생성한다. 앱 설치·실행에는 Python이나 별도 Excel 라이브러리가 필요하지 않다. 데이터 갱신 시에만 준비 스크립트를 실행한다.

## 구현 범위

기존 `/api/transit/nearby` 서버 API가 공식 위치 스냅샷에서 선택 집 좌표와 검색 반경으로 정류소를 조회한다. 외부 서울시 실시간 REST API 연동이 성공한 것으로 표현하지 않는다. 위치 정보이며 실시간 도착·운행 정보가 아니다. 서울 외 지역은 기존처럼 미지원 상태로 구분한다.

카카오맵·주소 검색·SW8 지하철·시설 필터·TMAP 도보/대중교통·소음·치안·월세·AI 요약은 유지했다. 버스 ON/OFF는 기존 필터를 재사용한다. 선택한 정류장의 공식 좌표를 기존 도보 상세 컴포넌트에 전달하며 마커나 목록을 클릭할 때만 TMAP 보행자 API를 호출한다.

서버의 동일 주소·반경 진행 중 요청 병합과 1분 캐시를 유지한다. 캐시 식별에 공식 파일의 체크섬을 포함했다. 브라우저 캐시 버전을 v2로 올려 기존 키 설정 오류를 저장한 v1 캐시를 재사용하지 않는다. 버스 자체는 외부 키나 API 호출이 필요 없어 호출 한도에 영향을 주지 않는다. TMAP 대중교통 API와 분리되어 있다.

큰 위치 JSON을 Tailwind 클래스 검색 대상으로 읽어 개발·빌드가 지연되는 문제도 확인했다. `src/data/**/*.json`만 클래스 검색에서 제외했다. Stitch 화면 JSON·TSX는 그대로 검색하므로 디자인용 클래스는 유지된다.

## 검증

반경 500m, 카카오 지번/도로명 주소 검색으로 얻은 실제 집 좌표 기준:

| 주소 | 공식 파일 기반 버스 정류소 |
|---|---:|
| 서울 중구 세종대로 110 | 40곳 |
| 서울 마포구 와우산로 94 | 39곳 |
| 서울 송파구 올림픽로 300 | 22곳 |

`tests/bus-stops.spec.ts`는 이 세 주소의 원본 정규화 목록·API 응답·지도 마커 수, 버스 ON/OFF, 목록 정류장 선택의 실제 TMAP 목적지 좌표·거리·시간, 동일 정류장 재클릭 캐시, 새로고침 캐시를 검증한다. TMAP 대중교통 API는 호출하지 않았다. 실제 도보 응답은 `test-results/bus-stops-final`에 기록한다. `tests/public-stations.spec.ts`는 별도의 1km 지도·지하철 유지 검증과 모의 요청 병합·캐시·서울 외 미지원 테스트를 수행한다.

추가 키는 필요 없다. 기존 `SEOUL_BUS_API_KEY`·`MOLIT_API_KEY`를 삭제하거나 변경하지 않았다. 추후 원래 외부 REST API를 사용하려면 위 15000303의 활용 승인과 안전한 HTTPS 제공 경로를 확인해야 한다. 공식 위치 자료는 주기적으로 내려받아 갱신해야 하며 현재 파일 이후의 정류소 이전·폐지는 자동 반영하지 않는다.

갱신 명령:

```powershell
node scripts/download-seoul-stops.cjs
python scripts/prepare-seoul-stops.py
```

이번 작업은 로컬 변경이며 GitHub Push·Vercel 배포를 수행하지 않았다. 현재 배포 사이트가 수정된 것으로 보고하지 않는다.

## 완료 결과와 변경 파일

- 정류소·도보 관련 9건 통과(모의 지역명 인코딩 수정 후 재실행 포함), 선택 실행인 별도 8곳 도보 테스트 1건 생략.
- PC/모바일 6개 화면, AI·저장·비교 가독성, 메모·저장 상태, 실제 AI 카드·월세·소음·치안 근거 관련 회귀 12건 통과.
- `npm run typecheck`, `npm run build`, 서버 키의 브라우저 번들·소스 노출 검사 통과.
- 도보 검증: 시청역 218m/202초, 홍익대학교 127m/127초, 잠실역1번·11번출구 319m/257초. 실제 TMAP 응답과 유효 서버 캐시를 사용했으며 대중교통 경로 API는 호출하지 않았다.
- 변경 파일: `src/lib/nearby-stations.server.ts`, `src/lib/nearby-stations.ts`, `src/lib/nearby-stations-client.ts`, `src/data/seoul-bus-stops.json`, `data/transit/seoul-stops.xlsx`, `data/transit/seoul-stops-provenance.json`, `scripts/download-seoul-stops.cjs`, `scripts/prepare-seoul-stops.py`, `scripts/probe-bus-stops.cjs`, `tests/bus-stops.spec.ts`, `tests/public-stations.spec.ts`, `tailwind.config.js`, `.env.example`, `README.md`, 이 보고서. `next-env.d.ts`는 Next.js 개발 서버가 자동 갱신한 파일이다.
