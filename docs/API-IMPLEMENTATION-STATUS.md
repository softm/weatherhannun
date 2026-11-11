# 2026-11-11 Cloudflare Workers 이전 현황

**이 섹션이 기존 2026-11-02 Firebase 동작 설명보다 최신입니다.**

| 구분 | 실제 상태 |
|---|---|
| Cloudflare Worker 구현 | 완료 (`services/cloudflare-weather/src/index.mjs`) |
| Wrangler + D1 구성 | 완료 (`wrangler.template.toml`, `scripts/provision-d1.mjs`) |
| D1 버전 마이그레이션 | 완료 (`migrations/0001_initial.sql`) |
| GitHub main 푸시 | 완료 |
| GitHub Actions 테스트 | 통과 (Node tests + Wrangler bundle + 로컬 D1 마이그레이션 + HTTP smoke) |
| 스테이징 D1 실제 생성 | **미완료** (Cloudflare Secrets 누락) |
| 스테이징 Worker 실제 배포 | **미완료** |
| 스테이징 날씨 실응답 | **미확인** |
| 운영 Worker 실제 배포 | **미완료** |
| 날씨한눈 웹/Android 호출 전환 | **미완료** |

GitHub Actions 배포 게이트 로그에서 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`가 누락된 것으로 확인했다.
이 때문에 배포와 원격 API 테스트는 건너뛰었으며, CI 성공만으로 배포 성공이라고 표시하지 않는다.

- [이전 설계서](CLOUDFLARE-MIGRATION-DESIGN.md)
- [API 명세서](CLOUDFLARE-API-SPEC.md)
- [GitHub Actions 배포](../.github/workflows/deploy-cloudflare-weather.yml)
- [Wrangler 배포 안내](../services/cloudflare-weather/README.md)

**기존 동작 주의:** 웹 `weather-provider-core.js`, Android `WeatherForecastClient.kt` 모두 Google Cloud `weatherApi` 주소를 여전히 참조한다.
2026-11-11 기존 주소의 외부 HTTP 검사에서는 `weatherApi`, `weatherHealth`가 503으로 응답했다.
기상청·MET Norway 원천 공급자와 GitHub Pages 정적 스냅샷은 Google Cloud Functions와 별개의 경로다.
TTS `weatherBriefingTts`는 아직 Google Cloud로 남아 있어 완전 분리로 표시하면 안 된다.

---

# API 구현·배포 상태 (2026-11-02)

기준: [API-IMPLEMENTATION-PLAN.md](API-IMPLEMENTATION-PLAN.md)

## 운영에 반영된 범위

- GitHub Actions가 매시 07·22·37·52분에 기상청 지상관측·특보·HSR 레이더와 에어코리아 실측을 수집하고, GitHub Pages의 고정된 최신 JSON·PNG 파일을 덮어쓴다.
- 웹은 기기의 마지막 정상 예보와 공식 스냅샷을 먼저 표시하고, 모델 예보와 최신 정적 공식 자료를 서로 막지 않고 갱신한다.
- 웹과 Android 네이티브 예보 클라이언트는 화면 표시를 Firebase 통합 API 응답에 의존하지 않는다. 공식 실황·특보·레이더·대기질은 키가 없는 정적 웹 리소스로 결합한다.
- 기존 Firebase 통합 API와 예약 함수는 배포 상태로 남아 있지만 사용자 화면의 기본 데이터 경로와 Firestore 날씨 캐시로 사용하지 않는다.
- 해외 좌표는 MET Norway Locationforecast를 사용한다. 운영 London 응답으로 공통 계약과 웹 표시를 확인했다.
- 국내 좌표는 기상청 초단기실황·초단기예보·단기예보 수집기와 발표 지연을 고려한 기준시각 계산을 구현했다.
- 워크플로우 수집 실패 시 Pages 배포를 중단해 직전 정상 웹 리소스를 유지한다.
- 결측값은 `null`로 유지하며 모델값을 관측값으로 표시하지 않는다.

## 배포 함수

| 계획 작업명 | Firebase 함수 | 상태 |
|---|---|---|
| 통합 API | `weatherApi` | 배포·MET Norway 실응답 확인 |
| 상태 점검 | `weatherHealth` | 배포·운영 응답 확인 |
| `kma-nowcast-sync` | `kmaNowcastSync` | 배포, 인증키 입력 후 수집 가능 |
| `kma-village-sync` | `kmaVillageSync` | 배포, 인증키 입력 후 수집 가능 |
| `kma-midterm-sync` | `kmaMidtermSync` | 배포, 현재 상태 감사만 수행 |
| `kma-warning-sync` | `kmaWarningSync` | 배포, 현재 상태 감사만 수행 |
| `airkorea-sync` | `airKoreaSync` | 배포, 인증키·측정소 매핑 필요 |
| `metno-active-sync` | `metnoActiveSync` | 배포 |
| `metno-saved-sync` | `metnoSavedSync` | 배포 |
| `wwis-city-sync` | `wwisCitySync` | 배포, 상업 이용 승인 전 차단 |
| `wwis-index-sync` | `wwisIndexSync` | 배포, 상업 이용 승인 전 차단 |
| `forecast-verify` | `forecastVerify` | 배포, 실제 관측이 있는 건만 기온 오차 계산 |
| `notification-evaluate` | `notificationEvaluate` | 배포, 중복 방지 outbox 생성까지 구현 |
| `stale-data-audit` | `staleDataAudit` | 배포 |

## 검증 결과

- 웹 회귀 테스트: 244개 통과
- Playwright 주요 화면 테스트: 해외 MET Norway·국내 키 미설정 폴백 2개 통과
- Android: `testDebugUnitTest assembleDebug` 통과
- 해외 운영 API: MET Norway 기반 공통 계약 v2 응답 확인
- 국내 운영 API: 인증키 미설정 시 HTTP 503과 `domestic_provider_not_configured`를 반환해 임시값을 공식 자료처럼 노출하지 않음

## 아직 완료로 표시하지 않는 항목

- 기상청 및 AirKorea Secret은 배포 구조만 만들었으며 실제 인증키가 없다. 현재 Secret 값은 비활성 표식이므로 사용자가 키를 설정해야 한다.
- 기상청 중기예보·특보는 예약 함수만 존재하며 실제 수집기와 특보 지역 매핑은 미완료다.
- AirKorea는 측정소명이 전달된 요청만 수집할 수 있어 좌표→측정소 자동 매핑이 필요하다.
- WMO WWIS는 상업적 재사용 승인이 확인될 때까지 코드에서 운영 수집을 차단한다.
- 정확도 검증은 실제 관측 이력이 쌓인 경우의 기온 MAE·최대오차만 구현했다. 강수·풍속·상태 분류 및 지역·계절·선행시간 분석은 미완료다.
- 알림 판정은 중복 제거와 outbox 생성까지이며 Android 프로젝트에 Firebase 설정 파일과 Messaging SDK가 없어 FCM 전송은 미완료다.
- KIM·ECMWF는 수집기가 없고 웨더아이는 계약 전 평가 상태다.

## 운영 원칙

공식 스냅샷은 `GitHub Actions → GitHub Pages 최신 웹 리소스`로 유지하고, 좌표별 실시간 조회는 Firebase 공통 API가 담당한다. 국내는 기상청·AirKorea, 해외는 MET Norway를 사용하며 Open-Meteo 직접 호출과 장애 fallback은 두지 않는다. Firestore 날씨 캐시는 공급자 갱신주기에 맞춰 활성·저장 지역 중심으로 유지하고 마지막 정상 자료와 오래됨 상태를 분리한다. WMO 및 유료 공급자는 이용 권한을 확인하기 전 운영 데이터로 노출하지 않는다.
