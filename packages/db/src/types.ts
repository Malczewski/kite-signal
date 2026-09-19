import type { SpotKnowledge } from '@kite-signal/domain';
import type { NotificationChannelType } from '@kite-signal/notification-channels';

export interface SpotExternalLink {
  label: string;
  url: string;
}

/** Everything about a spot: the scoring-relevant fields (SpotKnowledge) plus lookup metadata. */
export interface SpotRecord extends SpotKnowledge {
  country: string;
  lat: number;
  lon: number;
  active: boolean;
  /** IANA name, e.g. "Europe/Zagreb" — used to render forecast times in the spot's local time. */
  timezone: string;
  /** Curated forecast/webcam links shown alongside notifications, e.g. Windy, Windguru. */
  externalLinks?: SpotExternalLink[];
}

export interface UserProfile {
  userId: string;
  languagePref?: string;
  globalMute: boolean;
  createdAt: string;
}

/** Links a channel-neutral userId to a delivery target on one notification channel. */
export interface UserChannelLink {
  userId: string;
  channelType: NotificationChannelType;
  /** e.g. a Telegram chat ID */
  target: string;
}

export interface Subscription {
  userId: string;
  spotId: string;
  minScoreThreshold: number;
  minDurationHours: number;
  /** How many consecutive good days are required before notifying. */
  minConsecutiveDays: number;
  createdAt: string;
}

export interface NotificationDedupRecord {
  userId: string;
  spotId: string;
  /** UTC calendar date, YYYY-MM-DD */
  date: string;
  notifiedAt: string;
  score: number;
}
