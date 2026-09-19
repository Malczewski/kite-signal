function nextCalendarDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Splits a set of dated items into runs of consecutive calendar dates. Assumes every item
 * already qualifies (e.g. "had a good window") — this only decides which qualifying days are
 * adjacent, not whether a day qualifies at all. Used both to find a spot's good-day streaks and
 * to re-derive a subscriber's own (possibly shorter) qualifying run within one.
 */
export function groupConsecutiveDates<T extends { date: string }>(items: T[]): T[][] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const runs: T[][] = [];
  for (const item of sorted) {
    const lastRun = runs.at(-1);
    if (lastRun && nextCalendarDate(lastRun.at(-1)!.date) === item.date) {
      lastRun.push(item);
    } else {
      runs.push([item]);
    }
  }
  return runs;
}
