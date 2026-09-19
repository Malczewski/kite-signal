import suncalc from 'suncalc';
import type { ForecastPoint } from './types.js';

/**
 * Drops points that fall outside daylight hours at the given coordinates, so a "good window"
 * never recommends kiting in the dark. Sunrise/sunset are purely astronomical (derived from
 * lat/lon/date), unrelated to the spot's civil timezone.
 */
export function filterDaylightPoints(lat: number, lon: number, points: ForecastPoint[]): ForecastPoint[] {
  return points.filter((point) => {
    const date = new Date(point.timestamp);
    const { sunrise, sunset } = suncalc.getTimes(date, lat, lon);
    return date >= sunrise && date <= sunset;
  });
}
