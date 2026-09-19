import { isDirectionInRange, angularDistanceOutsideRange, circularMeanDeg } from './direction.js';
import type { Condition, ForecastPoint, PointScore, Quality, Rating, SpotKnowledge, WindowResult } from './types.js';

const WEIGHTS = { direction: 0.5, speed: 0.3, gust: 0.2 };
const OFFSEASON_PENALTY = 0.1;
const DANGEROUS_WIND_DIRECTION_HAZARD = 'dangerous-wind-direction';

/** Fraction outside the usable range beyond which direction score bottoms out at 0. */
const USABLE_FADE_DEGREES = 60;

const RAIN_PRECIP_PROBABILITY_PCT = 50;
const SUNNY_CLOUD_COVER_PCT = 30;
const PARTLY_CLOUDY_CLOUD_COVER_PCT = 70;

/** Same tiers `directionScore` grades on, exposed for message-building (e.g. a 🟢/🟡/🔴 indicator). */
export function classifyDirectionQuality(spot: SpotKnowledge, windDirDeg: number): Quality {
  if (spot.dangerousWindDirRanges.some((range) => isDirectionInRange(windDirDeg, range))) return 'hazard';
  if (isDirectionInRange(windDirDeg, spot.idealWindDirRange)) return 'ideal';
  if (isDirectionInRange(windDirDeg, spot.usableWindDirRange)) return 'usable';
  return 'poor';
}

/** Same tiers `speedScore` grades on, exposed for message-building. */
export function classifySpeedQuality(spot: SpotKnowledge, windSpeedKts: number): Quality {
  const [idealMin, idealMax] = spot.idealWindKts;
  if (windSpeedKts < spot.minWindKts || windSpeedKts > spot.maxWindKts) return 'poor';
  if (windSpeedKts >= idealMin && windSpeedKts <= idealMax) return 'ideal';
  return 'usable';
}

export function classifyCondition(avgCloudCoverPct: number, avgPrecipProbabilityPct: number): Condition {
  if (avgPrecipProbabilityPct >= RAIN_PRECIP_PROBABILITY_PCT) return 'rain';
  if (avgCloudCoverPct < SUNNY_CLOUD_COVER_PCT) return 'sunny';
  if (avgCloudCoverPct < PARTLY_CLOUDY_CLOUD_COVER_PCT) return 'partly-cloudy';
  return 'cloudy';
}

function directionScore(spot: SpotKnowledge, windDirDeg: number): { score: number; hazard: boolean } {
  const quality = classifyDirectionQuality(spot, windDirDeg);
  if (quality === 'hazard') return { score: 0, hazard: true };
  if (quality === 'ideal') return { score: 1, hazard: false };
  if (quality === 'usable') return { score: 0.6, hazard: false };
  const distance = angularDistanceOutsideRange(windDirDeg, spot.usableWindDirRange);
  const score = Math.max(0, 0.6 * (1 - distance / USABLE_FADE_DEGREES));
  return { score, hazard: false };
}

function speedScore(spot: SpotKnowledge, windSpeedKts: number): number {
  const quality = classifySpeedQuality(spot, windSpeedKts);
  if (quality === 'poor') return 0;
  if (quality === 'ideal') return 1;
  const [idealMin, idealMax] = spot.idealWindKts;
  if (windSpeedKts < idealMin) {
    const range = idealMin - spot.minWindKts;
    return range > 0 ? (windSpeedKts - spot.minWindKts) / range : 1;
  }
  const range = spot.maxWindKts - idealMax;
  return range > 0 ? (spot.maxWindKts - windSpeedKts) / range : 1;
}

function gustScore(spot: SpotKnowledge, windSpeedKts: number, gustSpeedKts: number): number {
  const delta = Math.max(0, gustSpeedKts - windSpeedKts);
  if (delta <= spot.gustToleranceKts) return 1;
  if (spot.gustToleranceKts <= 0) return 0;
  const excess = delta - spot.gustToleranceKts;
  return Math.max(0, 1 - excess / spot.gustToleranceKts);
}

function monthOf(timestamp: string): number {
  return new Date(timestamp).getUTCMonth() + 1;
}

/** Pure per-point score. Hazardous wind direction hard-caps the score to 0 regardless of speed. */
export function scorePoint(spot: SpotKnowledge, point: ForecastPoint): PointScore {
  const dir = directionScore(spot, point.windDirDeg);
  const hazardFlags: string[] = [];
  if (dir.hazard) hazardFlags.push(DANGEROUS_WIND_DIRECTION_HAZARD);

  let composite = dir.hazard
    ? 0
    : dir.score * WEIGHTS.direction +
      speedScore(spot, point.windSpeedKts) * WEIGHTS.speed +
      gustScore(spot, point.windSpeedKts, point.gustSpeedKts) * WEIGHTS.gust;

  if (!dir.hazard && spot.seasonalityMonths?.length && !spot.seasonalityMonths.includes(monthOf(point.timestamp))) {
    composite = Math.max(0, composite - OFFSEASON_PENALTY);
  }

  return {
    timestamp: point.timestamp,
    score: Math.round(composite * 100),
    hazardFlags,
  };
}

/** 0-100 score -> qualitative rating; the same bands `findBestWindow` uses for a single window. */
export function rate(score: number): Rating {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 40) return 'marginal';
  return 'poor';
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function hoursBetween(aIso: string, bIso: string): number {
  return (new Date(bIso).getTime() - new Date(aIso).getTime()) / (1000 * 60 * 60);
}

/** Assumes points are evenly spaced; returns the gap between consecutive points in hours. */
function inferStepHours(points: ForecastPoint[]): number {
  if (points.length < 2) return 1;
  return hoursBetween(points[0]!.timestamp, points[1]!.timestamp) || 1;
}

export interface FindBestWindowOptions {
  /** 0-100 */
  minScoreThreshold: number;
  minDurationHours: number;
}

/**
 * Finds the highest-scoring contiguous run of forecast points that stays at or above
 * minScoreThreshold for at least minDurationHours. Returns null if no such window exists.
 */
export function findBestWindow(
  spot: SpotKnowledge,
  points: ForecastPoint[],
  options: FindBestWindowOptions,
): WindowResult | null {
  const sorted = [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const scores = sorted.map((point) => scorePoint(spot, point));
  const stepHours = inferStepHours(sorted);

  let best: WindowResult | null = null;
  let i = 0;
  while (i < scores.length) {
    if (scores[i]!.score < options.minScoreThreshold) {
      i++;
      continue;
    }
    let j = i;
    while (j < scores.length && scores[j]!.score >= options.minScoreThreshold) {
      j++;
    }

    const windowScores = scores.slice(i, j);
    const durationHours = hoursBetween(windowScores[0]!.timestamp, windowScores.at(-1)!.timestamp) + stepHours;

    if (durationHours >= options.minDurationHours) {
      const avgScore = Math.round(
        windowScores.reduce((sum, s) => sum + s.score, 0) / windowScores.length,
      );
      const rating = rate(avgScore);
      const windowPoints = sorted.slice(i, j);
      const windSpeeds = windowPoints.map((p) => p.windSpeedKts);
      const candidate: WindowResult = {
        windowStart: windowScores[0]!.timestamp,
        windowEnd: windowScores.at(-1)!.timestamp,
        durationHours,
        avgScore,
        rating,
        reasons: [`${rating} conditions expected (avg score ${avgScore}/100)`],
        windSpeedMinKts: Math.min(...windSpeeds),
        windSpeedMaxKts: Math.max(...windSpeeds),
        windDirDeg: circularMeanDeg(windowPoints.map((p) => p.windDirDeg)),
        gustMaxKts: Math.max(...windowPoints.map((p) => p.gustSpeedKts)),
        condition: classifyCondition(
          average(windowPoints.map((p) => p.cloudCoverPct)),
          average(windowPoints.map((p) => p.precipitationProbabilityPct)),
        ),
      };
      if (
        !best ||
        candidate.avgScore > best.avgScore ||
        (candidate.avgScore === best.avgScore && candidate.durationHours > best.durationHours)
      ) {
        best = candidate;
      }
    }
    i = j;
  }

  return best;
}
