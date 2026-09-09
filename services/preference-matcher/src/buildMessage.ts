import type { GoodForecastDetectedDetail } from '@kite-signal/events';
import type { NotificationMessage } from '@kite-signal/notification-channels';

function formatTimeUtc(iso: string): string {
  return iso.slice(11, 16);
}

export function buildMessage(detail: GoodForecastDetectedDetail): NotificationMessage {
  return {
    title: `${detail.spotName}: ${detail.rating} kite conditions`,
    body:
      `${detail.date} ${formatTimeUtc(detail.windowStart)}-${formatTimeUtc(detail.windowEnd)} UTC, ` +
      `avg score ${detail.avgScore}/100\n${detail.reasons.join('\n')}`,
  };
}
