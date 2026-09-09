import { describe, expect, it } from 'vitest';
import { groupByUtcDate } from './grouping.js';
import type { ForecastPoint } from './types.js';

function point(timestamp: string): ForecastPoint {
  return { timestamp, windDirDeg: 225, windSpeedKts: 20, gustSpeedKts: 22, source: 'open-meteo' };
}

describe('groupByUtcDate', () => {
  it('groups points by their UTC calendar date', () => {
    const points = [
      point('2024-06-01T22:00:00Z'),
      point('2024-06-02T00:00:00Z'),
      point('2024-06-02T12:00:00Z'),
    ];

    const groups = groupByUtcDate(points);

    expect([...groups.keys()]).toEqual(['2024-06-01', '2024-06-02']);
    expect(groups.get('2024-06-01')).toHaveLength(1);
    expect(groups.get('2024-06-02')).toHaveLength(2);
  });

  it('returns an empty map for no points', () => {
    expect(groupByUtcDate([]).size).toBe(0);
  });
});
