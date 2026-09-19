import type { ForecastPoint } from '@kite-signal/domain';
import type { ForecastProvider } from './types.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
  };
}

/** Open-Meteo returns local times with no UTC offset when timezone=UTC is requested. */
export function toIsoUtc(timestamp: string): string {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(timestamp)) return timestamp;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp)) return `${timestamp}:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(timestamp)) return `${timestamp}Z`;
  return timestamp;
}

export class OpenMeteoProvider implements ForecastProvider {
  readonly source = 'open-meteo' as const;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchForecast(lat: number, lon: number, days: number): Promise<ForecastPoint[]> {
    const url = new URL(BASE_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('hourly', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m');
    url.searchParams.set('wind_speed_unit', 'kn');
    url.searchParams.set('forecast_days', String(days));
    url.searchParams.set('timezone', 'UTC');

    const response = await this.fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as OpenMeteoHourlyResponse;
    return body.hourly.time.map((time, i) => ({
      timestamp: toIsoUtc(time),
      windDirDeg: body.hourly.wind_direction_10m[i]!,
      windSpeedKts: body.hourly.wind_speed_10m[i]!,
      gustSpeedKts: body.hourly.wind_gusts_10m[i]!,
      source: this.source,
    }));
  }
}
