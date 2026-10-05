import type { User } from 'firebase/auth';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import { unregisterDevice } from '../services/notificationService';
import { subscribeToOwnProfile } from '../services/userService';
import type { ChatUser, LoginInput, RegisterInput } from '../types/user';
import { getErrorMessage } from '../utils/errors';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Autenticado, aguardando o perfil do Firestore (ex.: logo após o cadastro). */
  | { status: 'loadingProfile'; user: User }
  | { status: 'profileMissing'; user: User; error: string | null }
  | { status: 'signedIn'; user: User; profile: ChatUser };

export type AuthContextValue = {
  state: AuthState;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<authService.RegisterResult>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Tempo para o perfil aparecer após o login antes de considerá-lo ausente. */
const PROFILE_GRACE_MS = 20_000;

type ProfileSnapshot = {
  uid: string;
  /** `undefined` = ainda não chegou o primeiro snapshot. */
  profile: ChatUser | null | undefined;
  error: string | null;
  graceExpired: boolean;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);

  // Recupera a sessão persistida e acompanha login/logout.
  useEffect(() => authService.observeAuthState(setUser), []);

  // Perfil em tempo real; o listener é removido automaticamente ao trocar de usuário ou sair.
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return undefined;
    const update = (patch: Partial<ProfileSnapshot>) =>
      setSnapshot((prev) => ({ ...(prev?.uid === uid ? prev : { uid, profile: undefined, error: null, graceExpired: false }), ...patch }));

    const timer = setTimeout(() => update({ graceExpired: true }), PROFILE_GRACE_MS);
    const unsubscribe = subscribeToOwnProfile(
      uid,
      (profile) => update({ profile, error: null }),
      (error) => update({ error: getErrorMessage(error) }),
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [uid]);

  const state = useMemo<AuthState>(() => {
    if (user === undefined) return { status: 'loading' };
    if (user === null) return { status: 'signedOut' };
    // Snapshot de outro usuário (troca de conta) é ignorado: equivale a "carregando".
    const current = snapshot?.uid === user.uid ? snapshot : null;
    if (current?.profile) return { status: 'signedIn', user, profile: current.profile };
    if (current?.error || (current?.profile === null && current.graceExpired)) {
      return { status: 'profileMissing', user, error: current.error };
    }
    return { status: 'loadingProfile', user };
  }, [user, snapshot]);

  const login = useCallback(async (input: LoginInput) => {
    await authService.login(input);
  }, []);

  const register = useCallback((input: RegisterInput) => authService.register(input), []);

  const logout = useCallback(async () => {
    const uid = user?.uid;
    // Remove o token do aparelho ANTES de sair (depois disso as regras negariam a escrita).
    if (uid) await unregisterDevice(uid).catch(() => undefined);
    await authService.logout();
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({ state, login, register, logout }), [state, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
