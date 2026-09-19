import { classifyDirectionQuality, classifySpeedQuality, normalizeDegrees, rate } from '@kite-signal/domain';
import type { Condition, Quality } from '@kite-signal/domain';
import type { SpotRecord } from '@kite-signal/db';
import type { DayWindow } from '@kite-signal/events';
import type { NotificationMessage } from '@kite-signal/notification-channels';

const QUALITY_EMOJI: Record<Quality, string> = {
  ideal: '🟢',
  usable: '🟡',
  poor: '🔴',
  hazard: '🔴',
};

const CONDITION_LABEL: Record<Condition, string> = {
  sunny: '☀️ sunny',
  'partly-cloudy': '⛅ partly cloudy',
  cloudy: '☁️ cloudy',
  rain: '🌧️ rain likely',
};

// Points in the direction the wind is blowing TOWARD (windDirDeg is meteorological - the
// direction it blows FROM), matching how wind-vane arrows read on Windy/Windguru/Windfinder.
const COMPASS_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

function directionArrow(windDirDeg: number): string {
  const towardDeg = normalizeDegrees(windDirDeg + 180);
  return COMPASS_ARROWS[Math.round(towardDeg / 45) % 8]!;
}

function formatLocalDateTime(iso: string, timezone: string): { date: string; time: string } {
  const instant = new Date(iso);
  return {
    date: new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric' }).format(instant),
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(instant),
  };
}

function formatLocalRange(startIso: string, endIso: string, timezone: string): string {
  const start = formatLocalDateTime(startIso, timezone);
  const end = formatLocalDateTime(endIso, timezone);
  return start.date === end.date
    ? `${start.date}, ${start.time}-${end.time}`
    : `${start.date} ${start.time} - ${end.date} ${end.time}`;
}

function formatDayLine(spot: SpotRecord, day: DayWindow): string {
  const timeRange = formatLocalRange(day.windowStart, day.windowEnd, spot.timezone);
  const speedQuality = classifySpeedQuality(spot, (day.windSpeedMinKts + day.windSpeedMaxKts) / 2);
  const directionQuality = classifyDirectionQuality(spot, day.windDirDeg);
  const speedEmoji = QUALITY_EMOJI[speedQuality];
  const directionEmoji = QUALITY_EMOJI[directionQuality];
  const arrow = directionArrow(day.windDirDeg);

  return (
    `${timeRange}: ${speedEmoji} ${day.windSpeedMinKts}-${day.windSpeedMaxKts}kt ${directionEmoji} ${arrow}, ` +
    `${CONDITION_LABEL[day.condition]} (score ${day.avgScore})`
  );
}

function formatLinks(spot: SpotRecord): string | undefined {
  if (!spot.externalLinks?.length) return undefined;
  return spot.externalLinks.map((link) => `[${link.label}](${link.url})`).join(' | ');
}

export function buildMessage(spot: SpotRecord, run: DayWindow[]): NotificationMessage {
  const avgScore = Math.round(run.reduce((sum, day) => sum + day.avgScore, 0) / run.length);
  const rating = rate(avgScore);
  const period = formatLocalRange(run[0]!.windowStart, run.at(-1)!.windowEnd, spot.timezone);
  const daysLabel = run.length === 1 ? '1 day' : `${run.length} days`;

  const lines = [
    period,
    `${daysLabel} of ${rating} kite conditions expected`,
    '',
    ...run.map((day) => formatDayLine(spot, day)),
  ];

  const links = formatLinks(spot);
  if (links) lines.push('', links);

  return {
    title: `${spot.name}: ${rating} kite conditions`,
    body: lines.join('\n'),
  };
}
