import { describe, expect, it, vi } from 'vitest';
import { OpenMeteoProvider, toIsoUtc } from './openMeteo.js';

describe('toIsoUtc', () => {
  it('appends seconds and Z to a bare local timestamp', () => {
    expect(toIsoUtc('2024-06-01T00:00')).toBe('2024-06-01T00:00:00Z');
  });

  it('appends only Z when seconds are already present', () => {
    expect(toIsoUtc('2024-06-01T00:00:00')).toBe('2024-06-01T00:00:00Z');
  });

  it('leaves an already-zoned timestamp unchanged', () => {
    expect(toIsoUtc('2024-06-01T00:00:00Z')).toBe('2024-06-01T00:00:00Z');
    expect(toIsoUtc('2024-06-01T00:00:00+02:00')).toBe('2024-06-01T00:00:00+02:00');
  });
});

describe('OpenMeteoProvider', () => {
  it('maps the Open-Meteo hourly response into ForecastPoints', async () => {
    const fakeBody = {
      hourly: {
        time: ['2024-06-01T00:00', '2024-06-01T01:00'],
        wind_speed_10m: [18, 22],
        wind_direction_10m: [225, 230],
        wind_gusts_10m: [21, 27],
        cloudcover: [10, 40],
        precipitation_probability: [0, 5],
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fakeBody,
    });

    const provider = new OpenMeteoProvider(fetchImpl as unknown as typeof fetch);
    const points = await provider.fetchForecast(44.24, 15.18, 3);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const calledUrl = new URL(fetchImpl.mock.calls[0]![0] as URL);
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(calledUrl.searchParams.get('latitude')).toBe('44.24');
    expect(calledUrl.searchParams.get('longitude')).toBe('15.18');
    expect(calledUrl.searchParams.get('wind_speed_unit')).toBe('kn');

    expect(points).toEqual([
      {
        timestamp: '2024-06-01T00:00:00Z',
        windDirDeg: 225,
        windSpeedKts: 18,
        gustSpeedKts: 21,
        cloudCoverPct: 10,
        precipitationProbabilityPct: 0,
        source: 'open-meteo',
      },
      {
        timestamp: '2024-06-01T01:00:00Z',
        windDirDeg: 230,
        windSpeedKts: 22,
        gustSpeedKts: 27,
        cloudCoverPct: 40,
        precipitationProbabilityPct: 5,
        source: 'open-meteo',
      },
    ]);
  });

  it('throws a descriptive error on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    });
    const provider = new OpenMeteoProvider(fetchImpl as unknown as typeof fetch);

    await expect(provider.fetchForecast(0, 0, 1)).rejects.toThrow(/500/);
  });
});
