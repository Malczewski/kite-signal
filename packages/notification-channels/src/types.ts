export type NotificationChannelType = 'telegram';

export interface NotificationMessage {
  title: string;
  body: string;
}

export interface NotificationChannel {
  readonly channelType: NotificationChannelType;
  send(target: string, message: NotificationMessage): Promise<void>;
}
