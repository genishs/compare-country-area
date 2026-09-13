import { MapManager } from './map/mapManager';
import { ComparisonSheet } from './ui/comparisonSheet';

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
    // R-7: 800ms 고정 타이머 대신, 피처 로드가 실제로 끝난 시점에 맞춰 초기
    // 추천 비교국(영국)을 선택한다. 저사양 기기에서 GeoJSON 파싱이 800ms를
    // 넘기면 조용히 아무 일도 안 일어나던 경합 문제를 없앤다.
    onFeaturesReady: () => {
      mapManager.selectCountryByIso('GBR');
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
