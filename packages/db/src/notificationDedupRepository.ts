import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const pk = (userId: string, spotId: string) => `USER#${userId}#SPOT#${spotId}`;
const sk = (date: string) => `DATE#${date}`;

export class NotificationDedupRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Atomically records that `userId` was notified about `spotId` on `date`. Returns true the
   * first time (caller should proceed to notify); returns false if already recorded (caller
   * should skip — this is the dedup guard, not just bookkeeping).
   */
  async markNotifiedIfNew(userId: string, spotId: string, date: string, score: number): Promise<boolean> {
    const notifiedAt = new Date();
    const expiresAt = Math.floor(notifiedAt.getTime() / 1000) + SEVEN_DAYS_SECONDS;
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: pk(userId, spotId),
            SK: sk(date),
            notifiedAt: notifiedAt.toISOString(),
            score,
            expiresAt,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return false;
      }
      throw error;
    }
  }
}
