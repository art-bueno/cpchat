import { useEffect, useMemo, useState } from 'react';
import { subscribeToDirectConversations, subscribeToLastMessage } from '../services/chatService';
import { subscribeToUserGroups } from '../services/groupService';
import type { ChatMessage, ConversationListItem, DirectConversation } from '../types/chat';
import type { ChatGroup } from '../types/group';
import { getErrorMessage } from '../utils/errors';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

type Source<T> = { data: T[]; loaded: boolean; error: string | null };
const initialSource = <T,>(): Source<T> => ({ data: [], loaded: false, error: null });

/** Última mensagem de cada conversa (RTDB, `limitToLast(1)`), para prévia e ordenação. */
export function useLastMessages(conversationIds: readonly string[]): ReadonlyMap<string, ChatMessage> {
  const [lastMessages, setLastMessages] = useState<ReadonlyMap<string, ChatMessage>>(new Map());
  const key = useMemo(() => [...conversationIds].sort().join(','), [conversationIds]);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    const cleanups = new Map<string, () => void>();

    const listen = (id: string, attempt: number) => {
      const unsubscribe = subscribeToLastMessage(
        id,
        (message) =>
          setLastMessages((prev) => {
            const next = new Map(prev);
            if (message) next.set(id, message);
            else next.delete(id);
            return next;
          }),
        () => {
          // Grupo recém-criado: o espelho de integrantes no RTDB pode chegar alguns segundos depois.
          if (attempt >= MAX_RETRIES) return;
          const timer = setTimeout(() => listen(id, attempt + 1), RETRY_DELAY_MS * (attempt + 1));
          cleanups.set(id, () => clearTimeout(timer));
        },
      );
      cleanups.set(id, unsubscribe);
    };

    ids.forEach((id) => listen(id, 0));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [key]);

  return lastMessages;
}

/** Conversas individuais + grupos do usuário, atualizadas em tempo real e ordenadas pela atividade. */
export function useConversations(uid: string) {
  const [groups, setGroups] = useState<Source<ChatGroup>>(initialSource);
  const [directs, setDirects] = useState<Source<DirectConversation>>(initialSource);

  useEffect(
    () =>
      subscribeToUserGroups(
        uid,
        (data) => setGroups({ data, loaded: true, error: null }),
        (error) => setGroups((prev) => ({ ...prev, loaded: true, error: getErrorMessage(error) })),
      ),
    [uid],
  );

  useEffect(
    () =>
      subscribeToDirectConversations(
        uid,
        (data) => setDirects({ data, loaded: true, error: null }),
        (error) => setDirects((prev) => ({ ...prev, loaded: true, error: getErrorMessage(error) })),
      ),
    [uid],
  );

  const conversationIds = useMemo(
    () => [...groups.data.map((g) => g.id), ...directs.data.map((d) => d.id)],
    [groups.data, directs.data],
  );
  const lastMessages = useLastMessages(conversationIds);

  const items = useMemo<ConversationListItem[]>(() => {
    const groupItems = groups.data.map<ConversationListItem>((group) => ({
      kind: 'group',
      id: group.id,
      group,
      sortKey: lastMessages.get(group.id)?.createdAt ?? group.updatedAt,
    }));
    const directItems = directs.data.map<ConversationListItem>((conversation) => ({
      kind: 'direct',
      id: conversation.id,
      conversation,
      otherUserId: conversation.participantIds[0] === uid ? conversation.participantIds[1] : conversation.participantIds[0],
      sortKey: lastMessages.get(conversation.id)?.createdAt ?? conversation.updatedAt,
    }));
    // Ordena uma cópia nova — os arrays de estado nunca são mutados.
    return [...groupItems, ...directItems].sort((a, b) => b.sortKey - a.sortKey);
  }, [groups.data, directs.data, lastMessages, uid]);

  return {
    items,
    lastMessages,
    loading: !groups.loaded || !directs.loaded,
    error: groups.error ?? directs.error,
  };
}
