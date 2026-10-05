import { describe, it, expect } from 'vitest';
import Polygon from 'ol/geom/Polygon';
import {
  degToRad,
  getGeometryCenter,
  getLatitudeFrom3857,
  calculateScaleFactor,
  scaleGeometryForLatitude
} from '../src/transform/mercatorScale';

describe('mercatorScale unit tests', () => {
  describe('degToRad', () => {
    it('should convert degrees to radians correctly', () => {
      expect(degToRad(0)).toBe(0);
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
      expect(degToRad(180)).toBeCloseTo(Math.PI);
      expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2);
      expect(degToRad(360)).toBeCloseTo(2 * Math.PI);
    });
  });

  describe('getLatitudeFrom3857', () => {
    it('should extract latitude from EPSG:3857 coordinates', () => {
      expect(getLatitudeFrom3857([0, 0])).toBeCloseTo(0);
      // North latitude
      const northLat = getLatitudeFrom3857([0, 4370000]);
      expect(northLat).toBeGreaterThan(0);
      expect(northLat).toBeLessThan(90);

      // South latitude
      const southLat = getLatitudeFrom3857([0, -4370000]);
      expect(southLat).toBeLessThan(0);
      expect(southLat).toBeGreaterThan(-90);
    });
  });

  describe('calculateScaleFactor', () => {
    it('should return scaleFactor 1.0 when base and target latitudes match', () => {
      const res = calculateScaleFactor(36.5, 36.5);
      expect(res.scaleFactor).toBe(1.0);
      expect(res.areaMultiplier).toBe(1.0);
      expect(res.newLatitude).toBe(36.5);
      expect(res.isLatitudeClamped).toBe(false);
    });

    it('should scale down when moving towards equator', () => {
      const res = calculateScaleFactor(36.5, 0);
      const expectedLinear = Math.cos((36.5 * Math.PI) / 180) / Math.cos(0);
      expect(res.scaleFactor).toBeCloseTo(expectedLinear, 3);
      expect(res.scaleFactor).toBeLessThan(1.0);
      expect(res.areaMultiplier).toBeLessThan(1.0);
      expect(res.isLatitudeClamped).toBe(false);
    });

    it('should scale up when moving towards high latitude', () => {
      const res = calculateScaleFactor(36.5, 60);
      const expectedLinear = Math.cos((36.5 * Math.PI) / 180) / Math.cos((60 * Math.PI) / 180);
      expect(res.scaleFactor).toBeCloseTo(expectedLinear, 3);
      expect(res.scaleFactor).toBeGreaterThan(1.0);
      expect(res.areaMultiplier).toBeCloseTo(expectedLinear * expectedLinear, 3);
      expect(res.isLatitudeClamped).toBe(false);
    });

    it('should clamp latitude to 82 degrees for extreme northern latitudes', () => {
      const res = calculateScaleFactor(36.5, 87.5);
      expect(res.newLatitude).toBe(82);
      expect(res.isLatitudeClamped).toBe(true);
      const expectedLinear = Math.cos((36.5 * Math.PI) / 180) / Math.cos((82 * Math.PI) / 180);
      expect(res.scaleFactor).toBeCloseTo(expectedLinear, 3);
    });

    it('should clamp latitude to -82 degrees for extreme southern latitudes', () => {
      const res = calculateScaleFactor(36.5, -89.9);
      expect(res.newLatitude).toBe(-82);
      expect(res.isLatitudeClamped).toBe(true);
      const expectedLinear = Math.cos((36.5 * Math.PI) / 180) / Math.cos((-82 * Math.PI) / 180);
      expect(res.scaleFactor).toBeCloseTo(expectedLinear, 3);
    });
  });

  describe('getGeometryCenter', () => {
    it('should calculate the bounding box center of a polygon', () => {
      const poly = new Polygon([
        [
          [100, 200],
          [300, 200],
          [300, 400],
          [100, 400],
          [100, 200]
        ]
      ]);
      const center = getGeometryCenter(poly);
      expect(center).toEqual([200, 300]);
    });
  });

  describe('scaleGeometryForLatitude', () => {
    it('should clone the geometry without mutating the original', () => {
      const originalCoords = [
        [
          [1000000, 1000000],
          [2000000, 1000000],
          [2000000, 2000000],
          [1000000, 2000000],
          [1000000, 1000000]
        ]
      ];
      const baseGeom = new Polygon(originalCoords);
      const baseCenter = [1500000, 1500000];
      const newCenter = [3000000, 3000000];

      const result = scaleGeometryForLatitude(baseGeom, baseCenter, 36.5, newCenter);

      // Original geometry must remain unchanged
      expect(baseGeom.getCoordinates()).toEqual(originalCoords);
      expect(result.geometry).not.toBe(baseGeom);
      expect(result.geometry.getCoordinates()).not.toEqual(originalCoords);
      expect(typeof result.scaleFactor).toBe('number');
      expect(typeof result.areaMultiplier).toBe('number');
      expect(typeof result.newLatitude).toBe('number');
    });
  });
});
