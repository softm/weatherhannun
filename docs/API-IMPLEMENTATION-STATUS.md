# API 구현·배포 상태 (2026-11-02)

기준: [API-IMPLEMENTATION-PLAN.md](API-IMPLEMENTATION-PLAN.md)

## 운영에 반영된 범위

- Firebase `softm-hannun-api`의 `asia-northeast3`에 통합 HTTP API, 상태 API와 12개 예약 워크플로우를 배포했다.
- Firestore `suite-v1` 데이터베이스에 응답 캐시, 마지막 정상 응답, 예보 이력, 작업 상태를 저장한다. 콘텐츠 해시가 같으면 쓰기를 생략한다.
- 웹과 Android 네이티브 예보 클라이언트는 통합 API를 먼저 사용하며 기존 Open-Meteo 호출은 명시적인 임시 폴백으로만 남겼다.
- 해외 좌표는 MET Norway Locationforecast를 사용한다. 운영 London 응답으로 공통 계약과 웹 표시를 확인했다.
- 국내 좌표는 기상청 초단기실황·초단기예보·단기예보 수집기와 발표 지연을 고려한 기준시각 계산을 구현했다.
- 공급자 호출에는 제한시간, 최대 3회 지수 백오프, 캐시 및 마지막 정상 데이터 폴백을 적용했다.
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

- 백엔드 단위·계약 테스트: 6개 통과
- 기존 웹 회귀 테스트: 236개 통과
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

Open-Meteo는 신규 핵심 공급자가 아니다. 국내 공식 키가 준비될 때까지 기존 사용자의 화면 중단을 막는 임시 폴백이며 UI에 `임시 모델 예보`와 공식 API 미연결 상태를 표시한다. WMO 및 유료 공급자는 이용 권한을 확인하기 전 운영 데이터로 노출하지 않는다.
