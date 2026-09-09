import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { stripKeys } from './keys.js';
import type { UserChannelLink, UserProfile } from './types.js';

const PROFILE_SK = 'PROFILE';
const pk = (userId: string) => `USER#${userId}`;
const channelSk = (channelType: string) => `CHANNEL#${channelType}`;

export class UserRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async upsertProfile(profile: UserProfile): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: pk(profile.userId), SK: PROFILE_SK, ...profile },
      }),
    );
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: pk(userId), SK: PROFILE_SK } }),
    );
    return result.Item ? stripKeys<UserProfile>(result.Item, ['PK', 'SK']) : null;
  }

  async linkChannel(link: UserChannelLink): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: pk(link.userId), SK: channelSk(link.channelType), ...link },
      }),
    );
  }

  async listChannels(userId: string): Promise<UserChannelLink[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': pk(userId), ':prefix': 'CHANNEL#' },
      }),
    );
    return (result.Items ?? []).map((item) => stripKeys<UserChannelLink>(item, ['PK', 'SK']));
  }
}
