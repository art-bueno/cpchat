import type { ChatMessage, DirectConversation, MessageTarget } from '../types/chat';
import type { ChatGroup } from '../types/group';
import { DIRECT_NOTIFICATION_POLICIES, NOTIFICATION_POLICIES } from '../types/notification';
import type { ChatUser, UserDirectoryEntry, UserProfileView } from '../types/user';
import { asNumber, asString, asStringArray, isNonEmptyString, isOneOf, isRecord } from '../utils/guards';

/**
 * Fronteira entre o banco (dados `unknown`) e o domínio tipado.
 * Registros malformados retornam `null` e são descartados pela UI em vez de quebrá-la.
 */

export function parseChatUser(uid: string, data: unknown): ChatUser | null {
  if (!isRecord(data) || !isNonEmptyString(data.name)) return null;
  return {
    uid,
    name: data.name,
    email: asString(data.email),
    phoneNumber: asString(data.phoneNumber),
    birthDate: asString(data.birthDate),
    photoUrl: asString(data.photoUrl),
    createdAt: asNumber(data.createdAt),
  };
}

export function parseDirectoryEntry(uid: string, data: unknown): UserDirectoryEntry | null {
  if (!isRecord(data) || !isNonEmptyString(data.name)) return null;
  return {
    uid,
    name: data.name,
    nameLower: asString(data.nameLower, data.name.toLowerCase()),
    photoUrl: asString(data.photoUrl),
    updatedAt: asNumber(data.updatedAt),
  };
}

function nullableString(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

export function parseProfileView(data: unknown): UserProfileView | null {
  if (!isRecord(data) || !isNonEmptyString(data.uid)) return null;
  return {
    uid: data.uid,
    name: nullableString(data.name),
    email: nullableString(data.email),
    phoneNumber: nullableString(data.phoneNumber),
    birthDate: nullableString(data.birthDate),
    photoUrl: nullableString(data.photoUrl),
  };
}

export function parseGroup(id: string, data: unknown): ChatGroup | null {
  if (!isRecord(data) || !isNonEmptyString(data.name) || !isNonEmptyString(data.ownerId)) return null;
  return {
    id,
    name: data.name,
    photoUrl: asString(data.photoUrl),
    ownerId: data.ownerId,
    memberIds: asStringArray(data.memberIds),
    memberLimit: asNumber(data.memberLimit, 2),
    notificationPolicy: isOneOf(data.notificationPolicy, NOTIFICATION_POLICIES) ? data.notificationPolicy : 'all_group_messages',
    createdAt: asNumber(data.createdAt),
    updatedAt: asNumber(data.updatedAt),
  };
}

export function parseDirectConversation(id: string, data: unknown): DirectConversation | null {
  if (!isRecord(data)) return null;
  const [first, second, ...rest] = asStringArray(data.participantIds);
  if (!first || !second || rest.length > 0) return null;
  return {
    id,
    type: 'direct',
    participantIds: [first, second],
    notificationPolicy: isOneOf(data.notificationPolicy, DIRECT_NOTIFICATION_POLICIES) ? data.notificationPolicy : 'direct_messages_only',
    createdAt: asNumber(data.createdAt),
    updatedAt: asNumber(data.updatedAt),
  };
}

function parseTarget(data: unknown): MessageTarget {
  if (isRecord(data) && data.type === 'member' && isNonEmptyString(data.memberId)) {
    return { type: 'member', memberId: data.memberId };
  }
  return { type: 'conversation' };
}

export function parseMessage(id: string | null, data: unknown): ChatMessage | null {
  if (!id || !isRecord(data) || !isNonEmptyString(data.senderId) || typeof data.text !== 'string') return null;
  if (!isOneOf(data.conversationType, ['direct', 'group'] as const)) return null;
  return {
    id,
    conversationId: asString(data.conversationId),
    conversationType: data.conversationType,
    senderId: data.senderId,
    text: data.text,
    target: parseTarget(data.target),
    mentionedUserIds: asStringArray(data.mentionedUserIds),
    createdAt: asNumber(data.createdAt, Date.now()),
  };
}
