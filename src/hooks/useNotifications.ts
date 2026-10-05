import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { openConversationFromPush } from '../navigation/navigationRef';
import {
  addNotificationTapListener,
  addTokenRefreshListener,
  clearLaunchNotification,
  getLaunchNotification,
  getPushToken,
  requestPermission,
  saveDeviceToken,
} from '../services/notificationService';
import type { NotificationRegistrationStatus } from '../types/notification';
import { AppError, getErrorMessage } from '../utils/errors';

/** Permissão → token → Firestore. Retorna o status final em vez de alterar estado diretamente. */
async function registerDevice(uid: string): Promise<NotificationRegistrationStatus> {
  try {
    if ((await requestPermission()) === 'denied') return { state: 'denied' };
    const token = await getPushToken();
    await saveDeviceToken(uid, token);
    return { state: 'registered', provider: token.provider };
  } catch (error) {
    return error instanceof AppError && error.code === 'invalid-argument'
      ? { state: 'unavailable', reason: error.message }
      : { state: 'error', message: getErrorMessage(error, 'Não foi possível registrar o aparelho para notificações.') };
  }
}

/**
 * Registra o aparelho para push, mantém o token atualizado
 * e trata o toque na notificação, abrindo a conversa correspondente.
 */
export function useNotifications(uid: string) {
  const [status, setStatus] = useState<NotificationRegistrationStatus>({ state: 'registering' });
  const [attempt, setAttempt] = useState(0);
  const handledIds = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    void registerDevice(uid).then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, [uid, attempt]);

  const retry = useCallback(() => {
    setStatus({ state: 'registering' });
    setAttempt((n) => n + 1);
  }, []);

  // Se o usuário liberar a permissão nas configurações e voltar ao app, tentamos de novo.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status.state === 'denied') retry();
    });
    return () => subscription.remove();
  }, [retry, status.state]);

  useEffect(() => {
    const subscription = addTokenRefreshListener((token) => {
      saveDeviceToken(uid, token).catch((error: unknown) => setStatus({ state: 'error', message: getErrorMessage(error) }));
    });
    return () => subscription.remove();
  }, [uid]);

  useEffect(() => {
    const handle = (data: Parameters<typeof openConversationFromPush>[0], notificationId: string) => {
      if (handledIds.current.has(notificationId)) return;
      handledIds.current.add(notificationId);
      openConversationFromPush(data);
    };

    // App aberto a partir do toque com ele fechado.
    getLaunchNotification()
      .then((launch) => {
        if (!launch) return;
        handle(launch.data, launch.notificationId);
        clearLaunchNotification();
      })
      .catch(() => undefined);

    // Toque com o app em segundo plano/primeiro plano.
    const subscription = addNotificationTapListener(handle);
    return () => subscription.remove();
  }, []);

  return { status, retry };
}
