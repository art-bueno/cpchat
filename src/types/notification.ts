export const NOTIFICATION_POLICIES = [
  'all_group_messages',
  'mentioned_members',
  'direct_messages_only',
  'disabled',
] as const;

export type NotificationPolicy = (typeof NOTIFICATION_POLICIES)[number];

/** Políticas aplicáveis a conversas individuais: notificar o outro participante ou não. */
export const DIRECT_NOTIFICATION_POLICIES = ['direct_messages_only', 'disabled'] as const satisfies readonly NotificationPolicy[];
export type DirectNotificationPolicy = (typeof DIRECT_NOTIFICATION_POLICIES)[number];

export type NotificationSettings = {
  conversationId: string;
  policy: NotificationPolicy;
  updatedBy: string;
  updatedAt: number;
};

export type DevicePlatform = 'android' | 'ios';

/** `fcm`: token nativo do FCM (Android). `expo`: Expo push token (iOS → APNs via Expo Push Service). */
export type PushProvider = 'fcm' | 'expo';

/** Firestore `users/{uid}/devices/{deviceId}` */
export type DeviceRegistration = {
  token: string;
  provider: PushProvider;
  platform: DevicePlatform;
  enabled: boolean;
  updatedAt: number;
};

/** Dados obrigatórios no payload do push. */
export type PushPayloadData = {
  conversationId: string;
  conversationType: 'direct' | 'group';
};

export type NotificationRegistrationStatus =
  | { state: 'idle' }
  | { state: 'registering' }
  | { state: 'registered'; provider: PushProvider }
  | { state: 'denied' }
  | { state: 'unavailable'; reason: string }
  | { state: 'error'; message: string };

export const POLICY_LABELS: Record<NotificationPolicy, { title: string; description: string }> = {
  all_group_messages: {
    title: 'Todas as mensagens',
    description: 'Todos os integrantes (exceto o remetente) recebem push.',
  },
  mentioned_members: {
    title: 'Somente mencionados',
    description: 'Só quem for mencionado (@) ou escolhido como destinatário recebe push.',
  },
  direct_messages_only: {
    title: 'Somente conversas individuais',
    description: 'Mensagens deste grupo não geram push.',
  },
  disabled: {
    title: 'Desativadas',
    description: 'Nenhuma mensagem desta conversa gera push.',
  },
};
