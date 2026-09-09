import { describe, expect, it, vi } from 'vitest';
import { TelegramChannel } from './telegram.js';

describe('TelegramChannel', () => {
  it('POSTs to the Telegram sendMessage endpoint with the chat id and formatted text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    const channel = new TelegramChannel('BOT_TOKEN', fetchImpl as unknown as typeof fetch);

    await channel.send('12345', { title: 'Nin', body: 'Excellent conditions Saturday' });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.telegram.org/botBOT_TOKEN/sendMessage');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      chat_id: '12345',
      text: '*Nin*\nExcellent conditions Saturday',
      parse_mode: 'Markdown',
    });
  });

  it('throws a descriptive error on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });
    const channel = new TelegramChannel('BOT_TOKEN', fetchImpl as unknown as typeof fetch);

    await expect(channel.send('12345', { title: 'x', body: 'y' })).rejects.toThrow(/403/);
  });
});
