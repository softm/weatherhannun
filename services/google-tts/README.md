# 날씨한눈 Google Chirp 3 HD 중계

공개 GitHub Pages와 APK에 Google 인증정보를 넣지 않기 위한 Firebase Functions 2세대 서비스입니다. ADC 서비스 계정으로 Cloud Text-to-Speech를 호출하고 `ko-KR-Chirp3-HD-Kore` MP3를 반환합니다.

```bash
gcloud services enable run.googleapis.com texttospeech.googleapis.com cloudbuild.googleapis.com
gcloud services enable texttospeech.googleapis.com --project softm-hannun-api
firebase deploy --only functions:weather-briefing-tts --project softm-hannun-api
```

배포 서비스 계정에는 Text-to-Speech 사용에 필요한 최소 권한만 부여합니다. 운영 URL을 웹의 `weatherhannun-tts-endpoint` 메타에 설정하기 전 결제 예산·할당량·상업 이용 조건을 확인합니다. 서비스는 문장당 350자, 운영 Origin, IP별 분당 30회로 제한하며 인스턴스 내 최근 음원 256개를 재사용합니다. 공개 Origin 검사는 비용 공격을 완전히 막는 인증 수단이 아니므로 운영 배포에는 Cloud Armor/App Check 계열 보호와 Google Cloud 예산·API 할당량을 함께 설정해야 합니다. 영구 비용 절감을 위해 다음 단계에서 Cloud CDN/Storage 캐시를 연결할 수 있습니다.
