/**
 * Chromium Canvas2D 최적화:
 * OpenLayers의 피처 히트 디텍션(forEachFeatureAtPixel) 및 1x1 벤치마크 캔버스에서 발생하는
 * 빈번한 getImageData 호출 시 GPU-CPU 동기화 병목과 콘솔 경고
 * ("Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true")를 방지합니다.
 */
(() => {
  if (typeof window === 'undefined' || !window.HTMLCanvasElement) return;

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    if (type === '2d' && (!options || options.willReadFrequently !== true)) {
      // 64x64 이하의 작은 오프스크린/히트 디텍션 캔버스에 대해 willReadFrequently: true 적용
      // (전체 화면 메인 맵 캔버스의 GPU 하드웨어 가속은 온전히 유지)
      if (this.width <= 64 && this.height <= 64) {
        options = Object.assign({}, options, { willReadFrequently: true });
      }
    }
    return originalGetContext.call(this, type, options);
  };
})();
