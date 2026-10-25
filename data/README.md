# 날씨한눈 전국 동·리 검색 데이터

- 데이터: \`korea-regions-202602.json\`, **2026년 2월 기준** 전국 법정동 계층 및 중심 좌표(약 **19,574개** 시·도/시·군·구/읍·면·동/리).
- 원본 재가공: [swuhalee/korea-regions-with-coords](https://github.com/swuhalee/korea-regions-with-coords), \`korea-regions-with-coords.json\`, snapshot \`2026-02\`.
- 원본 출처: [행정안전부 행정표준코드관리시스템](https://www.code.go.kr/), [국토교통부 브이월드 공간정보](https://www.vworld.kr/). **공공누리 제1유형(출처표시)**.
- 해당 원본 데이터를 압축 가능한 계층형 배열로 변환해 정적 GHP 파일로 저장했습니다. 이 앱의 조회 과정에서는 별도 VWorld API 호출이 없습니다.
- 형식: \`{v,source,date,kind,nodes}\`; 각 노드는 \`[name,kindIndex,lat,lon,children?]\` 형태입니다.
- \`kind\` 순서: \`sido, si, gu, gun, eup, myeon, dong, ri\`.
- 날씨 조회 좌표는 법정동 폴리곤의 중심점(지역 대표 좌표)이며 도로명주소·지번의 실제 위치가 아닙니다.
- 데이터 갱신 기준: 법정동 폐지, 신설, 분구, 명칭 변경 등은 \`2026-02\` 이후 반영되지 않을 수 있습니다. 업데이트 시 새 스냅샷을 생성하고 출처 및 기준일을 함께 기록해야 합니다.
- 검색은 완전 로컬 브라우저 JS로 처리하며, 타이핑할 때 제3자 주소 API로 텍스트를 보내지 않습니다.
- 토지이용한눈의 VWorld 주소·장소 결과 분류 UX를 참고했지만, **해당 앱의 특정 운영도메인용 VWorld 키는 재사용하지 않습니다**.
- 정확한 건물·도로명/지번 조회가 필요하면 독립적인 인증키/라이선스와 허용된 도메인을 정식으로 설정해야 합니다.
