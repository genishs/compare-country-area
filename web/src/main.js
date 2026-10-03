import { MapManager } from './map/mapManager';
import { ComparisonSheet } from './ui/comparisonSheet';

// 첫 화면에서 한국과 함께 보여 줄 비교 대상 국가
const DEFAULT_TARGET_ISO = 'JPN';
// 국가 데이터가 오기 전 첫 프레임에 띄울 범위 — 한국+일본 [서, 남, 동, 북] (경도·위도).
// DEFAULT_TARGET_ISO를 바꾸면 함께 바꾼다. 데이터가 오면 실제 두 나라 범위로 다시 맞춘다.
const INITIAL_EXTENT_LONLAT = [123.6, 24.2, 145.9, 45.6];

/**
 * 지도 위에 떠 있는 상단 헤더와 하단 시트(축척 배지·비교 카드)를 피해 나라를 맞추기 위한
 * view.fit padding [위, 오른쪽, 아래, 왼쪽]. 비교 카드 높이는 화면 폭과 비교 상태에 따라
 * 달라지므로(휴대폰에서는 화면 절반 가까이) 맞출 때마다 잰다.
 */
function measureFitPadding() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return null;
  const mapRect = mapEl.getBoundingClientRect();
  if (mapRect.width === 0 || mapRect.height === 0) return null;

  const GAP = 12;
  const SIDE = 16;

  const header = document.querySelector('.app-header');
  const headerBottom = header ? header.getBoundingClientRect().bottom : mapRect.top;

  // 시트의 자식(축척 배지 줄·비교 카드)은 각자 떠 있으므로 가장 위에 있는 자식의 top을 쓴다.
  let sheetTop = mapRect.bottom;
  const sheet = document.getElementById('sheet-container');
  if (sheet) {
    for (const el of sheet.children) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) sheetTop = Math.min(sheetTop, r.top);
    }
  }

  let top = Math.max(0, headerBottom - mapRect.top) + GAP;
  let bottom = Math.max(0, mapRect.bottom - sheetTop) + GAP;

  // 가로 모드처럼 화면이 낮아 남는 높이가 너무 작으면 아래 여백부터 줄여 최소 높이를 남긴다.
  // (카드에 조금 가리더라도 맞출 자리가 아예 없는 것보다 낫다)
  const minVisible = mapRect.height * 0.3;
  const overflow = top + bottom - (mapRect.height - minVisible);
  if (overflow > 0) {
    bottom = Math.max(0, bottom - overflow);
    top = Math.max(0, Math.min(top, mapRect.height - minVisible - bottom));
  }
  return [top, SIDE, bottom, SIDE];
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. 하단 비교 시트 초기화
  const sheet = new ComparisonSheet('sheet-container', {
    onResetClick: () => {
      mapManager.resetKoreaPosition();
    },
    onPresetSelect: (isoA3) => {
      mapManager.selectCountryByIso(isoA3);
    }
  });

  // 2. OpenLayers 지도 매니저 초기화
  const mapManager = new MapManager('map', {
    onCountrySelect: (event) => {
      if (event.type === 'base') {
        sheet.setCountryA(event.country);
      } else if (event.type === 'target') {
        sheet.setCountryB(event.country);
      }
    },
    onScaleChange: (scaleInfo) => {
      sheet.setScaleInfo(scaleInfo);
    },
    getFitPadding: measureFitPadding,
    initialExtentLonLat: INITIAL_EXTENT_LONLAT,
    // R-7: 800ms 고정 타이머 대신, 피처 로드가 실제로 끝난 시점에 맞춰 초기
    // 비교국을 선택한다. 저사양 기기에서 GeoJSON 파싱이 800ms를
    // 넘기면 조용히 아무 일도 안 일어나던 경합 문제를 없앤다.
    // 첫 화면은 한국과 가까운 일본을 골라 두 나라가 함께 보이는 범위로 시작한다
    // (예전에는 영국을 골라 지도가 유럽으로 넘어가 한국을 다시 찾아와야 했다).
    onFeaturesReady: () => {
      mapManager.selectCountryByIso(DEFAULT_TARGET_ISO, { withKorea: true });
    }
  });

  // 3. 상단 국가 검색창 연동
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      if (!query.trim()) {
        searchResults.style.display = 'none';
        return;
      }

      const matches = mapManager.searchCountry(query);

      // 사소 항목: innerHTML 템플릿 조립은 데이터 안에 </div> 등이 섞여 들어오면
      // 그대로 마크업으로 해석된다(XSS 예방 차원). textContent 기반 DOM 생성으로 교체.
      searchResults.replaceChildren();

      if (matches.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'search-item';
        empty.style.color = '#94a3b8';
        empty.style.cursor = 'default';
        empty.textContent = '검색 결과가 없습니다.';
        searchResults.appendChild(empty);
        searchResults.style.display = 'block';
        return;
      }

      matches.slice(0, 8).forEach((m) => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.dataset.iso = m.iso_a3;

        const left = document.createElement('div');

        const flag = document.createElement('span');
        flag.className = 'search-item-flag';
        flag.textContent = m.flag || '🌐';

        const name = document.createElement('strong');
        name.textContent = m.name_ko || m.name_en;

        const nameEn = document.createElement('span');
        nameEn.style.color = '#64748b';
        nameEn.style.fontSize = '12px';
        nameEn.style.marginLeft = '4px';
        nameEn.textContent = `(${m.name_en})`;

        left.append(flag, name, nameEn);

        const area = document.createElement('span');
        area.className = 'search-item-area';
        area.textContent = `${(m.area_km2 || 0).toLocaleString()} km²`;

        item.append(left, area);
        item.addEventListener('click', () => {
          mapManager.selectCountryByIso(m.iso_a3);
          searchResults.style.display = 'none';
          searchInput.value = '';
        });

        searchResults.appendChild(item);
      });

      searchResults.style.display = 'block';
    });

    // 외부 클릭 시 검색창 닫기
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        searchResults.style.display = 'none';
      }
    });
  }

});
