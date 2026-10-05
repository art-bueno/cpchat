import type { Message } from 'firebase-admin/messaging';
import { config } from '../config.js';
import type { DeviceTarget, PushContent } from '../types.js';
import { isRecord } from '../utils/guards.js';
import { messaging } from './firebaseAdmin.js';

export type SendReport = { sent: number; failed: number; invalidDevices: DeviceTarget[] };

export type OutgoingPush = { device: DeviceTarget; content: PushContent };

const FCM_INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const FCM_BATCH = 500;
const EXPO_BATCH = 100;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Android: envio direto pelo Firebase Cloud Messaging (Admin SDK, credencial só no servidor). */
async function sendViaFcm(pushes: readonly OutgoingPush[]): Promise<SendReport> {
  const report: SendReport = { sent: 0, failed: 0, invalidDevices: [] };
  for (const batch of chunk(pushes, FCM_BATCH)) {
    const messages: Message[] = batch.map(({ device, content }) => ({
      token: device.token,
      notification: { title: content.title, body: content.body },
      // `data` precisa ser Record<string, string>; o app usa estes campos para abrir a conversa.
      data: { conversationId: content.data.conversationId, conversationType: content.data.conversationType },
      android: {
        priority: 'high',
        notification: { channelId: config.androidChannelId, sound: 'default', tag: content.data.conversationId },
      },
    }));
    const response = await messaging.sendEach(messages);
    response.responses.forEach((result, index) => {
      const push = batch[index];
      if (!push) return;
      if (result.success) {
        report.sent += 1;
        return;
      }
      report.failed += 1;
      if (result.error && FCM_INVALID_TOKEN_CODES.has(result.error.code)) report.invalidDevices.push(push.device);
    });
  }
  return report;
}

/** iOS: Expo Push Service (que entrega via APNs). Resposta tratada como `unknown` e validada. */
async function sendViaExpo(pushes: readonly OutgoingPush[]): Promise<SendReport> {
  const report: SendReport = { sent: 0, failed: 0, invalidDevices: [] };
  for (const batch of chunk(pushes, EXPO_BATCH)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(config.expoAccessToken ? { Authorization: `Bearer ${config.expoAccessToken}` } : {}),
      },
      body: JSON.stringify(
        batch.map(({ device, content }) => ({
          to: device.token,
          title: content.title,
          body: content.body,
          data: content.data,
          sound: 'default',
          channelId: config.androidChannelId,
          priority: 'high',
        })),
      ),
    });

    const payload: unknown = await response.json().catch(() => null);
    const tickets = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
    if (!response.ok || tickets.length !== batch.length) {
      report.failed += batch.length;
      continue;
    }
    tickets.forEach((ticket: unknown, index) => {
      const push = batch[index];
      if (!push) return;
      if (isRecord(ticket) && ticket.status === 'ok') {
        report.sent += 1;
        return;
      }
      report.failed += 1;
      const details = isRecord(ticket) ? ticket.details : undefined;
      if (isRecord(details) && details.error === 'DeviceNotRegistered') report.invalidDevices.push(push.device);
    });
  }
  return report;
}

export async function sendPushes(pushes: readonly OutgoingPush[]): Promise<SendReport> {
  const [fcm, expo] = await Promise.all([
    sendViaFcm(pushes.filter((p) => p.device.provider === 'fcm')),
    sendViaExpo(pushes.filter((p) => p.device.provider === 'expo')),
  ]);
  return {
    sent: fcm.sent + expo.sent,
    failed: fcm.failed + expo.failed,
    invalidDevices: [...fcm.invalidDevices, ...expo.invalidDevices],
  };
}
