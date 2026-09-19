import { z } from 'zod';

/** EventBridge custom-bus detail-type for this event. */
export const GOOD_FORECAST_DETECTED_DETAIL_TYPE = 'GoodForecastDetected';
/** EventBridge PutEvents `Source` for events published by forecast-scorer. */
export const KITE_SIGNAL_EVENT_SOURCE = 'kite-signal.forecast-scorer';

export const goodForecastDetectedSchema = z.object({
  spotId: z.string(),
  spotName: z.string(),
  country: z.string(),
  /** UTC calendar date the window falls on, YYYY-MM-DD. */
  date: z.string(),
  windowStart: z.string(),
  windowEnd: z.string(),
  durationHours: z.number(),
  avgScore: z.number(),
  rating: z.enum(['poor', 'marginal', 'good', 'excellent']),
  reasons: z.array(z.string()),
});

export type GoodForecastDetectedDetail = z.infer<typeof goodForecastDetectedSchema>;

export function parseGoodForecastDetected(detail: unknown): GoodForecastDetectedDetail {
  return goodForecastDetectedSchema.parse(detail);
}
