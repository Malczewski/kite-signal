/** Strips DynamoDB key/index attributes from a persisted item before returning it as a domain record. */
export function stripKeys<T>(item: Record<string, unknown>, keysToStrip: string[]): T {
  const clone = { ...item };
  for (const key of keysToStrip) {
    delete clone[key];
  }
  return clone as T;
}
