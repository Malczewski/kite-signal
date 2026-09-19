import { describe, expect, it } from 'vitest';
import { groupConsecutiveDates } from './streaks.js';

describe('groupConsecutiveDates', () => {
  it('groups items that fall on consecutive calendar dates into one run', () => {
    const items = [{ date: '2024-06-01' }, { date: '2024-06-02' }, { date: '2024-06-03' }];
    expect(groupConsecutiveDates(items)).toEqual([items]);
  });

  it('splits into separate runs when a date is skipped', () => {
    const items = [{ date: '2024-06-01' }, { date: '2024-06-03' }];
    expect(groupConsecutiveDates(items)).toEqual([[items[0]], [items[1]]]);
  });

  it('sorts out-of-order input before grouping', () => {
    const items = [{ date: '2024-06-02' }, { date: '2024-06-01' }];
    expect(groupConsecutiveDates(items)).toEqual([[items[1], items[0]]]);
  });

  it('returns an empty array for no items', () => {
    expect(groupConsecutiveDates([])).toEqual([]);
  });
});
