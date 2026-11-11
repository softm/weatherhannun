# 날씨한눈 Cloudflare Workers + D1 배포 가이드

기준: [이전 설계서](../../docs/CLOUDFLARE-MIGRATION-DESIGN.md) · [API 명세](../../docs/CLOUDFLARE-API-SPEC.md)

이 프로젝트는 기존 Firebase `weatherApi` / `weatherHealth`의 `weatherhannun.v2` 응답을 유지하면서
Cloudflare Workers + D1으로 이전하는 서버 코드입니다. 웹은 GitHub Pages를 계속 사용합니다.
티맵자동실행 Firestore, 기존 Google Cloud API, 공통 로그인, TTS는 변경하지 않습니다.

## 배포 상태 (2026-11-11)

- Worker 소스·Wrangler·D1 마이그레이션·GitHub Actions CI는 `main`에 푸시됨.
- Wrangler 번들, D1 로컬 마이그레이션, 실제 로컬 HTTP 테스트 성공.
- 실제 원격 Cloudflare 스테이징 배포는 **아직 성공하지 않음**.
- GitHub Actions 실행에서 `CLOUDFLARE_API_TOKEN` 및 `CLOUDFLARE_ACCOUNT_ID` 누락으로 스테이징 배포 단계가 안전하게 생략됨.
- 운영 웹·Android의 Google Cloud URL은 **변경하지 않음**. 실응답 검증 없이는 변경 금지.

## 1. GitHub Actions 자동 배포 설정

GitHub 저장소 [Settings → Secrets and variables → Actions](https://github.com/softm/weatherhannun/settings/secrets/actions)에
다음 Secret을 등록합니다. 기존 Environment `cloudflare-weather`를 쓰거나 Repository Secrets를 사용합니다.

| Secret | 필요성 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 필수. Cloudflare Workers 생성·배포와 D1 목록·생성·수정 권한 |
| `CLOUDFLARE_ACCOUNT_ID` | 필수. 대상 Cloudflare 계정 ID |
| `KMA_API_KEY` | 국내 예보 실응답에 필수. 기상청 공공데이터포털 단기·초단기 서비스키 |
| `AIRKOREA_API_KEY` | 선택. stationName 요청의 AirKorea 실측 |

Google Cloud의 Secret Manager에 키가 있었다고 해도 GitHub Actions에는 자동 전달되지 않습니다.
Cloudflare 계정에 기존 사용 가능 API Token이 없다면 계정에서 권한을 제한해 새 토큰을 발급해야 합니다.
토큰과 인증키를 채팅·Git 커밋·GitHub Pages 리소스에 기록하지 마세요.

`main`에 Worker 소스나 배포 Workflow가 푸시되면 다음 순서로 동작합니다.

1. Node 테스트 / Wrangler 실제 번들 검사.
2. 로컬 D1 버전 마이그레이션 / Wrangler 로컬 HTTP 통합검사.
3. Secrets가 있으면 `weatherhannun-staging` D1 생성 또는 기존 UUID 재사용.
4. `wrangler d1 migrations apply DB --remote` 실행.
5. `weatherhannun-api-staging` Worker 배포 후 키를 Worker Secrets에 저장.
6. 배포 출력으로 실제 workers.dev URL을 확인하고 Health·런던·서울·CORS를 실측.
7. 검증 JSON을 GitHub Actions artifact로 저장. 실패·키 미설정은 구분해 기록.

Secrets 누락 시 GitHub Actions의 테스트 단계는 성공해도 **실제 Cloudflare 배포는 생략**됩니다.
[GitHub Actions 확인](https://github.com/softm/weatherhannun/actions/workflows/deploy-cloudflare-weather.yml)

## 2. Wrangler CLI 직접 배포

```bash
cd services/cloudflare-weather
npm install
npm ci --prefix ../weather-api
npx wrangler login
# Cloudflare 계정 인증 완료 후:
node scripts/provision-d1.mjs staging
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
# 인증키가 있다면 명령 실행 후 별도 입력:
npx wrangler secret put KMA_API_KEY --config wrangler.toml
npx wrangler secret put AIRKOREA_API_KEY --config wrangler.toml
```

`scripts/provision-d1.mjs`은 비대화식 환경변수 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`를 확인합니다.
로컬 `wrangler login`만 사용한다면 환경변수 대신 인증 방식에 맞춰 스크립트를 조정하거나 Wrangler CLI로
D1을 만들고 실제 UUID를 `wrangler.toml`에 주입하세요. (현재 GitHub Actions는 토큰 방식으로 구성했습니다.)

## 3. 스테이징 / 운영 분리

| 환경 | Worker | D1 |
|---|---|---|
| staging | `weatherhannun-api-staging` | `weatherhannun-staging` |
| production | `weatherhannun-api` | `weatherhannun` |

운영 배포는 GitHub Actions `workflow_dispatch`에서 `target=production`을 선택하고
`confirmation=DEPLOY_PRODUCTION`을 입력한 경우에만 실행합니다.
운영 환경 Secrets는 `cloudflare-weather-production`으로 분리합니다.
기존 운영 앱 연결 주소는 배포 성공만으로 자동 변경되지 않습니다.

## 4. API 검증

```bash
node scripts/smoke-remote.mjs 'https://실제배포된워커.실제계정.workers.dev'
```

이 스크립트는 `weather-deployment-status.json`을 출력합니다.
해외 MET Norway 200, 국내 KMA 200, DB Health 200 등 모든 조건이 충족된 뒤에만
`productionCutoverReady=true`로 표시합니다.
국내 키가 미설정되어 503이 반환되면 국내 기능은 아직 복구되지 않은 것입니다.

검증 후 `weather-provider-core.js`의 `FORECAST_ENDPOINT`와
Android 저장소 `WeatherForecastClient.kt`의 `COMMON_API`를 각각 변경해야 합니다.
TTS 메타 태그는 별개의 Google Cloud API이므로 별도 마이그레이션 대상입니다.

## 5. 무료 플랜·보호

Workers Free 계정 전체 일 10만 요청, CPU 10ms/요청 제한.
Rate Limiting Binding은 IP 기준 분당 240회로 설정(Cloudflare 위치별 **근사** 제한)하며
엄격한 글로벌 한도는 아닙니다. D1 무료 사용량, 기상청 원천 API 호출량,
캐시 적중률과 지연시간을 별도로 측정하세요.
국내 키 미설정 시 서버가 임의 수치를 생성하지 않고 503으로 실패하도록 구성되어 있습니다.

## 6. KV 기반 이전 시도와 구분

`wrangler.kv.template.toml`, `scripts/deploy-git.mjs`, `src/kv-backend.mjs`은
초기 KV 실험 구현으로 보존합니다. **현재 권장·기본 CI/CD는 D1 기반 Wrangler 배포**이며,
KV 플랜용 Build 연동을 운영 전환의 근거로 사용하지 않습니다.
