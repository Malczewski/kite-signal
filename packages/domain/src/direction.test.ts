import { describe, expect, it } from 'vitest';
import { angularDistanceOutsideRange, circularMeanDeg, isDirectionInRange, normalizeDegrees } from './direction.js';

describe('normalizeDegrees', () => {
  it('leaves in-range degrees unchanged', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(180)).toBe(180);
  });

  it('wraps values >= 360', () => {
    expect(normalizeDegrees(370)).toBe(10);
    expect(normalizeDegrees(360)).toBe(0);
  });

  it('wraps negative values', () => {
    expect(normalizeDegrees(-10)).toBe(350);
  });
});

describe('isDirectionInRange', () => {
  it('handles a simple non-wrapping range', () => {
    expect(isDirectionInRange(220, [200, 250])).toBe(true);
    expect(isDirectionInRange(200, [200, 250])).toBe(true);
    expect(isDirectionInRange(250, [200, 250])).toBe(true);
    expect(isDirectionInRange(190, [200, 250])).toBe(false);
    expect(isDirectionInRange(260, [200, 250])).toBe(false);
  });

  it('handles a range that wraps across 0/360', () => {
    const range: [number, number] = [300, 30];
    expect(isDirectionInRange(350, range)).toBe(true);
    expect(isDirectionInRange(0, range)).toBe(true);
    expect(isDirectionInRange(15, range)).toBe(true);
    expect(isDirectionInRange(300, range)).toBe(true);
    expect(isDirectionInRange(30, range)).toBe(true);
    expect(isDirectionInRange(45, range)).toBe(false);
    expect(isDirectionInRange(250, range)).toBe(false);
  });

  it('normalizes out-of-0-360 inputs before comparing', () => {
    expect(isDirectionInRange(720 + 220, [200, 250])).toBe(true);
    expect(isDirectionInRange(-140, [200, 250])).toBe(true); // -140 -> 220
  });
});

describe('angularDistanceOutsideRange', () => {
  it('is 0 when inside the range', () => {
    expect(angularDistanceOutsideRange(220, [200, 250])).toBe(0);
  });

  it('measures the shortest distance to the nearest edge (non-wrapping range)', () => {
    expect(angularDistanceOutsideRange(190, [200, 250])).toBe(10);
    expect(angularDistanceOutsideRange(260, [200, 250])).toBe(10);
  });

  it('measures the shortest distance across a wrapping range', () => {
    const range: [number, number] = [300, 30];
    expect(angularDistanceOutsideRange(45, range)).toBe(15);
    expect(angularDistanceOutsideRange(250, range)).toBe(50);
  });
});

describe('circularMeanDeg', () => {
  it('averages a simple non-wrapping set of bearings', () => {
    expect(circularMeanDeg([0, 10])).toBeCloseTo(5, 5);
  });

  it('averages across the 0/360 seam without landing on the opposite direction', () => {
    const result = circularMeanDeg([350, 10]);
    // Should land near 0/360, not near the arithmetic mean (180, the opposite direction).
    expect(Math.min(result, 360 - result)).toBeCloseTo(0, 5);
  });

  it('returns the single value unchanged', () => {
    expect(circularMeanDeg([225])).toBeCloseTo(225, 5);
  });
});
