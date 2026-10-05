/** Tipos de domínio compartilhados com o app (mesma forma dos dados gravados no Firebase). */
export const NOTIFICATION_POLICIES = ['all_group_messages', 'mentioned_members', 'direct_messages_only', 'disabled'] as const;
export type NotificationPolicy = (typeof NOTIFICATION_POLICIES)[number];

export type ConversationType = 'direct' | 'group';

export type MessageTarget = { type: 'conversation' } | { type: 'member'; memberId: string };

export type StoredMessage = {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
};

export type ConversationContext =
  | { type: 'direct'; id: string; participantIds: [string, string]; policy: NotificationPolicy }
  | { type: 'group'; id: string; name: string; ownerId: string; memberIds: string[]; policy: NotificationPolicy };

export type PushProvider = 'fcm' | 'expo';

export type DeviceTarget = {
  uid: string;
  deviceId: string;
  token: string;
  provider: PushProvider;
};

export type PushContent = {
  title: string;
  body: string;
  data: { conversationId: string; conversationType: ConversationType };
};
