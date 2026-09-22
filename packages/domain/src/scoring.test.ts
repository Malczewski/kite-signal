import { describe, expect, it } from 'vitest';
import { classifyCondition, classifyDirectionQuality, classifySpeedQuality, findBestWindow, scorePoint } from './scoring.js';
import type { ForecastPoint, SpotKnowledge } from './types.js';

const spot: SpotKnowledge = {
  spotId: 'test-spot',
  name: 'Test Spot',
  idealWindDirRange: [200, 250],
  usableWindDirRange: [180, 270],
  dangerousWindDirRanges: [[0, 90]],
  minWindKts: 12,
  idealWindKts: [18, 24],
  maxWindKts: 35,
  gustToleranceKts: 6,
  skillLevel: 'intermediate',
};

function point(overrides: Partial<ForecastPoint>): ForecastPoint {
  return {
    timestamp: '2024-06-01T12:00:00Z',
    windDirDeg: 225,
    windSpeedKts: 20,
    gustSpeedKts: 22,
    cloudCoverPct: 20,
    precipitationProbabilityPct: 5,
    source: 'open-meteo',
    ...overrides,
  };
}

describe('scorePoint', () => {
  it('scores ideal direction, speed and gust as 100', () => {
    const result = scorePoint(spot, point({}));
    expect(result.score).toBe(100);
    expect(result.hazardFlags).toEqual([]);
  });

  it('hard-caps the score to 0 for a dangerous wind direction, regardless of speed', () => {
    const result = scorePoint(spot, point({ windDirDeg: 45, windSpeedKts: 20, gustSpeedKts: 22 }));
    expect(result.score).toBe(0);
    expect(result.hazardFlags).toContain('dangerous-wind-direction');
  });

  it('gives partial credit for a usable-but-not-ideal direction', () => {
    const result = scorePoint(spot, point({ windDirDeg: 190 }));
    expect(result.score).toBe(92);
  });

  it('fades direction score toward 0 outside the usable range', () => {
    const result = scorePoint(spot, point({ windDirDeg: 280 }));
    expect(result.score).toBe(90);
  });

  it('weighs speed more heavily than direction: ideal speed with a merely usable direction beats ideal direction with mediocre speed', () => {
    const usableDirectionIdealSpeed = scorePoint(spot, point({ windDirDeg: 190, windSpeedKts: 20, gustSpeedKts: 22 }));
    const idealDirectionMediocreSpeed = scorePoint(spot, point({ windDirDeg: 225, windSpeedKts: 30, gustSpeedKts: 32 }));
    expect(usableDirectionIdealSpeed.score).toBeGreaterThan(idealDirectionMediocreSpeed.score);
  });

  it('hard-caps the score to 0 when speed is below the spot minimum, regardless of direction', () => {
    const result = scorePoint(spot, point({ windSpeedKts: 5, gustSpeedKts: 6 }));
    expect(result.score).toBe(0);
    expect(result.hazardFlags).toContain('below-minimum-wind');
  });

  it('degrades the composite when gusts far exceed tolerance', () => {
    const result = scorePoint(spot, point({ gustSpeedKts: 40 }));
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
  });

  it('applies an off-season penalty without a hard cutoff', () => {
    const seasonalSpot: SpotKnowledge = { ...spot, seasonalityMonths: [6, 7, 8] };
    const inSeason = scorePoint(seasonalSpot, point({ timestamp: '2024-07-15T12:00:00Z' }));
    const offSeason = scorePoint(seasonalSpot, point({ timestamp: '2024-01-15T12:00:00Z' }));
    expect(inSeason.score).toBe(100);
    expect(offSeason.score).toBe(90);
  });
});

describe('classifyDirectionQuality', () => {
  it('grades hazard, ideal, usable and poor directions', () => {
    expect(classifyDirectionQuality(spot, 45)).toBe('hazard');
    expect(classifyDirectionQuality(spot, 225)).toBe('ideal');
    expect(classifyDirectionQuality(spot, 190)).toBe('usable');
    expect(classifyDirectionQuality(spot, 280)).toBe('poor');
  });
});

describe('classifySpeedQuality', () => {
  it('grades poor, usable and ideal speeds', () => {
    expect(classifySpeedQuality(spot, 5)).toBe('poor');
    expect(classifySpeedQuality(spot, 40)).toBe('poor');
    expect(classifySpeedQuality(spot, 15)).toBe('usable');
    expect(classifySpeedQuality(spot, 20)).toBe('ideal');
  });
});

describe('classifyCondition', () => {
  it('classifies rain, sunny, partly-cloudy and cloudy', () => {
    expect(classifyCondition(80, 60)).toBe('rain');
    expect(classifyCondition(10, 0)).toBe('sunny');
    expect(classifyCondition(50, 0)).toBe('partly-cloudy');
    expect(classifyCondition(90, 0)).toBe('cloudy');
  });
});

describe('findBestWindow', () => {
  function hourlyPoints(scores: Array<'ideal' | 'poor'>): ForecastPoint[] {
    return scores.map((kind, i) =>
      point({
        timestamp: `2024-06-01T${String(i).padStart(2, '0')}:00:00Z`,
        windDirDeg: kind === 'ideal' ? 225 : 45,
      }),
    );
  }

  it('finds the contiguous window that meets the score and duration thresholds', () => {
    const points = hourlyPoints(['poor', 'poor', 'ideal', 'ideal', 'ideal', 'poor']);
    const result = findBestWindow(spot, points, { minScoreThreshold: 65, minDurationHours: 2 });
    expect(result).not.toBeNull();
    expect(result?.windowStart).toBe('2024-06-01T02:00:00Z');
    expect(result?.windowEnd).toBe('2024-06-01T04:00:00Z');
    expect(result?.durationHours).toBe(3);
    expect(result?.avgScore).toBe(100);
    expect(result?.rating).toBe('excellent');
  });

  it('returns null when no window meets the minimum duration', () => {
    const points = hourlyPoints(['poor', 'ideal', 'poor']);
    const result = findBestWindow(spot, points, { minScoreThreshold: 65, minDurationHours: 2 });
    expect(result).toBeNull();
  });

  it('returns null when nothing meets the score threshold', () => {
    const points = hourlyPoints(['poor', 'poor', 'poor']);
    const result = findBestWindow(spot, points, { minScoreThreshold: 65, minDurationHours: 1 });
    expect(result).toBeNull();
  });

  it('picks the higher-scoring window when multiple qualify', () => {
    const points = [
      point({ timestamp: '2024-06-01T00:00:00Z', windDirDeg: 190 }), // usable, score 80
      point({ timestamp: '2024-06-01T01:00:00Z', windDirDeg: 45 }), // dangerous, breaks contiguity
      point({ timestamp: '2024-06-01T02:00:00Z', windDirDeg: 225 }), // ideal, score 100
    ];
    const result = findBestWindow(spot, points, { minScoreThreshold: 65, minDurationHours: 1 });
    expect(result?.avgScore).toBe(100);
    expect(result?.windowStart).toBe('2024-06-01T02:00:00Z');
  });

  it('computes wind range, direction, gust and condition stats over the winning window', () => {
    const points = [
      point({ timestamp: '2024-06-01T00:00:00Z', windDirDeg: 220, windSpeedKts: 18, gustSpeedKts: 20, cloudCoverPct: 10, precipitationProbabilityPct: 0 }),
      point({ timestamp: '2024-06-01T01:00:00Z', windDirDeg: 230, windSpeedKts: 22, gustSpeedKts: 26, cloudCoverPct: 30, precipitationProbabilityPct: 0 }),
    ];
    const result = findBestWindow(spot, points, { minScoreThreshold: 65, minDurationHours: 1 });
    expect(result?.windSpeedMinKts).toBe(18);
    expect(result?.windSpeedMaxKts).toBe(22);
    expect(result?.windDirDeg).toBeCloseTo(225, 0);
    expect(result?.gustMaxKts).toBe(26);
    expect(result?.condition).toBe('sunny');
  });
});
