import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import {
  createDynamoDocumentClient,
  NotificationDedupRepository,
  SpotRepository,
  SubscriptionRepository,
  UserRepository,
} from '@kite-signal/db';
import type { Subscription } from '@kite-signal/db';
import { groupConsecutiveDates } from '@kite-signal/domain';
import { parseGoodForecastDetected } from '@kite-signal/events';
import type { DayWindow, GoodForecastDetectedDetail } from '@kite-signal/events';
import { createLogger, createMetrics, createTracer } from '@kite-signal/observability';
import { buildMessage } from './buildMessage.js';

const SERVICE_NAME = 'preference-matcher';
const DEFAULT_MIN_CONSECUTIVE_DAYS = 3;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const spotsTableName = requiredEnv('SPOTS_TABLE_NAME');
const subscriptionsTableName = requiredEnv('SUBSCRIPTIONS_TABLE_NAME');
const usersTableName = requiredEnv('USERS_TABLE_NAME');
const notificationDedupTableName = requiredEnv('NOTIFICATION_DEDUP_TABLE_NAME');
const notificationQueueUrl = requiredEnv('NOTIFICATION_QUEUE_URL');

const logger = createLogger(SERVICE_NAME);
const metrics = createMetrics(SERVICE_NAME);
const tracer = createTracer(SERVICE_NAME);

const doc = createDynamoDocumentClient();
const spotRepository = new SpotRepository(doc, spotsTableName);
const subscriptionRepository = new SubscriptionRepository(doc, subscriptionsTableName);
const userRepository = new UserRepository(doc, usersTableName);
const notificationDedupRepository = new NotificationDedupRepository(doc, notificationDedupTableName);
const sqs = tracer.captureAWSv3Client(new SQSClient({}));

interface SqsEvent {
  Records: Array<{ body: string }>;
}

/** EventBridge wraps the published detail in this envelope when a rule targets SQS directly. */
interface EventBridgeEnvelope {
  detail: unknown;
}

/**
 * A subscriber's own thresholds can be stricter than the global ones forecast-scorer applied,
 * which can carve a shorter run of qualifying days out of the streak the event describes. Picks
 * the longest such run that still meets the subscriber's minConsecutiveDays, or null if none do.
 */
function qualifyingRun(detail: GoodForecastDetectedDetail, sub: Subscription): DayWindow[] | null {
  const qualifyingDays = detail.days.filter(
    (day) => day.avgScore >= sub.minScoreThreshold && day.durationHours >= sub.minDurationHours,
  );
  const minConsecutiveDays = sub.minConsecutiveDays ?? DEFAULT_MIN_CONSECUTIVE_DAYS;
  const longEnoughRuns = groupConsecutiveDates(qualifyingDays).filter((run) => run.length >= minConsecutiveDays);
  if (longEnoughRuns.length === 0) return null;
  return longEnoughRuns.reduce((longest, run) => (run.length > longest.length ? run : longest));
}

export const handler = async (event: SqsEvent): Promise<void> => {
  let dedupSkips = 0;
  let notifyJobsEnqueued = 0;

  try {
    for (const record of event.Records) {
      const envelope = JSON.parse(record.body) as EventBridgeEnvelope;
      const detail = parseGoodForecastDetected(envelope.detail);

      const subscriptions = await subscriptionRepository.listSubscribersForSpot(detail.spotId);
      if (subscriptions.length === 0) continue;

      const spot = await spotRepository.getById(detail.spotId);
      if (!spot) {
        logger.warn('spot not found for GoodForecastDetected event, skipping', { spotId: detail.spotId });
        continue;
      }

      for (const sub of subscriptions) {
        const run = qualifyingRun(detail, sub);
        if (!run) continue;

        const runAvgScore = Math.round(run.reduce((sum, day) => sum + day.avgScore, 0) / run.length);
        const isNew = await notificationDedupRepository.markNotifiedIfNew(
          sub.userId,
          detail.spotId,
          run[0]!.date,
          runAvgScore,
        );
        if (!isNew) {
          dedupSkips += 1;
          continue;
        }

        const channels = await userRepository.listChannels(sub.userId);
        const message = buildMessage(spot, run);

        for (const channel of channels) {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: notificationQueueUrl,
              MessageBody: JSON.stringify({
                channelType: channel.channelType,
                target: channel.target,
                message,
              }),
            }),
          );
          notifyJobsEnqueued += 1;
        }
      }
    }

    logger.info('processed GoodForecastDetected batch', { dedupSkips, notifyJobsEnqueued });
    metrics.addMetric('DedupSkips', MetricUnit.Count, dedupSkips);
    metrics.addMetric('NotifyJobsEnqueued', MetricUnit.Count, notifyJobsEnqueued);
  } finally {
    metrics.publishStoredMetrics();
  }
};
