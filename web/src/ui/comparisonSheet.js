/**
 * 국가 면적 및 요약 정보 상세 비교 UI 컨트롤러
 */

export class ComparisonSheet {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.countryA = null; // 기준 국가 (기본: 한국)
    this.countryB = null; // 비교 대상 국가
    this.currentScaleInfo = { scaleFactor: 1.0, areaMultiplier: 1.0, newLatitude: 36.5, isLatitudeClamped: false };
    this.onResetClick = options.onResetClick || (() => {});
    this.onPresetSelect = options.onPresetSelect || (() => {});
    this.onTargetSelect = options.onTargetSelect || (() => {});

    this.render();
  }

  setCountryA(countryData) {
    this.countryA = countryData;
    this.update();
  }

  setCountryB(countryData) {
    this.countryB = countryData;
    this.update();
  }

  setScaleInfo(scaleInfo) {
    this.currentScaleInfo = scaleInfo;
    this.updateScaleBadge();
  }

  render() {
    this.container.innerHTML = `
      <!-- 플로팅 상태 뱃지 (위도 & 배율) -->
      <div class="scale-badge-container">
        <div class="scale-badge" id="scale-badge">
          <span class="badge-icon">📍</span>
          <span class="badge-lat" id="badge-lat">위도: 36.5°N</span>
          <span class="badge-divider">|</span>
          <span class="badge-scale" id="badge-scale">시각적 축척: 1.00배</span>
        </div>
        <button class="reset-btn" id="reset-position-btn" title="한국을 원래 위치로 되돌립니다">
          <span>↺</span> 원위치
        </button>
      </div>

      <!-- 하단 메인 비교 패널 -->
      <div class="comparison-card" id="comparison-card">
        <div class="card-header">
          <div class="card-title">
            <span class="title-icon">📊</span>
            <span>국가 크기 상세 비교</span>
          </div>
          <div class="quick-presets">
            <span class="preset-label">추천 비교:</span>
            <button class="preset-btn" data-iso="GBR">🇬🇧 영국</button>
            <button class="preset-btn" data-iso="GRL">🇬🇱 그린란드</button>
            <button class="preset-btn" data-iso="JPN">🇯🇵 일본</button>
            <button class="preset-btn" data-iso="DEU">🇩🇪 독일</button>
          </div>
        </div>

        <div class="comparison-body" id="comparison-body">
          <div class="empty-state" id="empty-state">
            지도에서 다른 나라를 터치하거나 위 버튼을 눌러 비교해 보세요!
          </div>

          <div class="comparison-details" id="comparison-details" style="display: none;">
            <!-- 2개국 카드 그리드 -->
            <div class="countries-grid">
              <!-- 기준 국가 A (한국) -->
              <div class="country-box country-a">
                <div class="box-tag">기준 국가 (드래그 가능)</div>
                <div class="country-header">
                  <span class="country-flag" id="flag-a">🇰🇷</span>
                  <span class="country-name" id="name-a">대한민국</span>
                </div>
                <div class="country-area">
                  <span class="area-value" id="area-a">100,432</span>
                  <span class="area-unit">km²</span>
                </div>
                <div class="country-sub" id="sub-a">수도: 서울 | 아시아</div>
              </div>

              <div class="vs-badge">VS</div>

              <!-- 비교 대상 국가 B -->
              <div class="country-box country-b">
                <div class="box-tag">비교 대상</div>
                <div class="country-header">
                  <span class="country-flag" id="flag-b">🇬🇧</span>
                  <span class="country-name" id="name-b">영국</span>
                </div>
                <div class="country-area">
                  <span class="area-value" id="area-b">243,610</span>
                  <span class="area-unit">km²</span>
                </div>
                <div class="country-sub" id="sub-b">수도: 런던 | 유럽</div>
              </div>
            </div>

            <!-- 면적 비교 막대 그래프 -->
            <div class="ratio-section">
              <div class="ratio-header">
                <span class="ratio-title">실제 영토 면적 비율</span>
                <span class="ratio-summary" id="ratio-summary">영국은 한국의 약 2.4배</span>
              </div>
              <div class="ratio-bar-container">
                <div class="bar-fill bar-a" id="bar-a" style="width: 41%;">
                  <span class="bar-label" id="bar-label-a">한국 41.2%</span>
                </div>
                <div class="bar-fill bar-b" id="bar-b" style="width: 59%;">
                  <span class="bar-label" id="bar-label-b">영국 100%</span>
                </div>
              </div>
            </div>

            <!-- 메르카토르 상식 한 줄 노트 -->
            <div class="insight-box" id="insight-box">
              <span class="insight-icon">💡</span>
              <span class="insight-text" id="insight-text">
                메르카토르 지도에서는 고위도 국가가 매우 크게 왜곡되어 보이지만, 실제 영국은 한반도(남북 전체 약 22만km²)와 거의 비슷한 면적입니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 이벤트 리스너 바인딩
    const resetBtn = this.container.querySelector('#reset-position-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.onResetClick());
    }

    const presetBtns = this.container.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const iso = btn.getAttribute('data-iso');
        this.onPresetSelect(iso);
      });
    });
  }

  updateScaleBadge() {
    const latElem = this.container.querySelector('#badge-lat');
    const scaleElem = this.container.querySelector('#badge-scale');
    if (!latElem || !scaleElem) return;

    const lat = this.currentScaleInfo.newLatitude;
    const dir = lat >= 0 ? 'N' : 'S';
    // R-6: newLatitude는 이제 스케일 계산에 실제로 쓰인 클램프 후 위도이므로
    // 표시 위도와 축척이 서로 모순되지 않는다. 클램프가 걸린 경우에는 그 사실을
    // 함께 표기해 "왜 위도가 82도에서 멈췄는지" 사용자가 알 수 있게 한다.
    const clampNote = this.currentScaleInfo.isLatitudeClamped ? ' (극지방 왜곡 방지로 82°에 고정)' : '';
    latElem.textContent = `현재 위도: ${Math.abs(lat).toFixed(1)}°${dir}${clampNote}`;
    scaleElem.textContent = `지도 축척: ${this.currentScaleInfo.scaleFactor.toFixed(2)}배 (면적 ${this.currentScaleInfo.areaMultiplier.toFixed(1)}배)`;
  }

  update() {
    this.updateScaleBadge();

    const emptyState = this.container.querySelector('#empty-state');
    const details = this.container.querySelector('#comparison-details');
    if (!emptyState || !details) return;

    if (!this.countryA || !this.countryB) {
      emptyState.style.display = 'block';
      details.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    details.style.display = 'block';

    // 국가 A (한국)
    const nameA = this.countryA.name_ko || this.countryA.name_en;
    const flagA = this.countryA.flag || '🇰🇷';
    const areaA = Number(this.countryA.area_km2 || 100432);
    const subA = `수도: ${this.countryA.capital || '-'} | ${this.countryA.continent || '-'}`;

    this.container.querySelector('#flag-a').textContent = flagA;
    this.container.querySelector('#name-a').textContent = nameA;
    this.container.querySelector('#area-a').textContent = areaA.toLocaleString();
    this.container.querySelector('#sub-a').textContent = subA;

    // 국가 B
    const nameB = this.countryB.name_ko || this.countryB.name_en;
    const flagB = this.countryB.flag || '🌐';
    const areaB = Number(this.countryB.area_km2 || 1);
    const subB = `수도: ${this.countryB.capital || '-'} | ${this.countryB.continent || '-'}`;

    this.container.querySelector('#flag-b').textContent = flagB;
    this.container.querySelector('#name-b').textContent = nameB;
    this.container.querySelector('#area-b').textContent = areaB.toLocaleString();
    this.container.querySelector('#sub-b').textContent = subB;

    // 비율 계산
    const ratio = areaB / areaA;
    const ratioSummary = this.container.querySelector('#ratio-summary');
    if (ratio >= 1) {
      ratioSummary.textContent = `${nameB}은(는) ${nameA}의 약 ${ratio.toFixed(1)}배`;
    } else {
      const inverseRatio = (areaA / areaB).toFixed(1);
      ratioSummary.textContent = `${nameA}은(는) ${nameB}의 약 ${inverseRatio}배`;
    }

    // 비교 바 너비
    const maxArea = Math.max(areaA, areaB);
    const pctA = Math.max(8, Math.round((areaA / maxArea) * 100));
    const pctB = Math.max(8, Math.round((areaB / maxArea) * 100));

    const barA = this.container.querySelector('#bar-a');
    const barB = this.container.querySelector('#bar-b');
    const labelA = this.container.querySelector('#bar-label-a');
    const labelLabelB = this.container.querySelector('#bar-label-b');

    barA.style.width = `${pctA}%`;
    barB.style.width = `${pctB}%`;
    labelA.textContent = `${nameA}: ${areaA.toLocaleString()} km²`;
    labelLabelB.textContent = `${nameB}: ${areaB.toLocaleString()} km²`;

    // 인사이트 팁 메시지
    const insightText = this.container.querySelector('#insight-text');
    if (this.countryB.iso_a3 === 'GRL') {
      insightText.textContent = `그린란드는 지도 상에서 아프리카 대륙만해 보이지만, 실제 면적(약 216만 km²)은 대한민국 남한의 약 21.6배이며 아프리카의 1/14에 불과합니다!`;
    } else if (this.countryB.iso_a3 === 'GBR') {
      insightText.textContent = `영국은 메르카토르 지도에서 웅장해 보이지만, 실제로는 남북한을 합친 한반도 면적(약 22만 km²)과 매우 비슷한 크기입니다.`;
    } else if (this.countryB.iso_a3 === 'JPN') {
      insightText.textContent = `일본은 남북으로 길게 뻗어 있으며, 대한민국 남한 면적의 약 3.8배, 한반도 전체 대비로는 약 1.7배입니다.`;
    } else {
      insightText.textContent = `메르카토르 지도는 고위도로 갈수록 국가 크기가 급격히 커져 보입니다. 한국 폴리곤을 잡고 ${nameB} 위치로 드래그하여 실제 그 위도에 있을 때의 크기와 직접 맞춰보세요!`;
    }
  }
}
