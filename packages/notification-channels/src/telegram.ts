import type { NotificationChannel, NotificationMessage } from './types.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/** `target` is the recipient's Telegram chat ID. */
export class TelegramChannel implements NotificationChannel {
  readonly channelType = 'telegram' as const;

  constructor(
    private readonly botToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(target: string, message: NotificationMessage): Promise<void> {
    const response = await this.fetchImpl(`${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: target,
        text: `*${message.title}*\n${message.body}`,
        parse_mode: 'Markdown',
      }),
    });
    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed: ${response.status} ${response.statusText}`);
    }
  }
}
