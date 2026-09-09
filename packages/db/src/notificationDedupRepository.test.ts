import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { NotificationDedupRepository } from './notificationDedupRepository.js';

function fakeDoc(sendImpl: (command: unknown) => unknown) {
  return { send: vi.fn(sendImpl) } as unknown as DynamoDBDocumentClient;
}

describe('NotificationDedupRepository.markNotifiedIfNew', () => {
  it('returns true and writes a conditional put on the first notification', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: Record<string, unknown> }).input;
      return {};
    });

    const result = await new NotificationDedupRepository(doc, 'NotificationDedup').markNotifiedIfNew(
      'tg:123',
      'nin-croatia',
      '2024-06-01',
      88,
    );

    expect(result).toBe(true);
    expect(captured?.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(captured?.Item).toMatchObject({
      PK: 'USER#tg:123#SPOT#nin-croatia',
      SK: 'DATE#2024-06-01',
      score: 88,
    });
  });

  it('returns false without throwing when already notified (conditional check fails)', async () => {
    const doc = fakeDoc(() => {
      throw new ConditionalCheckFailedException({ message: 'conditional check failed', $metadata: {} });
    });

    const result = await new NotificationDedupRepository(doc, 'NotificationDedup').markNotifiedIfNew(
      'tg:123',
      'nin-croatia',
      '2024-06-01',
      88,
    );

    expect(result).toBe(false);
  });

  it('rethrows any other error', async () => {
    const doc = fakeDoc(() => {
      throw new Error('network blip');
    });

    await expect(
      new NotificationDedupRepository(doc, 'NotificationDedup').markNotifiedIfNew(
        'tg:123',
        'nin-croatia',
        '2024-06-01',
        88,
      ),
    ).rejects.toThrow('network blip');
  });
});
