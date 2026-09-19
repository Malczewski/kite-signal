import type { WindDirectionRange } from './types.js';

export function normalizeDegrees(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function isDirectionInRange(deg: number, range: WindDirectionRange): boolean {
  const d = normalizeDegrees(deg);
  const start = normalizeDegrees(range[0]);
  const end = normalizeDegrees(range[1]);
  if (start <= end) {
    return d >= start && d <= end;
  }
  // range wraps across 0/360, e.g. [300, 30]
  return d >= start || d <= end;
}

function shortestAngleBetween(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Degrees from `deg` to the nearest edge of `range`. 0 if `deg` is inside the range. */
export function angularDistanceOutsideRange(deg: number, range: WindDirectionRange): number {
  if (isDirectionInRange(deg, range)) return 0;
  const d = normalizeDegrees(deg);
  const start = normalizeDegrees(range[0]);
  const end = normalizeDegrees(range[1]);
  return Math.min(shortestAngleBetween(d, start), shortestAngleBetween(d, end));
}
