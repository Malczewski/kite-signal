import suncalc from 'suncalc';
import { describe, expect, it } from 'vitest';
import { filterDaylightPoints } from './daylight.js';
import type { ForecastPoint } from './types.js';

function point(timestamp: string): ForecastPoint {
  return {
    timestamp,
    windDirDeg: 225,
    windSpeedKts: 20,
    gustSpeedKts: 22,
    cloudCoverPct: 20,
    precipitationProbabilityPct: 5,
    source: 'open-meteo',
  };
}

describe('filterDaylightPoints', () => {
  const lat = 44.2397;
  const lon = 15.1808;
  const { sunrise, sunset } = suncalc.getTimes(new Date('2024-06-01T12:00:00Z'), lat, lon);

  it('keeps a point at solar noon', () => {
    const points = [point('2024-06-01T12:00:00Z')];
    expect(filterDaylightPoints(lat, lon, points)).toHaveLength(1);
  });

  it('drops points before sunrise and after sunset', () => {
    const beforeSunrise = new Date(sunrise.getTime() - 60 * 60 * 1000).toISOString();
    const afterSunset = new Date(sunset.getTime() + 60 * 60 * 1000).toISOString();
    const points = [point(beforeSunrise), point(afterSunset)];
    expect(filterDaylightPoints(lat, lon, points)).toHaveLength(0);
  });

  it('keeps points right at the sunrise/sunset boundary', () => {
    const points = [point(sunrise.toISOString()), point(sunset.toISOString())];
    expect(filterDaylightPoints(lat, lon, points)).toHaveLength(2);
  });
});
