import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { createEmpty, extend } from 'ol/extent';
import Translate from 'ol/interaction/Translate';
import Collection from 'ol/Collection';
import Feature from 'ol/Feature';

import {
  getGeometryCenter,
  getLatitudeFrom3857,
  scaleGeometryForLatitude
} from '../transform/mercatorScale';

// R-9: 스타일 함수가 feature 인자를 쓰지 않으면서도 매 렌더 프레임마다 새 Style
// 인스턴스를 만들면 177개 폴리곤 x 프레임마다 GC 압박이 생긴다. 값이 고정이므로
// 모듈 상수로 한 번만 생성해 재사용한다.
const COUNTRY_STYLE = new Style({
  fill: new Fill({ color: 'rgba(235, 240, 245, 0.4)' }),
  stroke: new Stroke({ color: '#94a3b8', width: 1 })
});

// R-8: GeoJSON 로드 실패 시 폴링이 무한 반복되지 않도록 상한을 둔다.
const FEATURE_POLL_INTERVAL_MS = 100;
const FEATURE_POLL_MAX_ATTEMPTS = 100; // 100ms * 100 = 10초

// 기준 국가(드래그해서 옮기는 나라). 비교 대상으로는 고르지 않는다.
const BASE_ISO = 'KOR';

// '원위치' 때 돌아가는 한국 중심(경도, 위도)과 줌
const KOREA_CENTER_LONLAT = [127.8, 36.5];
const KOREA_HOME_ZOOM = 4;

// 나라에 맞춰 지도를 옮길 때 허용하는 최대 줌 (작은 나라를 너무 크게 확대하지 않도록)
const FIT_MAX_ZOOM = 6;

// getFitPadding 옵션이 없을 때 쓰는 view.fit padding [위, 오른쪽, 아래, 왼쪽]
const DEFAULT_FIT_PADDING = [100, 100, 240, 100];

export class MapManager {
  constructor(targetElementId, options = {}) {
    this.targetId = targetElementId;
    this.onCountrySelect = options.onCountrySelect || (() => {});
    this.onScaleChange = options.onScaleChange || (() => {});
    // R-7: 국가 피처 로드가 끝난 뒤 실제로 호출되는 콜백. main.js가 고정 setTimeout으로
    // "다 됐겠지" 하고 넘겨짚는 대신 이 콜백을 신호로 삼도록 한다.
    this.onFeaturesReady = options.onFeaturesReady || (() => {});
    // 지도 위에 떠 있는 UI(상단 헤더·하단 시트)에 가리지 않게 view.fit에 줄 padding을 돌려주는 함수.
    // 화면 크기와 비교 카드 높이에 따라 달라지므로 맞출 때마다 새로 묻는다.
    this.getFitPadding = options.getFitPadding || null;
    // 국가 데이터가 오기 전 첫 프레임에 보여 줄 범위 [서, 남, 동, 북] (경도·위도)
    this.initialExtentLonLat = options.initialExtentLonLat || null;

    // 상태 보관
    this.baseKoreaFeature = null;
    this.baseKoreaGeometry = null;
    this.baseKoreaCenter = null;
    this.baseKoreaLat = 36.5;

    this.activeKoreaFeature = null;
    this.targetCountryFeature = null;

    this.initMap();
  }

  initMap() {
    // 1. OSM 기본 타일 레이어
    this.osmLayer = new TileLayer({
      source: new OSM({
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      })
    });

    // 2. 전체 국가 베이스 레이어 (은은한 경계)
    this.countriesSource = new VectorSource({
      url: './data/countries.geojson',
      format: new GeoJSON()
    });

    this.countriesSource.on('featuresloaderror', (evt) => {
      console.error('[MapManager] countriesSource featuresloaderror event:', evt);
      this.handleDataLoadError('featuresloaderror event fired');
    });

    this.countriesLayer = new VectorLayer({
      source: this.countriesSource,
      style: COUNTRY_STYLE
    });

    // 3. 비교 대상 국가(Country B) 강조 레이어
    this.targetSource = new VectorSource();
    this.targetLayer = new VectorLayer({
      source: this.targetSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(59, 130, 246, 0.4)' }), // 블루 반투명
        stroke: new Stroke({ color: '#1d4ed8', width: 2.5 })
      })
    });

    // 4. 이동 가능한 대한민국(Country A) 레이어
    this.koreaSource = new VectorSource();
    this.koreaLayer = new VectorLayer({
      source: this.koreaSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(34, 197, 94, 0.55)' }), // 에메랄드 그린 반투명
        stroke: new Stroke({ color: '#15803d', width: 2.5 })
      })
    });

    // 5. 지도 뷰 생성 (한국 중심)
    this.view = new View({
      center: fromLonLat(KOREA_CENTER_LONLAT),
      zoom: KOREA_HOME_ZOOM,
      minZoom: 2,
      maxZoom: 12
    });

    // 6. OpenLayers Map 인스턴스
    this.map = new Map({
      target: this.targetId,
      layers: [
        this.osmLayer,
        this.countriesLayer,
        this.targetLayer,
        this.koreaLayer
      ],
      view: this.view
    });

    // 첫 화면: 국가 데이터(GeoJSON)를 읽는 동안에도 처음 비교할 두 나라가 들어오는 범위를 먼저
    // 띄워 둔다. 데이터가 오면 main.js가 실제 두 나라 범위로 다시 맞춘다.
    const size = this.map.getSize();
    if (this.initialExtentLonLat && size && size[0] > 0 && size[1] > 0) {
      this.view.fit(transformExtent(this.initialExtentLonLat, 'EPSG:4326', 'EPSG:3857'), {
        padding: this.fitPadding(),
        maxZoom: FIT_MAX_ZOOM
      });
    }

    this.setupInteractions();
    this.showLoadingNotice();
    this.loadInitialKorea();
  }

  /** view.fit에 줄 padding [위, 오른쪽, 아래, 왼쪽] */
  fitPadding() {
    return (this.getFitPadding && this.getFitPadding()) || DEFAULT_FIT_PADDING;
  }

  /** 범위(또는 도형)가 위아래 UI에 가리지 않고 보이도록 지도를 옮긴다. */
  fitToView(geometryOrExtent, { duration = 800, maxZoom = FIT_MAX_ZOOM } = {}) {
    this.view.fit(geometryOrExtent, {
      padding: this.fitPadding(),
      duration,
      maxZoom
    });
  }

  /**
   * 국가 데이터를 읽는 동안 지도 위에 작은 안내를 띄운다. 기기에 따라 몇 초 걸릴 수 있어
   * 빈 지도만 보이면 멈춘 것처럼 보이기 때문이다. 로드가 끝나거나 실패하면 지운다.
   */
  showLoadingNotice() {
    const target = document.getElementById(this.targetId);
    const host = (target && target.parentElement) || document.body;

    this.loadingNotice = document.createElement('div');
    this.loadingNotice.className = 'data-loading-notice';
    this.loadingNotice.textContent = '국가 경계 데이터를 불러오는 중…';
    host.appendChild(this.loadingNotice);
  }

  hideLoadingNotice() {
    if (this.loadingNotice) {
      this.loadingNotice.remove();
      this.loadingNotice = null;
    }
  }

  setupInteractions() {
    // 이동 대상 피처 컬렉션 (한국 피처만 드래그 가능)
    this.draggableFeatures = new Collection();

    this.translateInteraction = new Translate({
      features: this.draggableFeatures
    });
    this.map.addInteraction(this.translateInteraction);

    // 드래그 진행 중 실시간 위도 왜곡 스케일링
    this.translateInteraction.on('translating', (evt) => {
      this.handleKoreaTranslation();
    });

    // 드래그 완료 시
    this.translateInteraction.on('translateend', (evt) => {
      this.handleKoreaTranslation();
    });

    // 국가 클릭 선택
    this.map.on('singleclick', (evt) => {
      // 드래그 인터랙션 중이 아닐 때만 클릭 처리
      let clickedCountry = null;

      this.map.forEachFeatureAtPixel(evt.pixel, (feat, layer) => {
        if (layer === this.countriesLayer && !clickedCountry) {
          clickedCountry = feat;
        }
      });

      if (clickedCountry) {
        const props = clickedCountry.getProperties();
        if (props.iso_a3 === BASE_ISO) return; // 한국 자체 클릭은 대상 국가로 지정하지 않음
        this.setTargetCountry(clickedCountry);
      }
    });

    // 마우스 커서 호버 피드백 (터치 기기 환경에서는 불필요한 Canvas getImageData 리드백 방지를 위해 비활성화)
    const hasHoverSupport = (typeof window !== 'undefined' && window.matchMedia)
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : (typeof window !== 'undefined' && !('ontouchstart' in window) && !(navigator?.maxTouchPoints > 0));

    if (hasHoverSupport) {
      this.map.on('pointermove', (evt) => {
        if (evt.dragging) return;
        if (evt.originalEvent && evt.originalEvent.pointerType === 'touch') return;
        const hit = this.map.hasFeatureAtPixel(evt.pixel, {
          layerFilter: (layer) => layer === this.koreaLayer || layer === this.countriesLayer
        });
        this.map.getTargetElement().style.cursor = hit ? 'pointer' : '';
      });
    }
  }

  loadInitialKorea() {
    // GeoJSON 로드 완료 대기 (R-8: 폴링 상한을 두어 무한 재귀를 방지)
    let attempts = 0;
    const checkFeatures = () => {
      const features = this.countriesSource.getFeatures();
      if (features.length === 0) {
        attempts += 1;
        if (attempts >= FEATURE_POLL_MAX_ATTEMPTS) {
          this.handleDataLoadError('국가 데이터를 불러오지 못했습니다. 앱을 다시 시작해 주세요.');
          return;
        }
        setTimeout(checkFeatures, FEATURE_POLL_INTERVAL_MS);
        return;
      }

      this.hideLoadingNotice();

      // 한국 피처 찾기
      const kor = features.find(f => {
        const p = f.getProperties();
        return p.iso_a3 === BASE_ISO || p.name_en === 'South Korea';
      });

      if (kor) {
        this.initKoreaDraggable(kor);
      } else {
        this.handleDataLoadError('한국 데이터를 찾을 수 없습니다. 데이터 파일을 확인해 주세요.');
      }

      // 피처 로드 완료 통지 (한국 유무와 무관하게 검색/선택 API는 이제 사용 가능)
      this.onFeaturesReady();
    };

    const state = this.countriesSource.getState();
    console.log('[MapManager] loadInitialKorea initial source state:', state);

    const onSourceChange = () => {
      const currentState = this.countriesSource.getState();
      console.log('[MapManager] countriesSource change state:', currentState);
      if (currentState === 'ready') {
        this.countriesSource.un('change', onSourceChange);
        checkFeatures();
      } else if (currentState === 'error') {
        this.countriesSource.un('change', onSourceChange);
        this.handleDataLoadError('source state is error on change');
      }
    };

    if (state === 'ready') {
      checkFeatures();
    } else {
      this.countriesSource.on('change', onSourceChange);
    }
  }

  /**
   * R-8: GeoJSON 로드 실패(네트워크 오류, 404, 파싱 오류 등)를 조용히 삼키지 않고
   * 사용자에게 눈에 보이는 에러 배너로 알린다.
   */
  handleDataLoadError(message = '국가 경계 데이터를 불러오지 못했습니다. 앱을 재시작하거나 네트워크 상태를 확인해 주세요.') {
    if (this._dataErrorShown) return;
    this._dataErrorShown = true;
    this.hideLoadingNotice();

    console.error('[MapManager] 국가 데이터 로드 실패:', message);
    console.trace('[MapManager] handleDataLoadError stack trace');

    const target = document.getElementById(this.targetId);
    const host = (target && target.parentElement) || document.body;

    const banner = document.createElement('div');
    banner.className = 'data-error-banner';
    banner.textContent = `[DEBUG: ${message}] 국가 경계 데이터를 불러오지 못했습니다. 앱을 재시작하거나 네트워크 상태를 확인해 주세요.`;
    host.appendChild(banner);
  }

  initKoreaDraggable(korFeature) {
    this.baseKoreaFeature = korFeature;
    const geom = korFeature.getGeometry();
    this.baseKoreaGeometry = geom.clone();
    this.baseKoreaCenter = getGeometryCenter(this.baseKoreaGeometry);
    this.baseKoreaLat = getLatitudeFrom3857(this.baseKoreaCenter);

    // 복제된 활성 한국 피처 생성
    // R-5: getProperties()에는 'geometry' 키(원본 배경 레이어의 지오메트리 참조)가
    // 섞여 있어 스프레드 순서상 위 geometry 옵션을 덮어써 버린다. 그 결과 새 피처가
    // clone이 아닌 배경 countries 레이어의 한국 지오메트리 "객체"를 공유하게 되고,
    // 드래그 첫 프레임에 배경 한국 폴리곤까지 같이 밀려버리는 버그가 생긴다.
    const koreaProps = { ...korFeature.getProperties() };
    delete koreaProps.geometry;
    this.activeKoreaFeature = new Feature({
      geometry: this.baseKoreaGeometry.clone(),
      ...koreaProps
    });

    this.koreaSource.clear();
    this.koreaSource.addFeature(this.activeKoreaFeature);

    this.draggableFeatures.clear();
    this.draggableFeatures.push(this.activeKoreaFeature);

    // 초기 상태 이벤트 알림
    this.onCountrySelect({
      type: 'base',
      country: korFeature.getProperties()
    });

    this.onScaleChange({
      scaleFactor: 1.0,
      areaMultiplier: 1.0,
      newLatitude: this.baseKoreaLat,
      isLatitudeClamped: false
    });
  }

  handleKoreaTranslation() {
    if (!this.activeKoreaFeature || !this.baseKoreaGeometry) return;

    const currentGeom = this.activeKoreaFeature.getGeometry();
    const currentCenter = getGeometryCenter(currentGeom);

    // 위도 보정 계산
    const result = scaleGeometryForLatitude(
      this.baseKoreaGeometry,
      this.baseKoreaCenter,
      this.baseKoreaLat,
      currentCenter
    );

    // 새롭게 스케일된 기하로 즉시 업데이트
    this.activeKoreaFeature.setGeometry(result.geometry);

    this.onScaleChange(result);
  }

  resetKoreaPosition() {
    if (!this.activeKoreaFeature || !this.baseKoreaGeometry) return;

    this.activeKoreaFeature.setGeometry(this.baseKoreaGeometry.clone());

    this.onScaleChange({
      scaleFactor: 1.0,
      areaMultiplier: 1.0,
      newLatitude: this.baseKoreaLat,
      isLatitudeClamped: false
    });

    // #10: 단순 중심 이동 대신 하단 카드 패딩을 감안하는 fitToView를 써서
    // 휴대폰 세로 모드에서도 한국이 카드 밑에 가리지 않고 상단 가시 영역에 보이게 한다.
    this.fitToView(this.baseKoreaGeometry.getExtent(), {
      duration: 600,
      maxZoom: KOREA_HOME_ZOOM
    });
  }

  setTargetCountry(feature) {
    this.targetCountryFeature = feature;
    this.targetSource.clear();

    // R-5: 동일 패턴 정리 — geometry 키를 지운 뒤 스프레드해야 clone이 실제로 유지된다.
    const targetProps = { ...feature.getProperties() };
    delete targetProps.geometry;
    const clone = new Feature({
      geometry: feature.getGeometry().clone(),
      ...targetProps
    });
    this.targetSource.addFeature(clone);

    this.onCountrySelect({
      type: 'target',
      country: feature.getProperties()
    });
  }

  /**
   * 비교 대상 국가를 고르고 그 나라로 지도를 옮긴다.
   * @param {string} isoA3 국가 코드 (iso_a3 또는 iso_a2)
   * @param {{withKorea?: boolean}} [options] withKorea가 true면 한국과 대상 국가가 함께 보이는 범위로 맞춘다
   *     (첫 화면용). 기본은 대상 국가 범위.
   */
  selectCountryByIso(isoA3, { withKorea = false } = {}) {
    const features = this.countriesSource.getFeatures();
    const target = features.find(f => {
      const p = f.getProperties();
      return p.iso_a3 === isoA3 || p.iso_a2 === isoA3;
    });

    if (target) {
      // 기준 국가(한국)를 고르면 한국 대 한국 비교가 되므로 비교 대상은 그대로 두고, 지금 한국
      // 폴리곤이 있는 곳(드래그로 옮겨 두었으면 그 자리)으로 지도만 옮긴다.
      if (target.get('iso_a3') === BASE_ISO) {
        if (this.activeKoreaFeature) {
          this.fitToView(this.activeKoreaFeature.getGeometry().getExtent());
        }
        return;
      }

      this.setTargetCountry(target);

      // 대상 국가로 뷰포트 이동. getExtent()는 도형이 캐시한 배열이라 직접 늘리면 안 되므로 새 범위에 합친다.
      const extent = createEmpty();
      extend(extent, target.getGeometry().getExtent());
      if (withKorea && this.activeKoreaFeature) {
        extend(extent, this.activeKoreaFeature.getGeometry().getExtent());
      }
      this.fitToView(extent, { duration: withKorea ? 500 : 800 });
    }
  }

  searchCountry(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const features = this.countriesSource.getFeatures();
    return features
      .map(f => f.getProperties())
      .filter(p => {
        const ko = (p.name_ko || '').toLowerCase();
        const en = (p.name_en || '').toLowerCase();
        const iso = (p.iso_a3 || '').toLowerCase();
        return ko.includes(q) || en.includes(q) || iso.includes(q);
      });
  }
}
