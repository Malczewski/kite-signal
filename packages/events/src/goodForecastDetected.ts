import { z } from 'zod';

/** EventBridge custom-bus detail-type for this event. */
export const GOOD_FORECAST_DETECTED_DETAIL_TYPE = 'GoodForecastDetected';
/** EventBridge PutEvents `Source` for events published by forecast-scorer. */
export const KITE_SIGNAL_EVENT_SOURCE = 'kite-signal.forecast-scorer';

export const dayWindowSchema = z.object({
  /** UTC calendar date the window falls on, YYYY-MM-DD. */
  date: z.string(),
  windowStart: z.string(),
  windowEnd: z.string(),
  durationHours: z.number(),
  avgScore: z.number(),
  rating: z.enum(['poor', 'marginal', 'good', 'excellent']),
  reasons: z.array(z.string()),
  windSpeedMinKts: z.number(),
  windSpeedMaxKts: z.number(),
  windDirDeg: z.number(),
  gustMaxKts: z.number(),
  condition: z.enum(['sunny', 'partly-cloudy', 'cloudy', 'rain']),
});

export type DayWindow = z.infer<typeof dayWindowSchema>;

/**
 * A run of one or more consecutive calendar days that each had a qualifying window at this
 * spot. `forecast-scorer` doesn't know per-subscriber "N consecutive days" settings, so it
 * publishes every such run (even length 1) and leaves the length check to `preference-matcher`.
 */
export const goodForecastDetectedSchema = z.object({
  spotId: z.string(),
  spotName: z.string(),
  country: z.string(),
  streakStartDate: z.string(),
  streakEndDate: z.string(),
  streakLengthDays: z.number(),
  days: z.array(dayWindowSchema).min(1),
});

export type GoodForecastDetectedDetail = z.infer<typeof goodForecastDetectedSchema>;

export function parseGoodForecastDetected(detail: unknown): GoodForecastDetectedDetail {
  return goodForecastDetectedSchema.parse(detail);
}
