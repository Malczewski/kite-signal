import { describe, expect, it, vi } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SpotRepository } from './spotRepository.js';
import type { SpotRecord } from './types.js';

const spot: SpotRecord = {
  spotId: 'nin-croatia',
  name: 'Nin',
  country: 'HR',
  lat: 44.2397,
  lon: 15.1808,
  active: true,
  idealWindDirRange: [200, 250],
  usableWindDirRange: [180, 270],
  dangerousWindDirRanges: [[0, 90]],
  minWindKts: 12,
  idealWindKts: [18, 24],
  maxWindKts: 35,
  gustToleranceKts: 6,
  skillLevel: 'intermediate',
};

function fakeDoc(sendImpl: (command: unknown) => unknown) {
  return { send: vi.fn(sendImpl) } as unknown as DynamoDBDocumentClient;
}

describe('SpotRepository', () => {
  it('put() writes an item keyed by SPOT#<id>/META with a country GSI', async () => {
    let captured: { TableName: string; Item: Record<string, unknown> } | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: typeof captured }).input;
      return {};
    });

    await new SpotRepository(doc, 'Spots').put(spot);

    expect(captured?.TableName).toBe('Spots');
    expect(captured?.Item).toMatchObject({
      PK: 'SPOT#nin-croatia',
      SK: 'META',
      GSI1PK: 'COUNTRY#HR',
      GSI1SK: 'SPOT#nin-croatia',
      spotId: 'nin-croatia',
      name: 'Nin',
    });
  });

  it('getById() strips DynamoDB key attributes from the returned record', async () => {
    const doc = fakeDoc(() => ({
      Item: {
        PK: 'SPOT#nin-croatia',
        SK: 'META',
        GSI1PK: 'COUNTRY#HR',
        GSI1SK: 'SPOT#nin-croatia',
        ...spot,
      },
    }));

    const result = await new SpotRepository(doc, 'Spots').getById('nin-croatia');

    expect(result).toEqual(spot);
  });

  it('getById() returns null when no item exists', async () => {
    const doc = fakeDoc(() => ({}));
    const result = await new SpotRepository(doc, 'Spots').getById('missing');
    expect(result).toBeNull();
  });

  it('listByCountry() queries GSI1 and strips key attributes from each item', async () => {
    let captured: Record<string, unknown> | undefined;
    const doc = fakeDoc((command) => {
      captured = (command as { input: Record<string, unknown> }).input;
      return {
        Items: [{ PK: 'SPOT#nin-croatia', SK: 'META', GSI1PK: 'COUNTRY#HR', GSI1SK: 'SPOT#nin-croatia', ...spot }],
      };
    });

    const result = await new SpotRepository(doc, 'Spots').listByCountry('HR');

    expect(captured?.IndexName).toBe('GSI1');
    expect(captured?.ExpressionAttributeValues).toEqual({ ':pk': 'COUNTRY#HR' });
    expect(result).toEqual([spot]);
  });
});
