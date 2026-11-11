# 날씨한눈 Cloudflare Workers 이전

## 추가 배포 방법 — Cloudflare Git 연동 (브라우저 자동화·GitHub Secrets 불필요)

**권장하는 무료 우회 경로:** Cloudflare의 자체 GitHub 연동(Workers Builds)으로 배포합니다. 기본 자동 생성 배포 토큰으로 Workers와 KV를 관리하며, 별도 TinyFish 결제는 필요하지 않습니다.

1. [Workers & Pages](https://dash.cloudflare.com/324650409b822e9887bee48b932b4d71/workers-and-pages)에 접속해 **Create application → Connect GitHub**를 선택합니다.
2. GitHub 저장소는 `softm/weatherhannun`, 브랜치는 `main`, 서비스명은 **weatherhannun-api**로 지정합니다.
3. Cloudflare Build 설정을 다음과 같이 입력합니다.
   - **Root directory:** `services/cloudflare-weather`
   - **Build command:** `npm install --no-audit --no-fund && npm ci --prefix ../weather-api`
   - **Deploy command:** `npm run deploy:git`
4. 배포 스크립트가 `weatherhannun-api-CACHE` KV를 만들거나 재사용하고 Worker 바인딩을 생성합니다.
5. 배포 후 해당 Worker의 **Settings → Variables & Secrets**에서 `KMA_API_KEY`를 Secret 유형으로 등록합니다. 해당 키는 공공데이터포털 기상청 단기·초단기 API용 키이며 Google Cloud 기능과 무관합니다.
6. **선택:** `AIRKOREA_API_KEY`를 추가하면 `stationName`이 있는 요청에서 대기질을 연동합니다.
7. 실제 Cloudflare Worker URL에서 `/weatherHealth`와 국내·해외 `/weatherApi` 응답을 확인합니다.
8. 검증 뒤 웹의 `weather-provider-core.js`와 Android의 `WeatherForecastClient.kt`에 새 Worker URL을 적용합니다.

KV 무료 플랜은 **읽기 10만 회/일, 쓰기 1,000회/일**입니다. 본 배포는 요청한 격자만 갱신하는 캐시 방식이므로 **별도의 Cron이 없습니다.** 지역별 트래픽이 늘면 KV 쓰기 한도를 먼저 측정해 D1 이전을 진행하세요.

**현재 상태:** 이 구성은 GitHub에 저장된 배포 준비 코드입니다. Cloudflare 대시보드에서 GitHub 연결을 마치기 전까지 실제 서버가 생성되었다는 의미가 아닙니다.

---


현재 Google Cloud Functions의 weatherApi/weatherHealth와 동일한 경로 및 weatherhannun.v2 JSON 계약을 제공하는 Worker 구현입니다.
기존 GitHub Pages 웹앱, Android WebView, 티맵자동실행 Firestore는 변경하지 않습니다.

## 제공 기능

- GET /weatherApi?lat=37.5665&lon=126.978&name=서울: 기상청 초단기·단기예보
- GET /weatherApi?lat=51.5074&lon=-0.1278&name=London: MET Norway 좌표 예보
- GET /weatherHealth: D1 바인딩 및 공급자 키 구성 상태
- D1 weather_cache + weather_locations: 10분(국내)·30분(해외) 캐시 및 마지막 정상 데이터
- Cron 매 10분, 최근 2시간 활성 위치를 최대 3개씩 갱신
- CORS 허용 출처는 softm.github.io와 지정된 개발 환경이며, 외부 서비스 키는 Worker Secrets에 보관

주의: 국내 기상청 인증키가 없으면 503 domestic_provider_not_configured를 반환합니다. 서버는 예보를 가짜로 만들지 않습니다.
AirKorea는 요청에 stationName이 포함되고 키가 있을 때만 연결하며, 정적 기상청 특보·레이더·관측 스냅샷 수집은 기존 GitHub Actions가 그대로 담당합니다.
기상청 중기예보, WWIS 상업 승인, FCM 전송, Google Cloud TTS는 이번 조회 API 이전 범위가 아닙니다.

## 1. Cloudflare D1 생성

Cloudflare 계정에서 Workers 및 D1을 사용할 수 있어야 합니다. 프로젝트 폴더에서 다음을 실행합니다.

```bash
cd services/cloudflare-weather
npm install
npm ci --prefix ../weather-api
npx wrangler login
npx wrangler d1 create weatherhannun
cp wrangler.template.toml wrangler.toml
# 생성 명령이 출력한 database_id를 wrangler.toml의 __D1_DATABASE_ID__에 입력
npx wrangler d1 execute weatherhannun --remote --file=./schema.sql
```

무료 요금제 D1 계정 총 5GB, 개별 DB 500MB, 읽기 500만 행/일, 쓰기 10만 행/일 제한에 유의하세요.

## 2. 테스트 및 최초 Worker 배포

```bash
npm test
npx wrangler deploy --dry-run
npx wrangler deploy
```

## 3. Cloudflare Worker Secrets 설정 및 실제 조회 확인

```bash
npx wrangler secret put KMA_API_KEY
npx wrangler secret put AIRKOREA_API_KEY
curl -i 'https://실제-워커-호스트/weatherHealth'
curl -i 'https://실제-워커-호스트/weatherApi?lat=51.5074&lon=-0.1278&name=London'
curl -i 'https://실제-워커-호스트/weatherApi?lat=37.5665&lon=126.978&name=Seoul'
```

KMA_API_KEY는 기상청 단기·초단기 예보용 공공데이터 서비스키입니다. 기존 GitHub Pages 수집기의 KMA_API_HUB_KEY와 다른 키입니다. 키가 없으면 국내 조회는 503으로 차단됩니다. 키를 소스 또는 GitHub Pages에 넣지 마세요.

실제 생성된 Worker URL이 확인되기 전에는 클라이언트의 기존 Firebase URL을 변경하지 않습니다.
배포 후 Health, 해외/국내 실제 응답, 정상/지연 캐시, CORS와 Android WebView를 검증하세요.
Android 네이티브 백그라운드 알림은 별도 저장소 softm/weatherhannun.android의 WeatherForecastClient.kt에서 기존 Firebase URL을 직접 참조합니다. 새 Worker URL을 확인한 뒤 해당 값도 변경하고 Android 업데이트를 빌드·배포해야 합니다. 웹 API 변경만으로 이미 설치된 Android 네이티브 호출이 자동 이전되지는 않습니다.
Cloudflare에 새 서비스를 만든다는 것은 Firebase 리소스를 삭제한다는 의미가 아닙니다.

## 4. GitHub Actions 자동 배포

.github/workflows/deploy-cloudflare-weather.yml은 push마다 검증을 수행하며, 배포는 별도로 활성화해야 합니다.
GitHub 저장소 Secrets에 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID를 등록하고
Variables에 CLOUDFLARE_DEPLOY_ENABLED=true를 설정해야 배포 단계가 실행됩니다.
Cloudflare Worker Secrets의 KMA_API_KEY / AIRKOREA_API_KEY는 사전에 등록합니다.
기본적으로 배포가 꺼져 있으므로 GitHub 푸시만으로 Cloudflare 서비스가 생성됐다고 오해하지 마세요.

## 5. 프런트엔드 전환 체크

- Cloudflare 실제 Worker 주소를 확인합니다.
- weather-provider-core.js의 FORECAST_ENDPOINT를 기존 https://asia-northeast3-softm-hannun-api.cloudfunctions.net/weatherApi에서 실제 https://.../weatherApi로 교체합니다.
- 기존 TTS URL은 별개의 Cloud Function이며 자동 전환하지 않습니다.
- GitHub Pages 공식 웹사이트 https://softm.github.io/weatherhannun/ 및 Android WebView에서 기능을 검사합니다.
- 안정화 이후에만 옛 Cloud Functions 트래픽/사용량을 점검합니다.

## 가격 제한

Workers Free: 하루 10만 요청(계정 전체), 요청당 CPU 10ms, 계정당 Cron Trigger 5개 제한.
Workers 또는 D1 무료 한도 초과는 자동 과금이 아닌 사용 제한이며, 저장소 초과 시 쓰기가 실패할 수 있습니다.
정기 수집 규모가 커지면 배치 수 및 공급자 호출량을 재설계하세요.
