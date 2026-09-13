# 02. 참조 라이브러리 및 사용 기술 (Tech Stack & Reference Libraries)

이 문서는 **대한민국 바로알기 (compare_country_area)** 프로젝트에서 채택한 프레임워크, 지도 라이브러리, 데이터 처리 및 모바일 래퍼 기술 스택과 라이브러리 선정 이유를 정의합니다.

---

## 1. 기술 스택 요약 (Tech Stack Matrix)

| 구분 | 기술 / 라이브러리 | 버전 | 라이선스 | 주요 용도 |
| :--- | :--- | :--- | :--- | :--- |
| **지도 엔진** | **OpenLayers (`ol`)** | `^10.x` | BSD-2-Clause | 타일 렌더링, 벡터 레이어, 폴리곤 변환 및 드래그 인터랙션 |
| **지도 데이터 (타일)** | **OpenStreetMap (OSM)** | Standard Tile | ODbL / CC-BY-SA | 전 세계 기본 베이스맵 타일 (EPSG:3857 Web Mercator) |
| **빌드 & 번들러** | **Vite** | `^6.x` | MIT | 초고속 HMR 로컬 개발 환경 및 오프라인 경량 번들 빌드 |
| **UI 스타일링** | **Modern Vanilla CSS & UI Components** | CSS3 | - | 반응형 모바일 터치 최적화 UI, 슬라이딩 바텀시트, 비교 차트 |
| **모바일 플랫폼** | **Android WebView (`androidx.webkit`)** | Android 8.0+ (API 26+) | Apache 2.0 | 로컬 Web 산출물을 패키징하여 단독 실행 가능한 안드로이드 앱 구현 |
| **공간 데이터 포맷** | **GeoJSON** | RFC 7946 | - | 국가별 경계 폴리곤 및 메타데이터 표현 |

---

## 2. 주요 라이브러리 선정 배경 및 상세 역할

### 2.1 OpenLayers (`ol`)
* **선정 이유**:
  1. **강력한 투영 변환 및 지리 계산**: `ol/proj` 모듈을 통해 위경도(EPSG:4326)와 웹 메르카토르(EPSG:3857) 간의 무손실 좌표 변환을 완벽 지원.
  2. **기본 제공되는 `ol/interaction/Translate`**: 사용자가 터치 또는 마우스로 폴리곤을 잡고 원하는 위치로 부드럽게 드래그할 수 있는 인터랙션 기본 탑재.
  3. **내장 구면 연산 (`ol/sphere`)**: 폴리곤의 실제 대원 면적 계산(`getArea`) 및 거리/방위각 계산 내장.
  4. **API 키/결제 계정 불필요**: Google Maps나 Mapbox와 달리 개발자 등록이나 신용카드 등록 없이 오픈소스만으로 영구적 무료 사용 가능.

* **주요 사용 모듈**:
  * `ol/Map`: 전체 지도 뷰포트 인스턴스
  * `ol/layer/Tile`: OSM 타일 래스터 레이어
  * `ol/layer/Vector`: 국가 경계 및 이동 폴리곤 렌더링 레이어
  * `ol/source/Vector`: 국가 GeoJSON 데이터 소스
  * `ol/style/Style`, `Fill`, `Stroke`: 국가 폴리곤 색상 및 투명도 스타일링
  * `ol/interaction/Translate`: 폴리곤 실시간 드래그 이동
  * `ol/interaction/Select`: 국가 터치/클릭 선택

### 2.2 OpenStreetMap (OSM)
* **선정 이유**:
  1. 오픈 데이터 생태계의 표준 글로벌 래스터 타일 (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
  2. 본 프로젝트의 핵심 목적은 국가 간 **대략적·객관적 크기 비교**이므로 도로/건물 단위의 초정밀 상용 지도 대신 가볍고 제약 없는 OSM 타일로 충분한 가치를 제공.

### 2.3 Vite (Frontend Build Tool)
* **선정 이유**:
  1. Rollup 기반으로 ES 모듈을 최적화하여 번들 크기를 극소화 (수백 KB 수준).
  2. 로컬 브라우저 개발 시 즉시 반영되는 HMR(Hot Module Replacement)로 개발 생산성 극대화.
  3. 번들링된 단일 정적 파일들을 안드로이드의 `assets/www` 폴더로 손쉽게 배포 가능.

### 2.4 Android WebView & AndroidX Webkit
* **선정 이유**:
  1. OpenLayers로 구축된 웹 앱(HTML/CSS/JS)과 국가 경계·면적 GeoJSON 데이터를 `assets/www`에 번들링해, 앱 자체 UI와 핵심 데이터는 네트워크 없이 로컬에서 완전히 구동됨. 단, 배경지도 타일(OSM)은 OpenStreetMap 공식 타일서버를 실시간으로 호출하므로 지도 배경 표시에는 네트워크 연결이 필요함 — "완전한 오프라인"이 아니라 "핵심 데이터는 오프라인, 배경지도는 온라인" 구조.
  2. `WebViewAssetLoader`를 사용하여 CORS 보안 에러 없이 로컬 `assets/` 파일들을 표준 `https://appassets.androidplatform.net/` 도메인 형태로 안전하게 로딩.
  3. 네이티브 하드웨어 가속(Hardware Acceleration)이 적용되어 60fps의 매끄러운 캔버스 렌더링 지원.
  4. OSM 공식 타일 정책 준수를 위해 `WebView.settings.userAgentString`에 앱 식별 User-Agent(`DaehanmingukBaroalgi/1.0`)를 추가해 호출 주체를 명시함.

---

## 3. 의존성 정의 (`package.json`)

```json
{
  "name": "compare-country-area-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "ol": "^10.4.0"
  },
  "devDependencies": {
    "vite": "^6.2.0"
  }
}
```
