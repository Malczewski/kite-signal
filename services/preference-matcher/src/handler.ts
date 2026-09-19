import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import {
  createDynamoDocumentClient,
  NotificationDedupRepository,
  SubscriptionRepository,
  UserRepository,
} from '@kite-signal/db';
import { parseGoodForecastDetected } from '@kite-signal/events';
import { createLogger, createMetrics, createTracer } from '@kite-signal/observability';
import { buildMessage } from './buildMessage.js';

const SERVICE_NAME = 'preference-matcher';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const subscriptionsTableName = requiredEnv('SUBSCRIPTIONS_TABLE_NAME');
const usersTableName = requiredEnv('USERS_TABLE_NAME');
const notificationDedupTableName = requiredEnv('NOTIFICATION_DEDUP_TABLE_NAME');
const notificationQueueUrl = requiredEnv('NOTIFICATION_QUEUE_URL');

const logger = createLogger(SERVICE_NAME);
const metrics = createMetrics(SERVICE_NAME);
const tracer = createTracer(SERVICE_NAME);

const doc = createDynamoDocumentClient();
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

export const handler = async (event: SqsEvent): Promise<void> => {
  let dedupSkips = 0;
  let notifyJobsEnqueued = 0;

  try {
    for (const record of event.Records) {
      const envelope = JSON.parse(record.body) as EventBridgeEnvelope;
      const detail = parseGoodForecastDetected(envelope.detail);

      const subscriptions = await subscriptionRepository.listSubscribersForSpot(detail.spotId);
      const qualifying = subscriptions.filter(
        (sub) => detail.avgScore >= sub.minScoreThreshold && detail.durationHours >= sub.minDurationHours,
      );

      for (const sub of qualifying) {
        const isNew = await notificationDedupRepository.markNotifiedIfNew(
          sub.userId,
          detail.spotId,
          detail.date,
          detail.avgScore,
        );
        if (!isNew) {
          dedupSkips += 1;
          continue;
        }

        const channels = await userRepository.listChannels(sub.userId);
        const message = buildMessage(detail);

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
