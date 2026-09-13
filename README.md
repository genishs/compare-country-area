# 🌏 대한민국 바로알기 (True Size of Korea)

메르카토르 도법(Web Mercator)으로 인한 지도 면적 왜곡을 보정하여, 대한민국의 실제 크기를 전 세계 다른 나라들과 직관적이고 객관적으로 비교하는 앱 프로젝트입니다.

---

## 📁 프로젝트 디렉터리 구성

* [**`doc/`**](./doc/): 시스템 설계, 기술 스택, 수학 공식 및 오픈 데이터 상세 문서
  * [`01_SYSTEM_ARCHITECTURE.md`](./doc/01_SYSTEM_ARCHITECTURE.md): 시스템 전체 아키텍처 및 UI/UX 설계
  * [`02_TECH_STACK_AND_LIBRARIES.md`](./doc/02_TECH_STACK_AND_LIBRARIES.md): OpenLayers, OSM, Vite, Android WebView 기술 스택
  * [`03_MERCATOR_DISTORTION_MATH.md`](./doc/03_MERCATOR_DISTORTION_MATH.md): 메르카토르 도법 왜곡 수식 및 동적 위도 보정 알고리즘
  * [`04_OPEN_DATA_SPECIFICATION.md`](./doc/04_OPEN_DATA_SPECIFICATION.md): 국가 경계 GeoJSON 및 한글/면적 데이터셋 규격
* [**`web/`**](./web/): OpenLayers 10 + OpenStreetMap 기반 반응형 웹 애플리케이션 코어
* [**`android/`**](./android/): 오프라인 로컬 구동을 위한 Android WebView 래퍼 앱

---

## 🚀 주요 기능

1. **한국 폴리곤 선택 및 드래그 이동**:
   * 지도에서 한국을 선택하면 경계 폴리곤이 강조 표시됩니다.
   * 원하는 나라(유럽, 북미, 아프리카 등)로 드래그하면, **도착한 위도에 맞추어 메르카토르 왜곡 비율을 계산하여 폴리곤 크기가 자동으로 확대/축소**됩니다.
2. **두 국가 1:1 면적 상세 비교**:
   * 한국과 비교할 국가를 클릭하거나 검색하면 하단 비교 패널이 활성화됩니다.
   * 두 나라의 **실제 공식 면적($km^2$)**, **면적 비율(배율)**, **시각적 비교 막대 그래프**를 제공합니다.
   * "지도로 볼 때는 영국이 엄청 커 보이지만 실제로는 한반도 크기와 비슷하다"는 지리적 진실을 직관적으로 학습할 수 있습니다.
3. **국가 경계·면적 데이터는 오프라인 내장, 배경지도는 온라인**:
   * 경량화된 오픈 데이터 GeoJSON 번들이 앱에 내장되어 있어, 국가 경계·한글명·공식 면적 등 핵심 정보는 인터넷 연결 없이도 즉시 확인할 수 있습니다.
   * 다만 배경지도(회색 도로·지형 타일)는 OpenStreetMap 공식 타일서버에서 매번 온라인으로 받아오므로, 지도 배경이 표시되려면 네트워크 연결이 필요합니다. (참고: [`doc/02_TECH_STACK_AND_LIBRARIES.md`](./doc/02_TECH_STACK_AND_LIBRARIES.md))
