import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import MultiPolygon from 'ol/geom/MultiPolygon';
import { MapManager, COUNTRY_ALIASES } from '../src/map/mapManager';

describe('COUNTRY_ALIASES and searchCountry', () => {
  it('should include aliases for key countries', () => {
    expect(COUNTRY_ALIASES.KOR).toContain('한국');
    expect(COUNTRY_ALIASES.KOR).toContain('남한');
    expect(COUNTRY_ALIASES.USA).toContain('미국');
    expect(COUNTRY_ALIASES.GBR).toContain('영국');
    expect(COUNTRY_ALIASES.RUS).toContain('러시아');
    expect(COUNTRY_ALIASES.JPN).toContain('일본');
    expect(COUNTRY_ALIASES.DEU).toContain('독일');
  });

  it('should find 대한민국 when searching "한국" using aliases', () => {
    // Mock countriesSource
    const mockFeatures = [
      new Feature({
        iso_a3: 'KOR',
        name_ko: '대한민국',
        name_en: 'South Korea'
      }),
      new Feature({
        iso_a3: 'USA',
        name_ko: '미국',
        name_en: 'United States of America'
      }),
      new Feature({
        iso_a3: 'JPN',
        name_ko: '일본',
        name_en: 'Japan'
      })
    ];

    // Create a minimal MapManager instance or test searchCountry directly
    const fakeManager = Object.create(MapManager.prototype);
    fakeManager.countriesSource = {
      getFeatures: () => mockFeatures
    };

    const results = fakeManager.searchCountry('한국');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].iso_a3).toBe('KOR');
    expect(results[0].name_ko).toBe('대한민국');
  });

  it('should prioritize exact match over partial matches', () => {
    const mockFeatures = [
      new Feature({
        iso_a3: 'PRK',
        name_ko: '북한',
        name_en: 'North Korea'
      }),
      new Feature({
        iso_a3: 'KOR',
        name_ko: '대한민국',
        name_en: 'South Korea'
      })
    ];

    const fakeManager = Object.create(MapManager.prototype);
    fakeManager.countriesSource = {
      getFeatures: () => mockFeatures
    };

    // Searching '한국' exactly matches alias of KOR, whereas '북한' contains '한'
    const results = fakeManager.searchCountry('한국');
    expect(results.length).toBe(1);
    expect(results[0].iso_a3).toBe('KOR');
  });

  it('should return empty array for empty or non-matching query', () => {
    const mockFeatures = [
      new Feature({
        iso_a3: 'KOR',
        name_ko: '대한민국',
        name_en: 'South Korea'
      })
    ];

    const fakeManager = Object.create(MapManager.prototype);
    fakeManager.countriesSource = {
      getFeatures: () => mockFeatures
    };

    expect(fakeManager.searchCountry('')).toEqual([]);
    expect(fakeManager.searchCountry('   ')).toEqual([]);
    expect(fakeManager.searchCountry('알파카랜드')).toEqual([]);
  });
});

describe('getCountryFitExtent (Date line meridian fix)', () => {
  const fakeManager = Object.create(MapManager.prototype);

  it('should return raw extent for normal countries not crossing the date line', () => {
    // Normal country extent (e.g. South Korea in EPSG:3857, approx width 400,000m)
    const normalPoly = new Polygon([
      [
        [14000000, 4200000],
        [14400000, 4200000],
        [14400000, 4600000],
        [14000000, 4600000],
        [14000000, 4200000]
      ]
    ]);
    const feature = new Feature({ geometry: normalPoly });

    const fitExtent = fakeManager.getCountryFitExtent(feature);
    expect(fitExtent).toEqual(normalPoly.getExtent());
    expect(fitExtent[2] - fitExtent[0]).toBeLessThan(20037508);
  });

  it('should correct extent for countries crossing the date line (like Russia or USA)', () => {
    // Simulated MultiPolygon:
    // Poly A: Main land in Eastern hemisphere (X from 2,000,000 to 20,000,000, large area)
    // Poly B: Small island across date line in Western hemisphere (X from -20,000,000 to -19,000,000, small area)
    const polyEast = [
      [
        [2000000, 5000000],
        [20000000, 5000000],
        [20000000, 8000000],
        [2000000, 8000000],
        [2000000, 5000000]
      ]
    ];
    const polyWest = [
      [
        [-20000000, 5000000],
        [-19000000, 5000000],
        [-19000000, 5500000],
        [-20000000, 5500000],
        [-20000000, 5000000]
      ]
    ];

    const multiPoly = new MultiPolygon([polyEast, polyWest]);
    const feature = new Feature({ geometry: multiPoly });

    // Raw extent covers the entire world width (-20,000,000 to +20,000,000 = 40,000,000m)
    const rawExtent = multiPoly.getExtent();
    expect(rawExtent[2] - rawExtent[0]).toBeGreaterThan(20037508);

    // getCountryFitExtent should isolate the dominant eastern landmass
    const fitExtent = fakeManager.getCountryFitExtent(feature);
    expect(fitExtent[2] - fitExtent[0]).toBeLessThan(20037508);
    expect(fitExtent[0]).toBe(2000000);
    expect(fitExtent[2]).toBe(20000000);
  });
});
