import { createContext, useContext, type ReactNode } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import type { NotificationRegistrationStatus } from '../types/notification';

type NotificationContextValue = { status: NotificationRegistrationStatus; retry: () => void };

const NotificationContext = createContext<NotificationContextValue | null>(null);

/** Montado apenas na área autenticada: registra o aparelho do usuário logado e trata toques em push. */
export function NotificationProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const value = useNotifications(uid);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationStatus(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotificationStatus deve ser usado dentro de <NotificationProvider>.');
  return context;
}
