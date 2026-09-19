import { GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { stripKeys } from './keys.js';
import type { SpotRecord } from './types.js';

const SK = 'META';
const pk = (spotId: string) => `SPOT#${spotId}`;
const gsi1pk = (country: string) => `COUNTRY#${country}`;

function toItem(spot: SpotRecord): Record<string, unknown> {
  return {
    ...spot,
    PK: pk(spot.spotId),
    SK,
    GSI1PK: gsi1pk(spot.country),
    GSI1SK: pk(spot.spotId),
  };
}

function fromItem(item: Record<string, unknown>): SpotRecord {
  return stripKeys<SpotRecord>(item, ['PK', 'SK', 'GSI1PK', 'GSI1SK']);
}

export class SpotRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async put(spot: SpotRecord): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toItem(spot),
      }),
    );
  }

  async getById(spotId: string): Promise<SpotRecord | null> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: pk(spotId), SK },
      }),
    );
    return result.Item ? fromItem(result.Item) : null;
  }

  /** Fine at the item counts this table is expected to hold (tens to low hundreds). */
  async listActive(): Promise<SpotRecord[]> {
    const result = await this.doc.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'active = :active',
        ExpressionAttributeValues: { ':active': true },
      }),
    );
    return (result.Items ?? []).map(fromItem);
  }

  async listByCountry(country: string): Promise<SpotRecord[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': gsi1pk(country) },
      }),
    );
    return (result.Items ?? []).map(fromItem);
  }
}
