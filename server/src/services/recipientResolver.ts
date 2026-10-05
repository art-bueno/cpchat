import type { ConversationContext, StoredMessage } from '../types.js';

export type ResolvedRecipients = {
  recipientIds: string[];
  /** Destinatários mencionados/escolhidos — recebem um texto diferente ("mencionou você"). */
  mentionedIds: ReadonlySet<string>;
};

/**
 * Calcula NO SERVIDOR quem recebe o push, a partir da política da conversa e dos participantes atuais.
 * O app nunca informa destinatários. Regras gerais aplicadas a todas as políticas:
 *  - o remetente nunca é notificado;
 *  - apenas participantes ATUAIS podem ser notificados (ex.: removidos do grupo, menções a não-membros).
 */
export function resolveRecipients(conversation: ConversationContext, message: Pick<StoredMessage, 'senderId' | 'target' | 'mentionedUserIds'>): ResolvedRecipients {
  const empty: ResolvedRecipients = { recipientIds: [], mentionedIds: new Set() };

  if (conversation.type === 'direct') {
    if (conversation.policy === 'disabled') return empty;
    // Qualquer política diferente de `disabled` notifica o outro participante em conversas individuais.
    return { recipientIds: conversation.participantIds.filter((id) => id !== message.senderId), mentionedIds: new Set() };
  }

  const members = new Set(conversation.memberIds);
  const explicit = new Set(
    [...message.mentionedUserIds, ...(message.target.type === 'member' ? [message.target.memberId] : [])].filter(
      (id) => id !== message.senderId && members.has(id),
    ),
  );

  switch (conversation.policy) {
    case 'all_group_messages':
      return { recipientIds: conversation.memberIds.filter((id) => id !== message.senderId), mentionedIds: explicit };
    case 'mentioned_members':
      return { recipientIds: [...explicit], mentionedIds: explicit };
    case 'direct_messages_only':
    case 'disabled':
      return empty;
  }
}
