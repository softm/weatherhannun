# API 구현 착수 점검 (2026-11-02)

기준: [API-IMPLEMENTATION-PLAN.md](API-IMPLEMENTATION-PLAN.md)

## 확인된 현행 구조
- 웹 `app.js`는 `WeatherProviderCore.buildForecastUrl`과 `buildAirUrl`로 Open-Meteo 공개 엔드포인트를 직접 호출한다.
- `weather-provider-core.js`는 비상업 미검증 공급자로 명시한다.
- `firebase.json`에는 TTS Functions 코드베이스만 설정되어 있다.
- Android는 웹 WebView 기반이므로 웹의 데이터 공급자 전환 영향이 있다.

## 구현 게이트
1. 기상청·AirKorea 인증정보를 Firebase Secret Manager에 설정한다.
2. 국내 격자변환, 발표 시각 및 예보 기준 시각 분리, 특보 지역 매핑을 검증한다.
3. MET Norway User-Agent·캐시 조건을 충족한다.
4. WMO WWIS 상업적 재사용에 관한 서면 허가 전에는 운영 노출하지 않는다.
5. 백엔드 통합 응답을 기존 UI 모델과 연결한 뒤 Android WebView 회귀 테스트를 수행한다.
6. Firestore 이력/스케줄러/FCM 배포와 정확도 지표를 실제 검증한다.

## 상태
계획 분석 완료. 공급자 전환, Functions 배포, 운영 API 호출 및 Android 빌드 미완료. 기존 Open-Meteo 직접 호출을 새로운 공식 API로 전환했다고 주장하지 않는다.
