import { Metrics } from '@aws-lambda-powertools/metrics';

const NAMESPACE = 'KiteSignal';

export function createMetrics(serviceName: string): Metrics {
  return new Metrics({ namespace: NAMESPACE, serviceName });
}
