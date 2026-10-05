import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../contexts/AuthContext';
import type { ChatUser } from '../types/user';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return context;
}

/** Para telas autenticadas: garante (em tipo) que há um perfil carregado. */
export function useCurrentUser(): ChatUser {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('useCurrentUser exige usuário autenticado.');
  return state.profile;
}
