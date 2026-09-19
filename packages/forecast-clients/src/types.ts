import type { ForecastPoint, ForecastSource } from '@kite-signal/domain';

export interface ForecastProvider {
  readonly source: ForecastSource;
  fetchForecast(lat: number, lon: number, days: number): Promise<ForecastPoint[]>;
}
