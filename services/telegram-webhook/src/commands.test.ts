import { describe, expect, it, vi } from 'vitest';
import { handleCommand } from './commands.js';
import type { CommandDeps } from './commands.js';

function makeDeps(overrides: Partial<CommandDeps> = {}): CommandDeps {
  return {
    spotRepository: {
      getById: vi.fn().mockResolvedValue(null),
      listActive: vi.fn().mockResolvedValue([]),
    },
    subscriptionRepository: {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      updateThreshold: vi.fn().mockResolvedValue(true),
      listForUser: vi.fn().mockResolvedValue([]),
    },
    userRepository: {
      upsertProfile: vi.fn().mockResolvedValue(undefined),
      linkChannel: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

describe('handleCommand', () => {
  it('/start upserts a profile and links the telegram channel', async () => {
    const deps = makeDeps();
    const reply = await handleCommand(deps, 'tg:123', '123', '/start');

    expect(deps.userRepository.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tg:123', globalMute: false }),
    );
    expect(deps.userRepository.linkChannel).toHaveBeenCalledWith({
      userId: 'tg:123',
      channelType: 'telegram',
      target: '123',
    });
    expect(reply.title).toBe('Welcome to kite-signal');
  });

  it('/subscribe rejects an unknown spot id without writing a subscription', async () => {
    const deps = makeDeps();
    const reply = await handleCommand(deps, 'tg:123', '123', '/subscribe unknown-spot');

    expect(deps.subscriptionRepository.subscribe).not.toHaveBeenCalled();
    expect(reply.body).toMatch(/no spot found/i);
  });

  it('/subscribe writes a subscription with default thresholds for a known spot', async () => {
    const deps = makeDeps({
      spotRepository: {
        getById: vi.fn().mockResolvedValue({ spotId: 'nin-croatia', name: 'Nin' }),
        listActive: vi.fn().mockResolvedValue([]),
      },
    });

    const reply = await handleCommand(deps, 'tg:123', '123', '/subscribe nin-croatia');

    expect(deps.subscriptionRepository.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tg:123', spotId: 'nin-croatia', minScoreThreshold: 65 }),
    );
    expect(reply.body).toContain('Nin');
  });

  it('/setthreshold validates the score range before calling the repository', async () => {
    const deps = makeDeps();
    const reply = await handleCommand(deps, 'tg:123', '123', '/setthreshold nin-croatia 150');

    expect(deps.subscriptionRepository.updateThreshold).not.toHaveBeenCalled();
    expect(reply.body).toMatch(/usage/i);
  });

  it('/setthreshold reports "not subscribed" when the repository update fails', async () => {
    const deps = makeDeps({
      subscriptionRepository: {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        updateThreshold: vi.fn().mockResolvedValue(false),
        listForUser: vi.fn().mockResolvedValue([]),
      },
    });

    const reply = await handleCommand(deps, 'tg:123', '123', '/setthreshold nin-croatia 80');

    expect(reply.title).toBe('Not subscribed');
  });

  it('falls back to a help message for an unrecognized command', async () => {
    const deps = makeDeps();
    const reply = await handleCommand(deps, 'tg:123', '123', '/nonsense');
    expect(reply.body).toMatch(/unknown command/i);
  });
});
