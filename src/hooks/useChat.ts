import { useCallback, useEffect, useState } from 'react';
import { requestMessageNotification, syncGroupMembers } from '../services/apiClient';
import { sendMessage, subscribeToMessages } from '../services/chatService';
import type { ChatMessage, ConversationType, FailedMessage, OutgoingMessage } from '../types/chat';
import { getErrorMessage, isPermissionDenied } from '../utils/errors';

export type MessagesState =
  | { status: 'loading' }
  | { status: 'ready'; messages: ChatMessage[] }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

type UseChatParams = {
  conversationId: string;
  conversationType: ConversationType;
  currentUid: string;
  /** Falso quando o usuário não participa mais (ex.: removido do grupo) — o listener é encerrado. */
  enabled: boolean;
};

/** Estado local da conversa aberta; carimbado com o id para "zerar" sozinho ao trocar de conversa. */
type Session = {
  conversationId: string;
  failed: FailedMessage[];
  pushWarning: string | null;
  /** Quantas vezes já pedimos à API para sincronizar o acesso ao grupo. */
  syncAttempts: number;
};

const freshSession = (conversationId: string): Session => ({ conversationId, failed: [], pushWarning: null, syncAttempts: 0 });

/**
 * Mensagens em tempo real de uma conversa + envio com feedback de falha.
 * O listener do RTDB é removido ao desmontar a tela, trocar de conversa ou perder acesso.
 */
export function useChat({ conversationId, conversationType, currentUid, enabled }: UseChatParams) {
  const [messages, setMessages] = useState<{ conversationId: string; state: MessagesState } | null>(null);
  const [storedSession, setSession] = useState<Session>(() => freshSession(conversationId));
  const [sending, setSending] = useState(false);

  const session = storedSession.conversationId === conversationId ? storedSession : freshSession(conversationId);
  const { syncAttempts } = session;

  const updateSession = useCallback(
    (update: (current: Session) => Session) =>
      setSession((prev) => update(prev.conversationId === conversationId ? prev : freshSession(conversationId))),
    [conversationId],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const publish = (state: MessagesState) => {
      if (!cancelled) setMessages({ conversationId, state });
    };

    const unsubscribe = subscribeToMessages(
      conversationId,
      (list) => publish({ status: 'ready', messages: list }),
      (error) => {
        // Em grupos, a leitura depende do espelho `groupMembers` no RTDB. Se ele ainda não existe
        // (grupo recém-criado / sync falhou), pedimos à API para sincronizar e reassinamos uma vez.
        if (conversationType === 'group' && isPermissionDenied(error) && syncAttempts === 0) {
          syncGroupMembers(conversationId)
            .then(() => !cancelled && updateSession((s) => ({ ...s, syncAttempts: s.syncAttempts + 1 })))
            .catch(() => publish({ status: 'forbidden' }));
          return;
        }
        publish(isPermissionDenied(error) ? { status: 'forbidden' } : { status: 'error', message: getErrorMessage(error) });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [conversationId, conversationType, enabled, syncAttempts, updateSession]);

  const state: MessagesState = !enabled
    ? { status: 'forbidden' }
    : messages?.conversationId === conversationId
      ? messages.state
      : { status: 'loading' };

  const notify = useCallback(
    async (messageId: string) => {
      try {
        await requestMessageNotification(conversationId, messageId);
        updateSession((s) => ({ ...s, pushWarning: null }));
      } catch (error) {
        // A mensagem já está salva; só a notificação falhou. Não marcamos a mensagem como falha.
        updateSession((s) => ({ ...s, pushWarning: `Mensagem enviada, mas a notificação não foi disparada: ${getErrorMessage(error)}` }));
      }
    },
    [conversationId, updateSession],
  );

  const send = useCallback(
    async (message: OutgoingMessage): Promise<boolean> => {
      setSending(true);
      try {
        const messageId = await sendMessage({ ...message, conversationId, conversationType, senderId: currentUid });
        // Push só é solicitado DEPOIS que a mensagem foi persistida.
        void notify(messageId);
        return true;
      } catch (error) {
        const failure: FailedMessage = {
          ...message,
          localId: `failed-${Date.now()}`,
          error: getErrorMessage(error, 'Não foi possível enviar a mensagem.'),
          failedAt: Date.now(),
        };
        updateSession((s) => ({ ...s, failed: [...s.failed, failure] }));
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, conversationType, currentUid, notify, updateSession],
  );

  const retry = useCallback(
    async (localId: string) => {
      const target = session.failed.find((item) => item.localId === localId);
      if (!target) return;
      updateSession((s) => ({ ...s, failed: s.failed.filter((item) => item.localId !== localId) }));
      await send({ text: target.text, target: target.target, mentionedUserIds: target.mentionedUserIds });
    },
    [session.failed, send, updateSession],
  );

  const discard = useCallback(
    (localId: string) => updateSession((s) => ({ ...s, failed: s.failed.filter((item) => item.localId !== localId) })),
    [updateSession],
  );

  const dismissPushWarning = useCallback(() => updateSession((s) => ({ ...s, pushWarning: null })), [updateSession]);

  return { state, failed: session.failed, sending, pushWarning: session.pushWarning, send, retry, discard, dismissPushWarning };
}
