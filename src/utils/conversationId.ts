import { AppError } from './errors';

export const DIRECT_CONVERSATION_PREFIX = 'dm_';

/**
 * Id determinístico da conversa individual: `dm_<menorUid>_<maiorUid>`.
 * Garante uma única conversa por par e permite que as regras do RTDB/Firestore
 * verifiquem a participação só olhando para o id (uids do Firebase não têm `_`).
 */
export function sortedPair(uidA: string, uidB: string): [string, string] {
  return uidA < uidB ? [uidA, uidB] : [uidB, uidA];
}

export function buildDirectConversationId(uidA: string, uidB: string): string {
  if (uidA === uidB) throw new AppError('invalid-argument', 'Você não pode iniciar uma conversa consigo mesmo.');
  const [first, second] = sortedPair(uidA, uidB);
  return `${DIRECT_CONVERSATION_PREFIX}${first}_${second}`;
}

export function isDirectConversationId(conversationId: string): boolean {
  return conversationId.startsWith(DIRECT_CONVERSATION_PREFIX);
}

export function getDirectParticipants(conversationId: string): [string, string] | null {
  if (!isDirectConversationId(conversationId)) return null;
  const [first, second, ...rest] = conversationId.slice(DIRECT_CONVERSATION_PREFIX.length).split('_');
  return first && second && rest.length === 0 ? [first, second] : null;
}

export function getOtherParticipantId(conversationId: string, currentUid: string): string | null {
  const participants = getDirectParticipants(conversationId);
  if (!participants || !participants.includes(currentUid)) return null;
  return participants[0] === currentUid ? participants[1] : participants[0];
}
