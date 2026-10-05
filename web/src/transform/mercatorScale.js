import { toLonLat } from 'ol/proj';

/**
 * 위도에 따른 메르카토르 도형 크기 보정 모듈
 */

/**
 * 위도를 도(deg)에서 라디안(rad)으로 변환
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * 지오메트리의 중심점 (Centroid) 계산 (EPSG:3857 좌표계 기준)
 * @param {import('ol/geom/Geometry').default} geom
 * @returns {Array<number>} [x, y]
 */
export function getGeometryCenter(geom) {
  const extent = geom.getExtent();
  return [
    (extent[0] + extent[2]) / 2,
    (extent[1] + extent[3]) / 2
  ];
}

/**
 * EPSG:3857 평면 좌표로부터 위도(-85 ~ 85도)를 추출
 * @param {Array<number>} coord3857 [x, y]
 * @returns {number} 위도 (도 단위)
 */
export function getLatitudeFrom3857(coord3857) {
  const lonLat = toLonLat(coord3857);
  return lonLat[1];
}

/**
 * 위도에 따른 선형 축척 팩터 및 면적 배율 계산 (순수 계산 함수)
 *
 * @param {number} baseLatDeg 기준 위도 (도)
 * @param {number} targetLatDeg 대상 위도 (도)
 * @returns {{
 *   scaleFactor: number,
 *   areaMultiplier: number,
 *   newLatitude: number,
 *   isLatitudeClamped: boolean
 * }}
 */
export function calculateScaleFactor(baseLatDeg, targetLatDeg) {
  // 극단적인 극지방 왜곡 및 무한대(infinity) 방지를 위해 위도를 -82도 ~ +82도로 클램핑
  const clampedLatDeg = Math.max(-82, Math.min(82, targetLatDeg));
  const isLatitudeClamped = clampedLatDeg !== targetLatDeg;

  const baseLatRad = degToRad(baseLatDeg);
  const currentLatRad = degToRad(clampedLatDeg);

  // 선형 스케일 팩터 S = cos(phi_base) / cos(phi_current)
  // 고위도로 갈수록 cos(phi_current)가 작아지므로 S는 커져서 폴리곤이 시각적으로 팽창함
  const scaleFactor = Math.cos(baseLatRad) / Math.cos(currentLatRad);

  return {
    scaleFactor: Number(scaleFactor.toFixed(3)),
    areaMultiplier: Number((scaleFactor * scaleFactor).toFixed(3)),
    // R-6: 실제 계산에 쓰인 위도(클램프된 값)를 반환
    newLatitude: Number(clampedLatDeg.toFixed(2)),
    isLatitudeClamped
  };
}

/**
 * 원본 지오메트리를 새 위치로 이동하고, 위도 차이에 따른 메르카토르 축척 보정 적용
 *
 * @param {import('ol/geom/Geometry').default} baseGeom 원본 위치(기준 위도)의 지오메트리
 * @param {Array<number>} baseCenter 원본 중심점 [x, y] (EPSG:3857)
 * @param {number} baseLatDeg 원본 중심점의 위도 (도)
 * @param {Array<number>} newCenter 이동된 새 중심점 [x, y] (EPSG:3857)
 * @returns {{
 *   geometry: import('ol/geom/Geometry').default,
 *   scaleFactor: number,
 *   areaMultiplier: number,
 *   newLatitude: number,
 *   isLatitudeClamped: boolean
 * }}
 */
export function scaleGeometryForLatitude(baseGeom, baseCenter, baseLatDeg, newCenter) {
  const newLatDeg = getLatitudeFrom3857(newCenter);
  const scaleInfo = calculateScaleFactor(baseLatDeg, newLatDeg);

  // 원본 지오메트리 복제
  const clonedGeom = baseGeom.clone();

  // 1. 새 중심 위치로 평행이동
  const deltaX = newCenter[0] - baseCenter[0];
  const deltaY = newCenter[1] - baseCenter[1];
  clonedGeom.translate(deltaX, deltaY);

  // 2. 새 중심점을 기준으로 위도 보정치 스케일링
  clonedGeom.scale(scaleInfo.scaleFactor, scaleInfo.scaleFactor, newCenter);

  return {
    geometry: clonedGeom,
    ...scaleInfo
  };
}
