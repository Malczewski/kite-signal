import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { TelegramChannel } from '@kite-signal/notification-channels';
import type { NotificationChannel, NotificationMessage } from '@kite-signal/notification-channels';
import { createLogger, createMetrics, createTracer } from '@kite-signal/observability';

const SERVICE_NAME = 'notifier';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const botTokenParamName = requiredEnv('TELEGRAM_BOT_TOKEN_PARAM');

const logger = createLogger(SERVICE_NAME);
const metrics = createMetrics(SERVICE_NAME);
const tracer = createTracer(SERVICE_NAME);

const ssm = tracer.captureAWSv3Client(new SSMClient({}));

let cachedBotToken: string | undefined;
let cachedTelegramChannel: TelegramChannel | undefined;

async function getBotToken(): Promise<string> {
  if (!cachedBotToken) {
    const result = await ssm.send(new GetParameterCommand({ Name: botTokenParamName, WithDecryption: true }));
    const value = result.Parameter?.Value;
    if (!value) throw new Error(`SSM parameter ${botTokenParamName} has no value`);
    cachedBotToken = value;
  }
  return cachedBotToken;
}

/** Small explicit switch, not a config-driven registry - a second channel is one more case. */
async function getChannel(channelType: string): Promise<NotificationChannel> {
  switch (channelType) {
    case 'telegram':
      cachedTelegramChannel ??= new TelegramChannel(await getBotToken());
      return cachedTelegramChannel;
    default:
      throw new Error(`Unsupported notification channel type: ${channelType}`);
  }
}

interface SqsEvent {
  Records: Array<{ body: string }>;
}

interface NotifyJob {
  channelType: string;
  target: string;
  message: NotificationMessage;
}

export const handler = async (event: SqsEvent): Promise<void> => {
  let sent = 0;
  let failed = 0;

  try {
    for (const record of event.Records) {
      const job = JSON.parse(record.body) as NotifyJob;
      try {
        const channel = await getChannel(job.channelType);
        await channel.send(job.target, job.message);
        sent += 1;
      } catch (error) {
        failed += 1;
        logger.error('failed to send notification', { error: error as Error, channelType: job.channelType });
        throw error;
      }
    }
  } finally {
    metrics.addMetric('NotificationsSent', MetricUnit.Count, sent);
    metrics.addMetric('NotificationSendFailures', MetricUnit.Count, failed);
    metrics.publishStoredMetrics();
  }
};
