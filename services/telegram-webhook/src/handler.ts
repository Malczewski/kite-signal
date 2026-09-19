import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { createDynamoDocumentClient, SpotRepository, SubscriptionRepository, UserRepository } from '@kite-signal/db';
import { TelegramChannel } from '@kite-signal/notification-channels';
import { createLogger, createTracer } from '@kite-signal/observability';
import { handleCommand } from './commands.js';

const SERVICE_NAME = 'telegram-webhook';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const spotsTableName = requiredEnv('SPOTS_TABLE_NAME');
const usersTableName = requiredEnv('USERS_TABLE_NAME');
const subscriptionsTableName = requiredEnv('SUBSCRIPTIONS_TABLE_NAME');
const botTokenParamName = requiredEnv('TELEGRAM_BOT_TOKEN_PARAM');
const webhookSecretParamName = requiredEnv('TELEGRAM_WEBHOOK_SECRET_PARAM');

const logger = createLogger(SERVICE_NAME);
const tracer = createTracer(SERVICE_NAME);

const doc = createDynamoDocumentClient();
const spotRepository = new SpotRepository(doc, spotsTableName);
const userRepository = new UserRepository(doc, usersTableName);
const subscriptionRepository = new SubscriptionRepository(doc, subscriptionsTableName);
const ssm = tracer.captureAWSv3Client(new SSMClient({}));

let cachedBotToken: string | undefined;
let cachedWebhookSecret: string | undefined;

async function getSsmSecret(name: string): Promise<string> {
  const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${name} has no value`);
  return value;
}

async function getBotToken(): Promise<string> {
  cachedBotToken ??= await getSsmSecret(botTokenParamName);
  return cachedBotToken;
}

async function getWebhookSecret(): Promise<string> {
  cachedWebhookSecret ??= await getSsmSecret(webhookSecretParamName);
  return cachedWebhookSecret;
}

function getHeader(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

interface ApiGatewayV2Event {
  headers?: Record<string, string | undefined>;
  body?: string;
}

interface ApiGatewayV2Response {
  statusCode: number;
  body: string;
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

export const handler = async (event: ApiGatewayV2Event): Promise<ApiGatewayV2Response> => {
  const providedSecret = getHeader(event.headers, 'x-telegram-bot-api-secret-token');
  if (providedSecret !== (await getWebhookSecret())) {
    logger.warn('rejected request with invalid/missing secret token');
    return { statusCode: 401, body: 'unauthorized' };
  }

  if (!event.body) return { statusCode: 200, body: 'ok' };

  const update = JSON.parse(event.body) as TelegramUpdate;
  const chatId = update.message?.chat.id;
  const text = update.message?.text;
  if (chatId === undefined || !text) {
    return { statusCode: 200, body: 'ok' };
  }

  const userId = `tg:${chatId}`;
  const target = String(chatId);
  const telegram = new TelegramChannel(await getBotToken());

  try {
    const reply = await handleCommand(
      { spotRepository, subscriptionRepository, userRepository },
      userId,
      target,
      text,
    );
    await telegram.send(target, reply);
  } catch (error) {
    logger.error('error handling command', error as Error);
    await telegram.send(target, {
      title: 'Error',
      body: 'Something went wrong handling that command.',
    });
  }

  return { statusCode: 200, body: 'ok' };
};
