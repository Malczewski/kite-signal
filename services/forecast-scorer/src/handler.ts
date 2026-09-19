import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { findBestWindow, groupByUtcDate } from '@kite-signal/domain';
import type { ForecastPoint, SpotKnowledge } from '@kite-signal/domain';
import { GOOD_FORECAST_DETECTED_DETAIL_TYPE, KITE_SIGNAL_EVENT_SOURCE } from '@kite-signal/events';
import type { GoodForecastDetectedDetail } from '@kite-signal/events';
import { createLogger, createMetrics, createTracer } from '@kite-signal/observability';

const SERVICE_NAME = 'forecast-scorer';

interface SpotRecordLike extends SpotKnowledge {
  country: string;
  lat: number;
  lon: number;
  active: boolean;
}

interface ScoringMessage {
  spot: SpotRecordLike;
  points: ForecastPoint[];
}

interface SqsEvent {
  Records: Array<{ body: string }>;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const eventBusName = requiredEnv('EVENT_BUS_NAME');
const minScoreThreshold = Number(process.env.MIN_SCORE_THRESHOLD ?? '65');
const minDurationHours = Number(process.env.MIN_DURATION_HOURS ?? '3');

const logger = createLogger(SERVICE_NAME);
const metrics = createMetrics(SERVICE_NAME);
const tracer = createTracer(SERVICE_NAME);

const eventBridge = tracer.captureAWSv3Client(new EventBridgeClient({}));

function toEntry(
  spot: SpotRecordLike,
  date: string,
  window: NonNullable<ReturnType<typeof findBestWindow>>,
): PutEventsRequestEntry {
  const detail: GoodForecastDetectedDetail = {
    spotId: spot.spotId,
    spotName: spot.name,
    country: spot.country,
    date,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    durationHours: window.durationHours,
    avgScore: window.avgScore,
    rating: window.rating,
    reasons: window.reasons,
  };

  return {
    Source: KITE_SIGNAL_EVENT_SOURCE,
    DetailType: GOOD_FORECAST_DETECTED_DETAIL_TYPE,
    EventBusName: eventBusName,
    Detail: JSON.stringify(detail),
  };
}

export const handler = async (event: SqsEvent): Promise<void> => {
  try {
    const entries: PutEventsRequestEntry[] = [];
    let daysScored = 0;

    for (const record of event.Records) {
      const { spot, points } = JSON.parse(record.body) as ScoringMessage;
      const byDate = groupByUtcDate(points);

      for (const [date, dayPoints] of byDate) {
        daysScored += 1;
        const window = findBestWindow(spot, dayPoints, { minScoreThreshold, minDurationHours });
        if (window) entries.push(toEntry(spot, date, window));
      }
    }

    metrics.addMetric('SpotsScored', MetricUnit.Count, daysScored);
    metrics.addMetric('GoodForecastsDetected', MetricUnit.Count, entries.length);

    if (entries.length === 0) {
      logger.info('no qualifying windows in this batch', { daysScored });
      return;
    }

    logger.info('publishing GoodForecastDetected event(s)', { count: entries.length });
    // PutEvents accepts at most 10 entries per call.
    for (let i = 0; i < entries.length; i += 10) {
      await eventBridge.send(new PutEventsCommand({ Entries: entries.slice(i, i + 10) }));
    }
  } finally {
    metrics.publishStoredMetrics();
  }
};
