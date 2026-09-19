import { describe, expect, it } from 'vitest';
import { buildMessage } from './buildMessage.js';
import type { GoodForecastDetectedDetail } from '@kite-signal/events';

const detail: GoodForecastDetectedDetail = {
  spotId: 'nin-croatia',
  spotName: 'Nin',
  country: 'HR',
  date: '2024-06-01',
  windowStart: '2024-06-01T12:00:00Z',
  windowEnd: '2024-06-01T17:00:00Z',
  durationHours: 5,
  avgScore: 88,
  rating: 'excellent',
  reasons: ['excellent conditions expected (avg score 88/100)'],
};

describe('buildMessage', () => {
  it('formats a human-readable title and body from the event detail', () => {
    const message = buildMessage(detail);
    expect(message.title).toBe('Nin: excellent kite conditions');
    expect(message.body).toContain('2024-06-01 12:00-17:00 UTC');
    expect(message.body).toContain('avg score 88/100');
    expect(message.body).toContain('excellent conditions expected (avg score 88/100)');
  });
});
