import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { env } from '../config/env';
import type { DevicePlatform, DeviceRegistration, PushPayloadData, PushProvider } from '../types/notification';
import { AppError } from '../utils/errors';
import { isNonEmptyString, isOneOf, isRecord } from '../utils/guards';
import { firestore } from './firebase';

export type Subscription = { remove: () => void };

export const ANDROID_CHANNEL_ID = 'messages';
const DEVICE_ID_KEY = '@cpmobile/device-id';

/** Exibe banner/som também com o app em primeiro plano. */
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Mensagens',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export type PermissionResult = 'granted' | 'denied';

export async function requestPermission(): Promise<PermissionResult> {
  // O canal precisa existir antes do pedido de permissão no Android 13+.
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const requested = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  return requested.granted ? 'granted' : 'denied';
}

/** Id estável por instalação — permite ter vários aparelhos por usuário. */
async function getDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const created = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

function currentPlatform(): DevicePlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios') return Platform.OS;
  throw new AppError('invalid-argument', 'Notificações push só estão disponíveis em Android e iOS.');
}

export type PushToken = { token: string; provider: PushProvider };

/**
 * Android → token nativo do FCM (`getDevicePushTokenAsync`), enviado pela API com o Admin SDK.
 * iOS → Expo push token; a API usa o Expo Push Service, que entrega via APNs.
 */
export async function getPushToken(): Promise<PushToken> {
  if (!Device.isDevice) throw new AppError('invalid-argument', 'Notificações push exigem um dispositivo físico.');
  const platform = currentPlatform();

  if (platform === 'android') {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (typeof deviceToken.data !== 'string' || deviceToken.data.length === 0) {
      throw new AppError('invalid-argument', 'O dispositivo não forneceu um token de push.');
    }
    return { token: deviceToken.data, provider: 'fcm' };
  }

  if (!env.easProjectId) throw new AppError('invalid-argument', 'projectId do EAS não configurado (rode `eas init`).');
  const expoToken = await Notifications.getExpoPushTokenAsync({ projectId: env.easProjectId });
  return { token: expoToken.data, provider: 'expo' };
}

/** Grava/atualiza o token em `users/{uid}/devices/{deviceId}` — subcoleção legível só pelo dono. */
export async function saveDeviceToken(uid: string, pushToken: PushToken): Promise<void> {
  const deviceId = await getDeviceId();
  const registration: DeviceRegistration = {
    token: pushToken.token,
    provider: pushToken.provider,
    platform: currentPlatform(),
    enabled: true,
    updatedAt: Date.now(),
  };
  await setDoc(doc(firestore, 'users', uid, 'devices', deviceId), registration);
}

/** No logout o aparelho deixa de receber push do usuário que saiu. */
export async function unregisterDevice(uid: string): Promise<void> {
  const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (deviceId) await deleteDoc(doc(firestore, 'users', uid, 'devices', deviceId));
}

export function parsePushData(data: unknown): PushPayloadData | null {
  if (!isRecord(data) || !isNonEmptyString(data.conversationId)) return null;
  if (!isOneOf(data.conversationType, ['direct', 'group'] as const)) return null;
  return { conversationId: data.conversationId, conversationType: data.conversationType };
}

export function addTokenRefreshListener(onToken: (token: PushToken) => void): Subscription {
  return Notifications.addPushTokenListener((devicePushToken) => {
    // Só o token nativo (FCM) é rotacionado por este evento; o Expo token é renovado no próximo registro.
    if (Platform.OS === 'android' && typeof devicePushToken.data === 'string') {
      onToken({ token: devicePushToken.data, provider: 'fcm' });
    }
  });
}

export function addNotificationTapListener(onTap: (data: PushPayloadData, notificationId: string) => void): Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = parsePushData(response.notification.request.content.data);
    if (data) onTap(data, response.notification.request.identifier);
  });
}

/** Toque que abriu o app a partir do estado "fechado". */
export async function getLaunchNotification(): Promise<{ data: PushPayloadData; notificationId: string } | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  const data = parsePushData(response.notification.request.content.data);
  return data ? { data, notificationId: response.notification.request.identifier } : null;
}

export function clearLaunchNotification(): void {
  Notifications.clearLastNotificationResponse();
}
