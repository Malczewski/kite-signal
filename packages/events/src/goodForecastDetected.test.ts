import { describe, expect, it } from 'vitest';
import { parseGoodForecastDetected } from './goodForecastDetected.js';

const day = {
  date: '2024-06-01',
  windowStart: '2024-06-01T12:00:00Z',
  windowEnd: '2024-06-01T17:00:00Z',
  durationHours: 5,
  avgScore: 88,
  rating: 'excellent',
  reasons: ['excellent conditions expected (avg score 88/100)'],
  windSpeedMinKts: 18,
  windSpeedMaxKts: 24,
  windDirDeg: 225,
  gustMaxKts: 28,
  condition: 'sunny',
};

const valid = {
  spotId: 'nin-croatia',
  spotName: 'Nin',
  country: 'HR',
  streakStartDate: '2024-06-01',
  streakEndDate: '2024-06-01',
  streakLengthDays: 1,
  days: [day],
};

describe('parseGoodForecastDetected', () => {
  it('accepts a well-formed detail payload', () => {
    expect(parseGoodForecastDetected(valid)).toEqual(valid);
  });

  it('rejects a payload with a missing field', () => {
    const { streakLengthDays: _streakLengthDays, ...missingStreakLengthDays } = valid;
    expect(() => parseGoodForecastDetected(missingStreakLengthDays)).toThrow();
  });

  it('rejects an invalid rating value', () => {
    expect(() => parseGoodForecastDetected({ ...valid, days: [{ ...day, rating: 'amazing' }] })).toThrow();
  });

  it('rejects an invalid condition value', () => {
    expect(() => parseGoodForecastDetected({ ...valid, days: [{ ...day, condition: 'stormy' }] })).toThrow();
  });

  it('rejects an empty days array', () => {
    expect(() => parseGoodForecastDetected({ ...valid, days: [] })).toThrow();
  });
});
