import type { ChatGroup } from './group';
import type { DirectNotificationPolicy } from './notification';

export type ConversationType = 'direct' | 'group';

export type MessageTarget = { type: 'conversation' } | { type: 'member'; memberId: string };

/** Realtime Database `messages/{conversationId}/{messageId}` */
export type ChatMessage = {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
};

/** Firestore `directConversations/{conversationId}` */
export type DirectConversation = {
  id: string;
  type: 'direct';
  participantIds: [string, string];
  notificationPolicy: DirectNotificationPolicy;
  createdAt: number;
  updatedAt: number;
};

export type OutgoingMessage = {
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
};

/** Mensagem que falhou ao ser persistida — fica só na UI até o usuário reenviar ou descartar. */
export type FailedMessage = OutgoingMessage & {
  localId: string;
  error: string;
  failedAt: number;
};

export type ConversationListItem =
  | { kind: 'direct'; id: string; conversation: DirectConversation; otherUserId: string; sortKey: number }
  | { kind: 'group'; id: string; group: ChatGroup; sortKey: number };
