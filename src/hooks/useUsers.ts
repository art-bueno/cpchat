import { useEffect, useMemo, useState } from 'react';
import { subscribeToDirectoryEntries, subscribeToUserDirectory } from '../services/userService';
import type { UserDirectoryEntry } from '../types/user';
import { getErrorMessage } from '../utils/errors';

type DirectoryState = { users: UserDirectoryEntry[]; loading: boolean; error: string | null };

/** Lista de usuários cadastrados, com busca por nome. */
export function useUserDirectory(searchText: string, excludeUid: string) {
  const [state, setState] = useState<DirectoryState>({ users: [], loading: true, error: null });

  useEffect(
    () =>
      subscribeToUserDirectory(
        (users) => setState({ users, loading: false, error: null }),
        (error) => setState((prev) => ({ ...prev, loading: false, error: getErrorMessage(error) })),
      ),
    [],
  );

  const filtered = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return state.users.filter((user) => user.uid !== excludeUid && (term.length === 0 || user.nameLower.includes(term)));
  }, [state.users, searchText, excludeUid]);

  return { users: filtered, loading: state.loading, error: state.error };
}

/** Mapa `uid → entrada pública` para um conjunto de usuários (nomes/fotos em chats e grupos). */
export function useDirectoryEntries(uids: readonly string[]) {
  const [entries, setEntries] = useState<Map<string, UserDirectoryEntry>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Chave estável: só reassina quando o CONJUNTO de uids muda, não a cada render.
  const key = useMemo(() => [...new Set(uids)].sort().join(','), [uids]);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    return subscribeToDirectoryEntries(
      ids,
      (next) => {
        setEntries(next);
        setError(null);
      },
      (err) => setError(getErrorMessage(err)),
    );
  }, [key]);

  return { entries, error };
}
