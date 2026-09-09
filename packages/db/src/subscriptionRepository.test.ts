import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionRepository } from './subscriptionRepository.js';
import type { Subscription } from './types.js';

const sub: Subscription = {
  userId: 'tg:123',
  spotId: 'nin-croatia',
  minScoreThreshold: 65,
  minDurationHours: 3,
  createdAt: '2024-06-01T00:00:00Z',
};

function fakeDoc(sendImpl: (command: unknown) => unknown) {
  return { send: vi.fn(sendImpl) } as unknown as DynamoDBDocumentClient;
}

describe('SubscriptionRepository', () => {
  it('subscribe() writes an item with both the primary key and the spot GSI key', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: { Item: Record<string, unknown> } }).input.Item;
      return {};
    });

    await new SubscriptionRepository(doc, 'Subscriptions').subscribe(sub);

    expect(captured).toMatchObject({
      PK: 'USER#tg:123',
      SK: 'SUB#nin-croatia',
      GSI1PK: 'SPOT#nin-croatia',
      GSI1SK: 'USER#tg:123',
      minScoreThreshold: 65,
    });
  });

  it('listSubscribersForSpot() queries GSI1 and strips key attributes', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: Record<string, unknown> }).input;
      return {
        Items: [
          {
            PK: 'USER#tg:123',
            SK: 'SUB#nin-croatia',
            GSI1PK: 'SPOT#nin-croatia',
            GSI1SK: 'USER#tg:123',
            ...sub,
          },
        ],
      };
    });

    const result = await new SubscriptionRepository(doc, 'Subscriptions').listSubscribersForSpot(
      'nin-croatia',
    );

    expect(captured?.IndexName).toBe('GSI1');
    expect(captured?.ExpressionAttributeValues).toEqual({ ':pk': 'SPOT#nin-croatia' });
    expect(result).toEqual([sub]);
  });

  it('updateThreshold() returns true on success', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: Record<string, unknown> }).input;
      return {};
    });

    const result = await new SubscriptionRepository(doc, 'Subscriptions').updateThreshold(
      'tg:123',
      'nin-croatia',
      80,
    );

    expect(result).toBe(true);
    expect(captured?.ConditionExpression).toBe('attribute_exists(PK)');
    expect(captured?.ExpressionAttributeValues).toEqual({ ':v': 80 });
  });

  it('updateThreshold() returns false when the subscription does not exist', async () => {
    const doc = fakeDoc(() => {
      throw new ConditionalCheckFailedException({ message: 'conditional check failed', $metadata: {} });
    });

    const result = await new SubscriptionRepository(doc, 'Subscriptions').updateThreshold(
      'tg:123',
      'nin-croatia',
      80,
    );

    expect(result).toBe(false);
  });

  it('unsubscribe() deletes by the composite key', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: Record<string, unknown> }).input;
      return {};
    });

    await new SubscriptionRepository(doc, 'Subscriptions').unsubscribe('tg:123', 'nin-croatia');

    expect(captured?.Key).toEqual({ PK: 'USER#tg:123', SK: 'SUB#nin-croatia' });
  });
});
