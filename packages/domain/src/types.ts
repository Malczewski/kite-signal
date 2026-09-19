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
  cloudCoverPct: number;
  precipitationProbabilityPct: number;
  source: ForecastSource;
}

export type Rating = 'poor' | 'marginal' | 'good' | 'excellent';

export type Condition = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rain';

export type Quality = 'ideal' | 'usable' | 'poor' | 'hazard';

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
  windSpeedMinKts: number;
  windSpeedMaxKts: number;
  /** Circular mean of the window's wind directions, 0-360. */
  windDirDeg: number;
  gustMaxKts: number;
  condition: Condition;
}
