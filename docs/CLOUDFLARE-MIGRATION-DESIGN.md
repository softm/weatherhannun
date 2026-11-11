# 날씨한눈 Cloudflare 이전 설계서 (2026-11-11)

## 목표와 운영 경계

Google Cloud Functions의 `weatherApi`와 `weatherHealth`만 먼저 Cloudflare Workers + D1로 교체한다.
GitHub Pages는 그대로 유지하며, Cloudflare 신규 API가 실제로 응답하기 전에는 웹/Android 호출 주소를 변경하지 않는다.
`softm-hannun-api`의 Cloud Functions, Firestore `suite-v1` 및 티맵자동실행의 Firestore는 삭제하거나 변경하지 않는다.

## 실제 호출별 분류

| 사용처 | 현행 호출/원천 | 새 처리 | 전환 게이트 |
|---|---|---|---|
| 날씨한눈 웹 | `weather-provider-core.js`의 `weatherApi` | `/weatherApi` Worker | 국내·해외 실응답 검증 이후 |
| Android 네이티브 알림·위젯 | `WeatherForecastClient.kt`의 `weatherApi` | 동일 Worker | 새 APK 빌드 및 앱 배포 필요 |
| 서버 상태 | `weatherHealth` | `/weatherHealth` | D1 실제 조회 성공 |
| 기상청 초단기실황·단기예보 | `apis.data.go.kr/1360000/VilageFcstInfoService_2.0` | Worker가 공식 공급자 그대로 사용 | `KMA_API_KEY` 실제 키 |
| MET Norway | `api.met.no/weatherapi/locationforecast/2.0/compact` | Worker 동일 공급자 | 해외 실응답 200 |
| AirKorea | `apis.data.go.kr/B552584/...` | 요청에 stationName이 있을 때 Worker 선택적 수집 | 실제 측정소·키 확인 |
| 기상청 특보·레이더·전국 대기질 스냅샷 | `scripts/sync-official-data.mjs` + GitHub Actions | 유지 | 기존 정적 배포 점검 |
| 음성 브리핑 | `weatherBriefingTts` Cloud Function | 별도 프로젝트로 추후 이전 | TTS 공급자/유료 조건 확인 |
| 로그인 | 공통 `suiteAuth` 등 | 이 프로젝트 범위 밖 | 독립 인증 이전 프로젝트 |

## 시스템 구조

1. GitHub Pages 웹 / Android -> Cloudflare Worker `/weatherApi`.
2. Worker는 대한민국 좌표를 기상청 격자 `kr_nx_ny`, 해외 좌표를 반올림 격자로 정규화한다.
3. Cloudflare D1은 `weather_cache` 최신 응답과 `weather_locations` 갱신 대상 지역만 보관한다.
4. 새 좌표는 외부 원천 API를 읽고 D1에 저장한다. 이미 저장된 결과는 국내 10분 / 해외 30분 기준으로 재사용한다.
5. 마지막 정상값은 공급자 실패 시 `stale=true`로 노출한다. 10분 간격 Cron이 활성 지역을 최대 3개씩 갱신한다. 이 분할 방식은 대규모 수집 완료를 보장하지 않으며 활성 지역 수가 많을 경우 확장해야 한다.
6. 기상특보·레이더 스냅샷은 기존 GitHub Pages의 `data/official/latest.json`을 계속 이용한다.

## 무료 요금/보안 대책

- Workers Free는 계정 전체 하루 100,000 요청 / 요청당 CPU 10ms / Cron 5개 제한. 외부 API/DB 접근에 앞서 Cloudflare Rate Limiting Binding (IP당 분당 240회, 엣지별 근사 제한)을 적용한다.
- Rate Limiting은 엄격한 글로벌 한도 수단은 아니다. 운영에서는 앱별 호출량·기상청 키별 요청량과 D1 행 읽기·쓰기를 따로 관찰한다.
- DB는 D1 무료 할당량을 기준으로 운영. 매 요청 시 원천 API를 부르지 않고 격자 캐시를 이용한다.
- API 키는 Worker Secrets 또는 GitHub Actions 환경 Secrets에만 저장. 위치 정보는 격자 단위로 보관한다.
- CORS는 GitHub Pages와 개발용 localhost만 허용. CORS는 서버 간 호출을 막는 인증이 아니며 요청 제한과 별개다.
- 국내 키가 없으면 `503 domestic_provider_not_configured`를 반환하고 허위 기상 데이터를 만들지 않는다.
- Workers Free 초과 시 정상 응답이 차단될 수 있다. 과금 방어를 위해 명시적으로 플랜 업그레이드하지 않는다.

## CI/CD

1. `.github/workflows/deploy-cloudflare-weather.yml`에서 테스트와 Wrangler 번들 빌드.
2. 일회성 로컬 D1 마이그레이션과 HTTP 검증.
3. Cloudflare 인증정보가 존재할 때에만 `scripts/provision-d1.mjs staging`으로 별도 D1/Worker 프로비저닝.
4. `wrangler d1 migrations apply DB --remote`로 스키마 반영.
5. `wrangler deploy` 후 Worker Secrets 적용.
6. 실제 URL에서 `weatherHealth`, 잘못된 좌표, 런던 MET Norway, 서울 기상청, CORS 검사.
7. 검증 결과를 Actions 실행 로그 및 `weather-deployment-status.json` 아티팩트에 기록.
8. 운영 배포는 workflow_dispatch와 `DEPLOY_PRODUCTION` 확인으로만 실행한다.
9. 운영 호출 전환은 스테이징·운영 API 검증을 모두 완료한 별도 커밋으로 수행한다.

## 상태 구분

`작성` / `main 푸시` / `CI 테스트` / `Cloudflare 배포` / `실제 응답` / `운영 반영`은 모두 별도 확인한다.
마지막 셋은 Wrangler 배포 기록과 HTTP 실응답 없이는 완료 처리하지 않는다.

## CI 인증정보

- 필수 GitHub Repository 또는 `cloudflare-weather` Environment Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- 국내 실응답 필수: `KMA_API_KEY`
- 국내 대기질 선택: `AIRKOREA_API_KEY`
- Production 환경 Secrets는 `cloudflare-weather-production` 별도 환경으로 독립 관리한다.
- API token은 대상 계정의 Workers 배포/생성과 D1 생성/목록/마이그레이션을 수행할 권한이 필요하다.
- Secret이 없으면 실행 단계에 정확히 누락 이름을 출력하고 staging deploy를 건너뛴다. 성공으로 오인하지 않도록 실제 배포 상태 별도 표시한다.
