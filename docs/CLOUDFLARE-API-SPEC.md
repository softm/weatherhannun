# 날씨한눈 Cloudflare REST API 명세서 (v2, 2026-11-11)

기준 소스: `services/cloudflare-weather/src/index.mjs`, 기존 `services/weather-api/core.mjs` 및 `providers.mjs`.

## GET /weatherHealth (또는 /health)

- 인증: 없음. GET만 허용. Origin 헤더가 있으면 허용 출처 확인.
- 성공: HTTP 200, `{ok:true,backend:"cloudflare-workers",database:"d1",providers:{metNorway:"ready",kma:"configured"|"missing_secret",airKorea:"configured"|"missing_secret",wwis:"approval_required"},checkedAt:"ISO"}`.
- 실패: DB 바인딩 또는 테이블 접근 오류 시 HTTP 503, `ok:false`.
- 주의: Health 200은 DB 접근과 구성 상태 확인이며 외부 원천 API가 정상 동작하는 보장은 아니다.

## GET /weatherApi

| Query | 형식 | 필수 | 비고 |
|---|---|---|---|
| `lat` | -90~90 숫자 | 예 | 위도 |
| `lon` | -180~180 숫자 | 예 | 경도 |
| `name` | 문자열 (최대 80) | 아니오 | 기본값 '선택 지역' |
| `stationName` | 문자열 (최대 80) | 아니오 | 국내 AirKorea 측정소명이 지정된 경우 사용 |

응답은 기존 `weatherhannun.v2` JSON 계약 유지:

```json
{
  "contractVersion": "weatherhannun.v2",
  "location": {"lat": 37.5665, "lon": 126.978, "name": "Seoul", "country": "KR", "timezone": "Asia/Seoul"},
  "current": {"time": "ISO-8601", "temperature": null, "humidity": null, "conditionCode": null},
  "hourly": [],
  "daily": [],
  "airQuality": null,
  "alerts": [],
  "officialForecast": null,
  "comparison": null,
  "source": {"provider": "kma", "issuedAt": null, "fetchedAt": "ISO-8601", "attribution": "기상청"},
  "stale": false,
  "cache": {"hit": false, "fallback": false}
}
```

위 코드는 **필드 구조 예시**로 실제 기온 또는 원천 실측값이 아니다. 숫자 결측은 `null`을 유지한다.

해외 `source.provider`는 `met-no`이며, 국내는 `kma`다. 국내 기상청 예보를 해외 MET Norway 예보로 조용히 대체하지 않는다.

## HTTP 오류

| 코드 | 반환 error | 발생 조건 |
|---|---|---|
| 400 | `invalid_coordinates` | 좌표 누락·형식 오류 |
| 403 | `origin_not_allowed` | 허용되지 않은 웹 Origin |
| 404 | `not_found` | 미등록 API 경로 |
| 405 | `method_not_allowed` | GET/OPTIONS 이외 요청 |
| 429 | `rate_limited` | Cloudflare Rate Limiting Binding 제한 |
| 502 | `weather_provider_unavailable` | 원천 API 실패 + 캐시 없음 |
| 503 | `domestic_provider_not_configured` | 국내 기상청 키 미설정 |
| 503 | `weather_database_unavailable` | D1 읽기 오류 |
| 503 | `rate_limit_unavailable` | Rate Limiting 서비스 오류 |

**캐시:** 국내 10분 / 해외 30분. 만료된 캐시는 `stale:true`를 포함해 반환하고 Cron 갱신 결과를 후속 조회에 적용한다.
클라이언트는 `source.fetchedAt`·`source.issuedAt`를 구별하며, 캐시의 갱신 시각을 기상청 공식 발표 시각으로 표시하지 않는다.

**CORS:** `https://softm.github.io`, 개발 localhost(8080) 및 명시적 허용 출처. OPTIONS 프리플라이트 지원.

## 전환에서 제외하는 API

- `weatherBriefingTts/v1/briefing/speech` : Google Cloud TTS이며 이번 Worker는 오디오를 제공하지 않는다.
- `suiteAuth`, `suiteSocialAuth` 등 공통 로그인: 날씨 API와 독립된 서비스.
- `data/official/latest.json`: GitHub Pages 정적 자료로 별도 제공.
- WMO WWIS: 상업 재사용 승인 확인 전에는 수집하지 않는다.

## 검증 케이스

- `/weatherHealth` HTTP 200, `database=d1`
- 잘못된 `lat` HTTP 400
- 런던 요청 HTTP 200, `source.provider=met-no`, `hourly` 비어 있지 않음
- 서울 요청 HTTP 200, `source.provider=kma`, `hourly` 비어 있지 않음 (실제 기상청 키 필요)
- GitHub Pages Origin 응답에 `Access-Control-Allow-Origin` 존재
- 국내 키 미설정 HTTP 503, 허위 온도 필드 없음
- 기존 프런트엔드와 Android 응답 계약 유지
