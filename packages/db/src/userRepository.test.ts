import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { UserRepository } from './userRepository.js';

function fakeDoc(sendImpl: (command: unknown) => unknown) {
  return { send: vi.fn(sendImpl) } as unknown as DynamoDBDocumentClient;
}

describe('UserRepository', () => {
  it('linkChannel() writes a CHANNEL#<type> item under the user', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: { Item: Record<string, unknown> } }).input.Item;
      return {};
    });

    await new UserRepository(doc, 'Users').linkChannel({
      userId: 'tg:123',
      channelType: 'telegram',
      target: '123',
    });

    expect(captured).toMatchObject({ PK: 'USER#tg:123', SK: 'CHANNEL#telegram', target: '123' });
  });

  it('listChannels() queries by PK + CHANNEL# prefix and strips key attributes', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: Record<string, unknown> }).input;
      return {
        Items: [{ PK: 'USER#tg:123', SK: 'CHANNEL#telegram', userId: 'tg:123', channelType: 'telegram', target: '123' }],
      };
    });

    const result = await new UserRepository(doc, 'Users').listChannels('tg:123');

    expect(captured?.ExpressionAttributeValues).toEqual({ ':pk': 'USER#tg:123', ':prefix': 'CHANNEL#' });
    expect(result).toEqual([{ userId: 'tg:123', channelType: 'telegram', target: '123' }]);
  });
});
