import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { createDynamoDocumentClient, SpotRepository } from '@kite-signal/db';
import { OpenMeteoProvider } from '@kite-signal/forecast-clients';
import { createLogger, createMetrics, createTracer } from '@kite-signal/observability';

const SERVICE_NAME = 'forecast-fetcher';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const spotsTableName = requiredEnv('SPOTS_TABLE_NAME');
const queueUrl = requiredEnv('FORECAST_SCORING_QUEUE_URL');
const forecastDays = Number(process.env.FORECAST_DAYS ?? '5');

const logger = createLogger(SERVICE_NAME);
const metrics = createMetrics(SERVICE_NAME);
const tracer = createTracer(SERVICE_NAME);

const spotRepository = new SpotRepository(createDynamoDocumentClient(), spotsTableName);
const forecastProvider = new OpenMeteoProvider();
const sqs = tracer.captureAWSv3Client(new SQSClient({}));

export const handler = async (): Promise<{ spotsProcessed: number; failures: number }> => {
  try {
    const spots = await spotRepository.listActive();
    logger.info('fetching forecasts for active spots', { spotCount: spots.length });

    const results = await Promise.allSettled(
      spots.map(async (spot) => {
        const points = await forecastProvider.fetchForecast(spot.lat, spot.lon, forecastDays);
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ spot, points }),
          }),
        );
      }),
    );

    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    for (const failure of failures) {
      logger.error('failed to fetch/enqueue a spot', failure.reason as Error);
    }

    metrics.addMetric('OpenMeteoApiErrors', MetricUnit.Count, failures.length);
    metrics.addMetric('SpotsFetched', MetricUnit.Count, spots.length - failures.length);

    if (spots.length > 0 && failures.length === spots.length) {
      throw new Error(`forecast-fetcher: all ${spots.length} spot(s) failed`);
    }

    return { spotsProcessed: spots.length - failures.length, failures: failures.length };
  } finally {
    metrics.publishStoredMetrics();
  }
};
