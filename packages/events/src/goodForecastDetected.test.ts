import { describe, expect, it } from 'vitest';
import { parseGoodForecastDetected } from './goodForecastDetected.js';

const valid = {
  spotId: 'nin-croatia',
  spotName: 'Nin',
  country: 'HR',
  date: '2024-06-01',
  windowStart: '2024-06-01T12:00:00Z',
  windowEnd: '2024-06-01T17:00:00Z',
  durationHours: 5,
  avgScore: 88,
  rating: 'excellent',
  reasons: ['excellent conditions expected (avg score 88/100)'],
};

describe('parseGoodForecastDetected', () => {
  it('accepts a well-formed detail payload', () => {
    expect(parseGoodForecastDetected(valid)).toEqual(valid);
  });

  it('rejects a payload with a missing field', () => {
    const { avgScore: _avgScore, ...missingAvgScore } = valid;
    expect(() => parseGoodForecastDetected(missingAvgScore)).toThrow();
  });

  it('rejects an invalid rating value', () => {
    expect(() => parseGoodForecastDetected({ ...valid, rating: 'amazing' })).toThrow();
  });
});
