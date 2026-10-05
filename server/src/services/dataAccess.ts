import { FieldValue } from 'firebase-admin/firestore';
import type { ConversationContext, DeviceTarget, MessageTarget, StoredMessage } from '../types.js';
import { NOTIFICATION_POLICIES } from '../types.js';
import { asStringArray, isNonEmptyString, isOneOf, isRecord } from '../utils/guards.js';
import { firestore, rtdb } from './firebaseAdmin.js';

const DIRECT_PREFIX = 'dm_';

export const isDirectConversationId = (id: string) => id.startsWith(DIRECT_PREFIX);

function parseTarget(value: unknown): MessageTarget {
  return isRecord(value) && value.type === 'member' && isNonEmptyString(value.memberId) ? { type: 'member', memberId: value.memberId } : { type: 'conversation' };
}

/** Lê a mensagem no Realtime Database (fonte da verdade das mensagens). */
export async function getMessage(conversationId: string, messageId: string): Promise<StoredMessage | null> {
  const snapshot = await rtdb.ref(`messages/${conversationId}/${messageId}`).get();
  const data: unknown = snapshot.val();
  if (!isRecord(data) || !isNonEmptyString(data.senderId) || typeof data.text !== 'string') return null;
  if (!isOneOf(data.conversationType, ['direct', 'group'] as const)) return null;
  return {
    id: messageId,
    conversationId,
    conversationType: data.conversationType,
    senderId: data.senderId,
    text: data.text,
    target: parseTarget(data.target),
    mentionedUserIds: asStringArray(data.mentionedUserIds),
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
  };
}

/** Participantes e política atuais da conversa (Firestore). */
export async function getConversation(conversationId: string): Promise<ConversationContext | null> {
  if (isDirectConversationId(conversationId)) {
    const snapshot = await firestore.collection('directConversations').doc(conversationId).get();
    const data: unknown = snapshot.data();
    if (!isRecord(data)) return null;
    const [first, second, ...rest] = asStringArray(data.participantIds);
    if (!first || !second || rest.length > 0) return null;
    return {
      type: 'direct',
      id: conversationId,
      participantIds: [first, second],
      policy: isOneOf(data.notificationPolicy, NOTIFICATION_POLICIES) ? data.notificationPolicy : 'direct_messages_only',
    };
  }

  const snapshot = await firestore.collection('groups').doc(conversationId).get();
  const data: unknown = snapshot.data();
  if (!isRecord(data) || !isNonEmptyString(data.ownerId)) return null;
  return {
    type: 'group',
    id: conversationId,
    name: isNonEmptyString(data.name) ? data.name : 'Grupo',
    ownerId: data.ownerId,
    memberIds: asStringArray(data.memberIds),
    policy: isOneOf(data.notificationPolicy, NOTIFICATION_POLICIES) ? data.notificationPolicy : 'all_group_messages',
  };
}

export function isParticipant(conversation: ConversationContext, uid: string): boolean {
  return conversation.type === 'direct' ? conversation.participantIds.includes(uid) : conversation.memberIds.includes(uid);
}

export async function getDisplayName(uid: string): Promise<string> {
  const snapshot = await firestore.collection('userDirectory').doc(uid).get();
  const name: unknown = snapshot.get('name');
  return isNonEmptyString(name) ? name : 'Alguém';
}

/** Dispositivos ativos dos destinatários (`users/{uid}/devices`, ilegíveis para outros usuários). */
export async function getActiveDevices(uids: readonly string[]): Promise<DeviceTarget[]> {
  const perUser = await Promise.all(
    uids.map(async (uid) => {
      const snapshot = await firestore.collection('users').doc(uid).collection('devices').where('enabled', '==', true).get();
      return snapshot.docs.flatMap((doc): DeviceTarget[] => {
        const data: unknown = doc.data();
        if (!isRecord(data) || !isNonEmptyString(data.token) || !isOneOf(data.provider, ['fcm', 'expo'] as const)) return [];
        return [{ uid, deviceId: doc.id, token: data.token, provider: data.provider }];
      });
    }),
  );
  return perUser.flat();
}

/** Tokens rejeitados pelo FCM/Expo são desativados para não serem usados de novo. */
export async function disableDevices(devices: readonly DeviceTarget[]): Promise<void> {
  if (devices.length === 0) return;
  const batch = firestore.batch();
  for (const device of devices) {
    batch.update(firestore.collection('users').doc(device.uid).collection('devices').doc(device.deviceId), {
      enabled: false,
      disabledReason: 'invalid_token',
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
}

// ───────────── Idempotência ─────────────

const dispatchRef = (conversationId: string, messageId: string) => firestore.collection('notificationDispatches').doc(`${conversationId}__${messageId}`);

/**
 * Reserva o envio da mensagem. `create()` falha se o documento já existe — operação atômica no Firestore,
 * portanto duas requisições simultâneas para a mesma mensagem nunca disparam push duas vezes.
 */
export async function acquireDispatchLock(conversationId: string, messageId: string, senderId: string): Promise<boolean> {
  try {
    await dispatchRef(conversationId, messageId).create({ status: 'processing', senderId, createdAt: FieldValue.serverTimestamp() });
    return true;
  } catch (error) {
    // gRPC 6 = ALREADY_EXISTS
    if (isRecord(error) && error.code === 6) return false;
    throw error;
  }
}

export async function completeDispatch(conversationId: string, messageId: string, result: { recipients: number; sent: number; failed: number }): Promise<void> {
  await dispatchRef(conversationId, messageId).update({ status: 'done', ...result, completedAt: FieldValue.serverTimestamp() });
}

/** Libera a reserva quando NADA foi enviado, permitindo nova tentativa. */
export async function releaseDispatchLock(conversationId: string, messageId: string): Promise<void> {
  await dispatchRef(conversationId, messageId).delete();
}

// ───────────── Espelho de integrantes (Firestore → RTDB) ─────────────

/**
 * `groupMembers/{groupId}` no RTDB é escrito SOMENTE pela API. As regras do RTDB usam esse espelho
 * para decidir quem lê/escreve mensagens do grupo — o Firestore continua sendo a fonte da verdade.
 */
export async function syncGroupMembersMirror(groupId: string, memberIds: readonly string[] | null): Promise<void> {
  const ref = rtdb.ref(`groupMembers/${groupId}`);
  if (!memberIds || memberIds.length === 0) {
    await ref.remove();
    return;
  }
  await ref.set(Object.fromEntries(memberIds.map((uid) => [uid, true])));
}

export async function getMirroredMembers(groupId: string): Promise<string[]> {
  const snapshot = await rtdb.ref(`groupMembers/${groupId}`).get();
  const value: unknown = snapshot.val();
  return isRecord(value) ? Object.keys(value) : [];
}
