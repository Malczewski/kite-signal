import type { SpotRepository, SubscriptionRepository, UserRepository } from '@kite-signal/db';
import type { NotificationMessage } from '@kite-signal/notification-channels';

export interface CommandDeps {
  spotRepository: Pick<SpotRepository, 'getById' | 'listActive'>;
  subscriptionRepository: Pick<
    SubscriptionRepository,
    'subscribe' | 'unsubscribe' | 'updateThreshold' | 'updateConsecutiveDays' | 'listForUser'
  >;
  userRepository: Pick<UserRepository, 'upsertProfile' | 'linkChannel'>;
}

const DEFAULT_MIN_SCORE_THRESHOLD = 65;
const DEFAULT_MIN_DURATION_HOURS = 3;
const DEFAULT_MIN_CONSECUTIVE_DAYS = 3;

const HELP_TEXT =
  'Commands: /spots [search], /subscribe <spot-id>, /unsubscribe <spot-id>, ' +
  '/setthreshold <spot-id> <0-100>, /setconsecutivedays <spot-id> <N>, /mysubs';

/** `userId` is channel-neutral (e.g. `tg:<chatId>`); `target` is the Telegram chat ID. */
export async function handleCommand(
  deps: CommandDeps,
  userId: string,
  target: string,
  text: string,
): Promise<NotificationMessage> {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  const command = (rawCommand ?? '').toLowerCase();

  switch (command) {
    case '/start': {
      await deps.userRepository.upsertProfile({
        userId,
        globalMute: false,
        createdAt: new Date().toISOString(),
      });
      await deps.userRepository.linkChannel({ userId, channelType: 'telegram', target });
      return { title: 'Welcome to kite-signal', body: HELP_TEXT };
    }

    case '/spots': {
      const search = args.join(' ').toLowerCase();
      const spots = await deps.spotRepository.listActive();
      const matches = search
        ? spots.filter((s) => s.name.toLowerCase().includes(search) || s.spotId.includes(search))
        : spots;
      if (matches.length === 0) return { title: 'Spots', body: 'No matching spots found.' };
      return {
        title: 'Spots',
        body: matches.map((s) => `${s.spotId} - ${s.name} (${s.country})`).join('\n'),
      };
    }

    case '/subscribe': {
      const spotId = args[0];
      if (!spotId) return { title: 'Subscribe', body: 'Usage: /subscribe <spot-id>' };
      const spot = await deps.spotRepository.getById(spotId);
      if (!spot) return { title: 'Subscribe', body: `No spot found with id "${spotId}". Try /spots.` };
      await deps.subscriptionRepository.subscribe({
        userId,
        spotId,
        minScoreThreshold: DEFAULT_MIN_SCORE_THRESHOLD,
        minDurationHours: DEFAULT_MIN_DURATION_HOURS,
        minConsecutiveDays: DEFAULT_MIN_CONSECUTIVE_DAYS,
        createdAt: new Date().toISOString(),
      });
      return { title: 'Subscribed', body: `You're now subscribed to ${spot.name}.` };
    }

    case '/unsubscribe': {
      const spotId = args[0];
      if (!spotId) return { title: 'Unsubscribe', body: 'Usage: /unsubscribe <spot-id>' };
      await deps.subscriptionRepository.unsubscribe(userId, spotId);
      return { title: 'Unsubscribed', body: `You're no longer subscribed to ${spotId}.` };
    }

    case '/setthreshold': {
      const [spotId, scoreStr] = args;
      const score = Number(scoreStr);
      if (!spotId || !Number.isFinite(score) || score < 0 || score > 100) {
        return { title: 'Set threshold', body: 'Usage: /setthreshold <spot-id> <0-100>' };
      }
      const updated = await deps.subscriptionRepository.updateThreshold(userId, spotId, score);
      return updated
        ? { title: 'Updated', body: `Minimum score for ${spotId} set to ${score}.` }
        : { title: 'Not subscribed', body: `You're not subscribed to ${spotId} yet - use /subscribe first.` };
    }

    case '/setconsecutivedays': {
      const [spotId, daysStr] = args;
      const days = Number(daysStr);
      if (!spotId || !Number.isInteger(days) || days < 1) {
        return { title: 'Set consecutive days', body: 'Usage: /setconsecutivedays <spot-id> <N>' };
      }
      const updated = await deps.subscriptionRepository.updateConsecutiveDays(userId, spotId, days);
      return updated
        ? { title: 'Updated', body: `Minimum consecutive good days for ${spotId} set to ${days}.` }
        : { title: 'Not subscribed', body: `You're not subscribed to ${spotId} yet - use /subscribe first.` };
    }

    case '/mysubs': {
      const subs = await deps.subscriptionRepository.listForUser(userId);
      if (subs.length === 0) {
        return { title: 'Your subscriptions', body: "You haven't subscribed to any spots yet." };
      }
      return {
        title: 'Your subscriptions',
        body: subs
          .map(
            (s) =>
              `${s.spotId} (min score ${s.minScoreThreshold}, min ${s.minDurationHours}h, ` +
              `${s.minConsecutiveDays ?? DEFAULT_MIN_CONSECUTIVE_DAYS} consecutive days)`,
          )
          .join('\n'),
      };
    }

    default:
      return { title: 'kite-signal', body: `Unknown command.\n${HELP_TEXT}` };
  }
}
