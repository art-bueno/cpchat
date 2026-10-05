import { useEffect, useState } from 'react';
import { subscribeToGroup } from '../services/groupService';
import type { ChatGroup } from '../types/group';
import { getErrorMessage, isPermissionDenied } from '../utils/errors';

export type GroupState =
  | { status: 'loading' }
  | { status: 'ready'; group: ChatGroup }
  /** Grupo excluído, ou o usuário foi removido (as regras negam a leitura). */
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

/** Grupo em tempo real. O estado é "carimbado" com o id para nunca exibir dados de outro grupo. */
export function useGroup(groupId: string | undefined): GroupState {
  const [snapshot, setSnapshot] = useState<{ groupId: string; state: GroupState } | null>(null);

  useEffect(() => {
    if (!groupId) return undefined;
    return subscribeToGroup(
      groupId,
      (group) => setSnapshot({ groupId, state: group ? { status: 'ready', group } : { status: 'unavailable' } }),
      (error) =>
        setSnapshot({
          groupId,
          state: isPermissionDenied(error) ? { status: 'unavailable' } : { status: 'error', message: getErrorMessage(error) },
        }),
    );
  }, [groupId]);

  if (!groupId) return { status: 'unavailable' };
  return snapshot?.groupId === groupId ? snapshot.state : { status: 'loading' };
}
