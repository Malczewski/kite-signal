import type { ForecastPoint } from './types.js';

/**
 * Groups forecast points by UTC calendar date (the "Saturday afternoon" grouping the product
 * needs, as opposed to scoring across an entire multi-day forecast as one window).
 * Assumes timestamps are already normalized to UTC ISO 8601 (`...Z`).
 */
export function groupByUtcDate(points: ForecastPoint[]): Map<string, ForecastPoint[]> {
  const groups = new Map<string, ForecastPoint[]>();
  for (const point of points) {
    const date = point.timestamp.slice(0, 10);
    const group = groups.get(date);
    if (group) {
      group.push(point);
    } else {
      groups.set(date, [point]);
    }
  }
  return groups;
}
