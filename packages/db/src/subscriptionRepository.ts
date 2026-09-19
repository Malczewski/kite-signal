import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { stripKeys } from './keys.js';
import type { Subscription } from './types.js';

const pk = (userId: string) => `USER#${userId}`;
const sk = (spotId: string) => `SUB#${spotId}`;
const gsi1pk = (spotId: string) => `SPOT#${spotId}`;
const gsi1sk = (userId: string) => `USER#${userId}`;
const KEY_ATTRS = ['PK', 'SK', 'GSI1PK', 'GSI1SK'];

export class SubscriptionRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async subscribe(sub: Subscription): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: pk(sub.userId),
          SK: sk(sub.spotId),
          GSI1PK: gsi1pk(sub.spotId),
          GSI1SK: gsi1sk(sub.userId),
          ...sub,
        },
      }),
    );
  }

  async unsubscribe(userId: string, spotId: string): Promise<void> {
    await this.doc.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: pk(userId), SK: sk(spotId) },
      }),
    );
  }

  async listForUser(userId: string): Promise<Subscription[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': pk(userId), ':prefix': 'SUB#' },
      }),
    );
    return (result.Items ?? []).map((item) => stripKeys<Subscription>(item, KEY_ATTRS));
  }

  /** Returns false (without throwing) if the user isn't subscribed to this spot yet. */
  async updateThreshold(userId: string, spotId: string, minScoreThreshold: number): Promise<boolean> {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: pk(userId), SK: sk(spotId) },
          UpdateExpression: 'SET minScoreThreshold = :v',
          ExpressionAttributeValues: { ':v': minScoreThreshold },
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  /** Returns false (without throwing) if the user isn't subscribed to this spot yet. */
  async updateConsecutiveDays(userId: string, spotId: string, minConsecutiveDays: number): Promise<boolean> {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: pk(userId), SK: sk(spotId) },
          UpdateExpression: 'SET minConsecutiveDays = :v',
          ExpressionAttributeValues: { ':v': minConsecutiveDays },
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  /** The matcher's core access pattern: who's subscribed to this spot. */
  async listSubscribersForSpot(spotId: string): Promise<Subscription[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': gsi1pk(spotId) },
      }),
    );
    return (result.Items ?? []).map((item) => stripKeys<Subscription>(item, KEY_ATTRS));
  }
}
