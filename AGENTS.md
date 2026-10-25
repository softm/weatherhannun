# AGENTS.md — 날씨한눈 배포 기준 (2026-10-26)

## 단일 운영 원칙

- **소스의 기준은 오직 [softm/weatherhannun](https://github.com/softm/weatherhannun) `main` 브랜치입니다.**
- **공식 운영 웹앱은 오직 [GitHub Pages](https://softm.github.io/weatherhannun/)입니다.**
- 배포는 `.github/workflows/pages.yml` (GitHub Actions → GitHub Pages)을 통해서만 수행합니다.
- Vercel, Netlify 또는 기타 별도 호스팅 프로젝트를 만들거나 이 날씨 앱을 배포하지 않습니다.
- 날씨한눈의 README, 앱 공유 링크, 중앙 프로젝트 목록, Android WebView 링크는 모두 위 GitHub Pages 공식 URL을 사용합니다.
- 기존 외부 호스팅의 잔여 링크를 발견하면 GitHub Pages 주소로 교체합니다.
- Vercel 관련 구성·토큰·Secrets를 이 저장소에 추가하지 않습니다.

## 배포 점검

1. 소스 수정 → `main` 브랜치 커밋/푸시
2. [Publish WeatherHannun](https://github.com/softm/weatherhannun/actions/workflows/pages.yml) 정상 완료 확인
3. `https://softm.github.io/weatherhannun/`의 실제 화면, 위치 권한, 지역 저장·수정·삭제 검증
4. 문제가 발생하면 GitHub Pages 배포·캐시 및 스크립트를 수정합니다. 별도 호스팅에 대체 배포하지 않습니다.

## 개인정보

- GPS 좌표는 명시적 위치 권한 또는 사용자의 위치 선택과 연동합니다.
- 사용자가 공유 버튼을 누르기 전에는 URL에 선택 좌표를 자동 추가하지 않습니다.
- 현재 날씨 데이터는 모델 예보이며 기상청 공식 실황·특보로 표시하지 않습니다.

## 데이터 이용권

Open-Meteo 비상업 무료 API의 상업적 이용 조건을 준수하고, 광고 추가 전 적법한 데이터 소스로 전환하거나 상업용 라이선스를 확보합니다.
