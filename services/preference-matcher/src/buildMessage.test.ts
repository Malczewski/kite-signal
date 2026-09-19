import { describe, expect, it } from 'vitest';
import type { SpotRecord } from '@kite-signal/db';
import type { DayWindow } from '@kite-signal/events';
import { buildMessage } from './buildMessage.js';

const spot: SpotRecord = {
  spotId: 'nin-croatia',
  name: 'Nin',
  country: 'HR',
  lat: 44.2397,
  lon: 15.1808,
  active: true,
  timezone: 'Europe/Zagreb',
  externalLinks: [{ label: 'Windy', url: 'https://www.windy.com/44.2397/15.1808?wind' }],
  idealWindDirRange: [315, 45],
  usableWindDirRange: [300, 60],
  dangerousWindDirRanges: [],
  minWindKts: 8,
  idealWindKts: [14, 24],
  maxWindKts: 35,
  gustToleranceKts: 6,
  skillLevel: 'beginner',
};

function day(overrides: Partial<DayWindow>): DayWindow {
  return {
    date: '2024-06-01',
    windowStart: '2024-06-01T06:00:00Z',
    windowEnd: '2024-06-01T14:00:00Z',
    durationHours: 8,
    avgScore: 88,
    rating: 'excellent',
    reasons: ['excellent conditions expected (avg score 88/100)'],
    windSpeedMinKts: 18,
    windSpeedMaxKts: 24,
    windDirDeg: 0,
    gustMaxKts: 28,
    condition: 'sunny',
    ...overrides,
  };
}

describe('buildMessage', () => {
  it('titles the message with the spot name and overall rating', () => {
    const message = buildMessage(spot, [day({})]);
    expect(message.title).toBe('Nin: excellent kite conditions');
  });

  it('renders the local time range using the spot timezone, not UTC', () => {
    const message = buildMessage(spot, [day({})]);
    // Europe/Zagreb is UTC+2 in June: 06:00-14:00 UTC -> 08:00-16:00 local.
    expect(message.body).toContain('08:00-16:00');
    expect(message.body).not.toContain('06:00');
  });

  it('includes a line per day for a multi-day streak', () => {
    const run = [
      day({ date: '2024-06-01', windowStart: '2024-06-01T06:00:00Z', windowEnd: '2024-06-01T14:00:00Z' }),
      day({ date: '2024-06-02', windowStart: '2024-06-02T06:00:00Z', windowEnd: '2024-06-02T14:00:00Z' }),
      day({ date: '2024-06-03', windowStart: '2024-06-03T06:00:00Z', windowEnd: '2024-06-03T14:00:00Z' }),
    ];
    const message = buildMessage(spot, run);
    expect(message.body).toContain('3 days of excellent kite conditions expected');
    expect(message.body.match(/kt/g)).toHaveLength(3);
  });

  it('shows a green quality indicator and wind range for ideal conditions', () => {
    const message = buildMessage(spot, [day({ windSpeedMinKts: 18, windSpeedMaxKts: 22, windDirDeg: 0 })]);
    expect(message.body).toContain('🟢 18-22kt');
    expect(message.body).toContain('🟢 ↓');
  });

  it('shows a red quality indicator for a poor wind direction', () => {
    const message = buildMessage(spot, [day({ windDirDeg: 180 })]);
    expect(message.body).toContain('🔴');
  });

  it('shows a red quality indicator for a hazardous wind direction', () => {
    const dangerousSpot: SpotRecord = { ...spot, dangerousWindDirRanges: [[170, 190]] };
    const message = buildMessage(dangerousSpot, [day({ windDirDeg: 180 })]);
    expect(message.body).toContain('🔴');
  });

  it('labels condition with an emoji', () => {
    const message = buildMessage(spot, [day({ condition: 'rain' })]);
    expect(message.body).toContain('🌧️ rain likely');
  });

  it('appends external links when present', () => {
    const message = buildMessage(spot, [day({})]);
    expect(message.body).toContain('[Windy](https://www.windy.com/44.2397/15.1808?wind)');
  });

  it('omits the links line when the spot has none', () => {
    const { externalLinks: _externalLinks, ...spotWithoutLinks } = spot;
    const message = buildMessage(spotWithoutLinks as SpotRecord, [day({})]);
    expect(message.body).not.toContain('http');
  });
});
