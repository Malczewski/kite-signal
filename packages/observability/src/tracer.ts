import { Tracer } from '@aws-lambda-powertools/tracer';

export function createTracer(serviceName: string): Tracer {
  return new Tracer({ serviceName });
}
