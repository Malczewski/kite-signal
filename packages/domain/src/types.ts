/** Degree range [start, end], both 0-360. May wrap across 0/360 (e.g. [300, 30]). */
export type WindDirectionRange = [number, number];

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface SpotKnowledge {
  spotId: string;
  name: string;
  idealWindDirRange: WindDirectionRange;
  usableWindDirRange: WindDirectionRange;
  dangerousWindDirRanges: WindDirectionRange[];
  minWindKts: number;
  idealWindKts: [number, number];
  maxWindKts: number;
  gustToleranceKts: number;
  /** 1-12 (January-December). Omit if the spot works year-round. */
  seasonalityMonths?: number[];
  skillLevel: SkillLevel;
}

export type ForecastSource = 'open-meteo' | 'meteoblue';

export interface ForecastPoint {
  /** ISO 8601, UTC. */
  timestamp: string;
  windDirDeg: number;
  windSpeedKts: number;
  gustSpeedKts: number;
  source: ForecastSource;
}

export type Rating = 'poor' | 'marginal' | 'good' | 'excellent';

export interface PointScore {
  timestamp: string;
  /** 0-100 */
  score: number;
  hazardFlags: string[];
}

export interface WindowResult {
  windowStart: string;
  windowEnd: string;
  durationHours: number;
  /** 0-100 */
  avgScore: number;
  rating: Rating;
  reasons: string[];
}
