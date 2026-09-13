# 04. 오픈 데이터 사양 및 가공 규격 (Open Data Specification)

이 문서는 본 앱에서 사용할 **국가 경계 폴리곤 및 요약 정보(면적, 한글명 등)**의 데이터 출처, 라이선스, 속성 스키마 및 가공 방안을 정의합니다.

---

## 1. 데이터 소스 (Data Sources)

| 구분 | 1차 소스 (Primary Source) | 보조/보강 소스 (Secondary Source) |
| :--- | :--- | :--- |
| **국가 경계 폴리곤** | **Natural Earth 1:110m Cultural Vectors**<br>(Admin 0 – Countries) | OpenStreetMap Boundaries (참조용) |
| **요약 정보 (면적/한글명)** | **REST Countries API** (`restcountries.com`) | UN Statistics Division / 위키백과 국가별 면적 순위 |
| **라이선스 (License)** | **Public Domain (CC0)**<br>(상업적/비상업적 완전 무료, 귀속 불필요) | Open Data Commons Open Database License (ODbL) |

---

## 2. 데이터 가공 전략 (Data Preprocessing Strategy)

1. **경량화 최적화 (File Size Optimization)**:
   * 1:110m 해상도를 사용하여 전 세계 180여 개국의 경계를 **약 300KB ~ 400KB** 내외의 GeoJSON 1개로 경량화.
   * 모바일 WebView 및 저사양 단말기에서도 지연(Lag) 없이 즉각 파싱 및 렌더링.

2. **단일 번들 파일 생성 (`countries.geojson`)**:
   * 네트워크 연결 없이 100% 오프라인 동작을 보장하기 위해, 앱 내부 `public/data/countries.geojson`에 정적 파일로 포함.
   * 각 국가 Feature의 `properties`에 한글 국가명, 공식 면적($km^2$), 대륙, 국기 이모지 등을 사전 결합(Merge).

---

## 3. GeoJSON 속성 스키마 (Properties Schema)

각 국가 Feature의 `properties` 객체 구조는 다음과 같습니다:

```json
{
  "type": "Feature",
  "id": "KOR",
  "properties": {
    "iso_a2": "KR",
    "iso_a3": "KOR",
    "name_en": "South Korea",
    "name_ko": "대한민국",
    "area_km2": 100432,
    "population": 51780000,
    "continent": "Asia",
    "flag": "🇰🇷",
    "capital": "서울"
  },
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [ ... ]
  }
}
```

### 필드 상세 설명

| 필드명 | 타입 | 설명 | 예시 |
| :--- | :--- | :--- | :--- |
| `iso_a2` | String (2자) | ISO 3166-1 alpha-2 국가 코드 | `"KR"`, `"GB"`, `"US"` |
| `iso_a3` | String (3자) | ISO 3166-1 alpha-3 고유 식별자 | `"KOR"`, `"GBR"`, `"USA"` |
| `name_en` | String | 공식 영어 국가명 | `"South Korea"`, `"United Kingdom"` |
| `name_ko` | String | 한국어 표준 국가명 (검색 및 UI 표시용) | `"대한민국"`, `"영국"`, `"미국"` |
| `area_km2` | Number | **공식 육지/영토 면적 ($km^2$)** | `100432`, `243610` |
| `population` | Number | 대략적인 인구 수 (추가 비교 정보) | `51780000` |
| `continent` | String | 소속 대륙 | `"Asia"`, `"Europe"`, `"Americas"` |
| `flag` | String | 국기 이모지 | `"🇰🇷"`, `"🇬🇧"`, `"🇺🇸"` |

---

## 4. 주요 비교 대상 국가 면적 기준 데이터 예시

| 국가명 | ISO-A3 | 공식 면적 ($km^2$) | 대한민국(남한: 100,432 $km^2$) 대비 비율 | 한반도(전체: 220,748 $km^2$) 대비 비율 |
| :--- | :--- | :--- | :--- | :--- |
| **대한민국 (남한)** | `KOR` | **100,432** | **1.0 배** (기준) | 약 0.45 배 |
| **한반도 (남+북)** | `KOR+PRK`| **220,748** | 약 2.2 배 | **1.0 배** |
| **영국 (United Kingdom)** | `GBR` | **243,610** | **약 2.4 배** | **약 1.1 배** (한반도와 거의 동일) |
| **일본 (Japan)** | `JPN` | **377,975** | **약 3.8 배** | 약 1.7 배 |
| **독일 (Germany)** | `DEU` | **357,022** | **약 3.6 배** | 약 1.6 배 |
| **프랑스 (France)** | `FRA` | **551,695** | **약 5.5 배** | 약 2.5 배 |
| **그린란드 (Greenland)** | `GRL` | **2,166,086** | **약 21.6 배** | 약 9.8 배 (지도에선 아프리카 크기) |
| **미국 (United States)** | `USA` | **9,833,517** | **약 97.9 배** | 약 44.5 배 |
| **브라질 (Brazil)** | `BRA` | **8,515,767** | **약 84.8 배** | 약 38.6 배 |

> 본 앱에서는 **남한(대한민국)**을 기본 단위로 비교하되, 교육적 가치를 높이기 위해 **한반도 전체(남+북)**와의 비교도 토글 선택할 수 있도록 데이터셋에 반영합니다.
