import {
  limitToLast,
  onValue,
  orderByChild,
  push,
  query as rtdbQuery,
  ref,
  serverTimestamp,
  set,
  type Unsubscribe as RtdbUnsubscribe,
} from 'firebase/database';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ChatMessage, ConversationType, DirectConversation, OutgoingMessage } from '../types/chat';
import type { DirectNotificationPolicy } from '../types/notification';
import { buildDirectConversationId, sortedPair } from '../utils/conversationId';
import { AppError } from '../utils/errors';
import { database, firestore } from './firebase';
import { parseDirectConversation, parseMessage } from './parsers';

export const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_WINDOW = 200;

// ───────────────────────── Conversas individuais (Firestore) ─────────────────────────

/**
 * Cria ou localiza a conversa individual do par. O id determinístico + transação garantem
 * que dois toques simultâneos (ou os dois usuários ao mesmo tempo) resultem em UMA conversa.
 */
export async function getOrCreateDirectConversation(currentUid: string, otherUid: string): Promise<DirectConversation> {
  const id = buildDirectConversationId(currentUid, otherUid);
  const conversationRef = doc(firestore, 'directConversations', id);

  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(conversationRef);
    const existing = snapshot.exists() ? parseDirectConversation(id, snapshot.data()) : null;
    if (existing) return existing;

    const now = Date.now();
    const participantIds = sortedPair(currentUid, otherUid);
    const conversation: DirectConversation = {
      id,
      type: 'direct',
      participantIds,
      notificationPolicy: 'direct_messages_only',
      createdAt: now,
      updatedAt: now,
    };
    transaction.set(conversationRef, conversation);
    return conversation;
  });
}

export function subscribeToDirectConversations(
  uid: string,
  onData: (conversations: DirectConversation[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const conversationsQuery = query(collection(firestore, 'directConversations'), where('participantIds', 'array-contains', uid));
  return onSnapshot(
    conversationsQuery,
    (snapshot) =>
      onData(
        snapshot.docs
          .map((d) => parseDirectConversation(d.id, d.data()))
          .filter((c): c is DirectConversation => c !== null),
      ),
    onError,
  );
}

export function subscribeToDirectConversation(
  conversationId: string,
  onData: (conversation: DirectConversation | null) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, 'directConversations', conversationId),
    (snapshot) => onData(snapshot.exists() ? parseDirectConversation(snapshot.id, snapshot.data()) : null),
    onError,
  );
}

export function updateDirectNotificationPolicy(conversationId: string, policy: DirectNotificationPolicy): Promise<void> {
  return updateDoc(doc(firestore, 'directConversations', conversationId), { notificationPolicy: policy, updatedAt: Date.now() });
}

// ───────────────────────── Mensagens (Realtime Database) ─────────────────────────

/** Formato gravado no RTDB. `createdAt` é o timestamp do servidor (as regras exigem `=== now`). */
type MessageWrite = Omit<ChatMessage, 'createdAt' | 'mentionedUserIds'> & {
  createdAt: object;
  mentionedUserIds?: string[];
};

export type SendMessageParams = OutgoingMessage & {
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
};

/** Persiste a mensagem e devolve o id gerado. Só depois disso o push é solicitado à API. */
export async function sendMessage(params: SendMessageParams): Promise<string> {
  const text = params.text.trim();
  if (text.length === 0) throw new AppError('invalid-argument', 'Digite uma mensagem.');
  if (text.length > MAX_MESSAGE_LENGTH) throw new AppError('invalid-argument', `Máximo de ${MAX_MESSAGE_LENGTH} caracteres.`);
  if (params.conversationType === 'direct' && params.target.type === 'member') {
    throw new AppError('invalid-argument', 'Mensagens individuais não têm destinatário específico.');
  }

  const messageRef = push(ref(database, `messages/${params.conversationId}`));
  if (!messageRef.key) throw new AppError('invalid-argument', 'Não foi possível gerar o id da mensagem.');

  const mentionedUserIds = [...new Set(params.mentionedUserIds)].filter((id) => id !== params.senderId);
  const payload: MessageWrite = {
    id: messageRef.key,
    conversationId: params.conversationId,
    conversationType: params.conversationType,
    senderId: params.senderId,
    text,
    target: params.target,
    createdAt: serverTimestamp(),
    // RTDB não armazena arrays vazios; a ausência é lida como [] pelo parser.
    ...(mentionedUserIds.length > 0 ? { mentionedUserIds } : {}),
  };

  await set(messageRef, payload);
  return messageRef.key;
}

/** Listener em tempo real das últimas mensagens. Retorna a função que remove o listener. */
export function subscribeToMessages(
  conversationId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): RtdbUnsubscribe {
  const messagesQuery = rtdbQuery(ref(database, `messages/${conversationId}`), orderByChild('createdAt'), limitToLast(MESSAGE_WINDOW));
  return onValue(
    messagesQuery,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const message = parseMessage(child.key, child.val());
        if (message) messages.push(message);
      });
      onData(messages);
    },
    onError,
  );
}

export function subscribeToLastMessage(
  conversationId: string,
  onData: (message: ChatMessage | null) => void,
  onError: (error: Error) => void,
): RtdbUnsubscribe {
  const lastQuery = rtdbQuery(ref(database, `messages/${conversationId}`), orderByChild('createdAt'), limitToLast(1));
  return onValue(
    lastQuery,
    (snapshot) => {
      let last: ChatMessage | null = null;
      snapshot.forEach((child) => {
        last = parseMessage(child.key, child.val());
      });
      onData(last);
    },
    onError,
  );
}
