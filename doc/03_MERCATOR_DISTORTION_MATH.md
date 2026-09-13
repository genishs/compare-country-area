# 03. 메르카토르 도법 왜곡 원리 및 보정 수학 공식 (Mercator Distortion & Math)

이 문서는 본 앱의 가장 핵심적인 기능인 **메르카토르 도법 상의 위도별 면적 왜곡 현상과 이를 동적으로 보정/재현하는 수학적 원리 및 알고리즘**을 다룹니다.

---

## 1. 메르카토르 도법(Web Mercator, EPSG:3857)의 수학적 원리

메르카토르 도법은 1569년 게라르두스 메르카토르가 항해용으로 고안한 **정각 원통 도법(Conformal Cylindrical Projection)**입니다.

### 1.1 투영 방정식 (Forward Projection)
경도 $\lambda$, 위도 $\phi$ (라디안 단위)를 평면 좌표 $(x, y)$로 투영할 때의 공식은 다음과 같습니다:

$$x = R \cdot (\lambda - \lambda_0)$$

$$y = R \cdot \ln \left[ \tan \left( \frac{\pi}{4} + \frac{\phi}{2} \right) \right]$$

여기서 $R$은 지구의 반경입니다.

### 1.2 국소 축척 계수 (Scale Factor $k$)
정각 도법이므로 모든 방향에 대한 국소 선형 축척 계수 $k$는 동일하며, 위도 $\phi$에 의해서만 결정됩니다:

$$k(\phi) = \sec(\phi) = \frac{1}{\cos(\phi)}$$

### 1.3 면적 왜곡 계수 (Area Distortion Factor $A$)
가로와 세로가 각각 $k(\phi)$ 배씩 늘어나므로, 평면 지도 상에서 보이는 면적 왜곡률 $A(\phi)$는 축척 계수의 제곱에 비례합니다:

$$A(\phi) = k(\phi)^2 = \frac{1}{\cos^2(\phi)}$$

---

## 2. 위도별 시각적 면적 왜곡 비교

적도($\phi = 0^\circ$)를 기준으로 했을 때 주요 위도별 실제 면적 대비 지도 상 팽창 비율:

| 지역 / 국가 | 대표 위도 ($\phi$) | $\cos(\phi)$ | 선형 축척 $k = \frac{1}{\cos\phi}$ | 지도상 면적 팽창률 ($k^2$) |
| :--- | :--- | :--- | :--- | :--- |
| **적도 (콩고, 인도네시아)** | $0^\circ$ | $1.000$ | $1.000$ 배 | **1.00 배 (왜곡 없음)** |
| **대한민국 (서울)** | $37.5^\circ$ | $0.793$ | $1.261$ 배 | **1.59 배** |
| **영국 (런던)** | $51.5^\circ$ | $0.623$ | $1.605$ 배 | **2.58 배** |
| **노르웨이 / 알래스카** | $65.0^\circ$ | $0.423$ | $2.364$ 배 | **5.59 배** |
| **그린란드 (중부)** | $72.0^\circ$ | $0.309$ | $3.236$ 배 | **10.47 배** |

> **예시**: 그린란드는 실제 면적이 약 216만 $km^2$로 아프리카 대륙(약 3,037만 $km^2$)의 **약 14분의 1**에 불과하지만, 메르카토르 지도에서는 두 영역이 거의 대등한 크기로 보입니다.

---

## 3. 동적 위도 이동 및 형상 보정 알고리즘

본 앱에서 **한국 폴리곤을 드래그하여 다른 위도로 이동시켰을 때, 그 위도에서의 올바른 물리적 크기(외형)를 지도에 표현**하기 위한 알고리즘입니다.

### 3.1 상대 보정 계수 도출
* 한국의 원본 중심 위도: $\phi_{\text{base}} \approx 36.5^\circ$
* 사용자가 드래그하여 이동한 새 중심 위도: $\phi_{\text{current}}$
* 메르카토르 지도 상에서 특정 실제 크기의 물체가 위도 $\phi_{\text{current}}$에 위치할 때 나타나야 하는 시각적 크기는 $\sec(\phi_{\text{current}})$에 비례합니다.
* 따라서 원래 한국의 폴리곤 크기(기준 위도 $\phi_{\text{base}}$에서의 크기) 대비 확대/축소해야 하는 **선형 스케일 팩터 $S$**는 다음과 같습니다:

$$S = \frac{\cos(\phi_{\text{base}})}{\cos(\phi_{\text{current}})}$$

* 면적 기준 배율:
  $$S_{\text{area}} = S^2 = \left( \frac{\cos(\phi_{\text{base}})}{\cos(\phi_{\text{current}})} \right)^2$$

### 3.2 OpenLayers 구현 절차 (Geometry Transformation)

1. **초기화 시점**:
   * 원본 한국 폴리곤 지오메트리를 캐싱 (`baseGeometry = feature.getGeometry().clone()`).
   * 원본 중심점의 EPSG:3857 좌표를 구하고, 이를 EPSG:4326(위경도)로 역투영하여 $\phi_{\text{base}}$(라디안)를 계산.

2. **드래그(Translate) 중/완료 시점**:
   * 이동된 폴리곤의 현재 중심점 좌표 $(X_{\text{current}}, Y_{\text{current}})$ 획득.
   * 현재 중심점의 위도 $\phi_{\text{current}}$ 계산:
     $$\phi_{\text{current}} = \text{toLatitude}(Y_{\text{current}})$$
   * 선형 축척비 $S = \frac{\cos(\phi_{\text{base}})}{\cos(\phi_{\text{current}})}$ 계산.
   * 원본 지오메트리(`baseGeometry`)를 복제하여:
     1. 새 중심점 위치로 평행이동 ($\Delta X = X_{\text{current}} - X_{\text{base}}, \Delta Y = Y_{\text{current}} - Y_{\text{base}}$).
     2. 새 중심점을 원점으로 하여 $S$ 배율로 스케일 적용 (`geometry.scale(S, S, [X_current, Y_current])`).
   * 폴리곤의 기하를 갱신하여 지도에 반영.

```javascript
/**
 * 중심점 기준 위도 보정 스케일 적용 함수
 * @param {import("ol/geom/Polygon").default} baseGeom 원본 위치의 지오메트리
 * @param {Array<number>} baseCenter 원본 중심점 [x, y] (EPSG:3857)
 * @param {Array<number>} newCenter 이동된 새 중심점 [x, y] (EPSG:3857)
 * @param {number} baseLatRad 원본 위도 (라디안)
 */
export function transformPolygonByLatitude(baseGeom, baseCenter, newCenter, baseLatRad) {
  // 새 중심점의 위도(라디안) 계산
  const newCoord4326 = toLonLat(newCenter);
  const newLatRad = (newCoord4326[1] * Math.PI) / 180;

  // 극지방 무한대 발산 방지 (최대 위도 85도로 클램핑)
  const clampedNewLat = Math.min(Math.max(newLatRad, -1.48), 1.48);

  // 선형 스케일 계수 S = cos(phi_base) / cos(phi_new)
  const scale = Math.cos(baseLatRad) / Math.cos(clampedNewLat);

  // 지오메트리 복제 후 위치 이동 및 스케일 변환
  const transformed = baseGeom.clone();
  transformed.translate(newCenter[0] - baseCenter[0], newCenter[1] - baseCenter[1]);
  transformed.scale(scale, scale, newCenter);

  return {
    geometry: transformed,
    scaleFactor: scale,
    areaRatio: scale * scale,
    currentLatitude: newCoord4326[1]
  };
}
```

이 방식을 적용하면 대한민국을 유럽이나 북미, 그린란드로 드래그했을 때 **해당 위도의 지도 축척에 맞게 자연스럽게 팽창**하여 현지 국가들과 한눈에 직관적으로 비교할 수 있습니다.
