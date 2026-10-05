import Constants from 'expo-constants';
import { isRecord, isNonEmptyString } from '../utils/guards';

function readEasProjectId(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  const eas: unknown = isRecord(extra) ? extra.eas : undefined;
  const projectId = isRecord(eas) ? eas.projectId : undefined;
  return isNonEmptyString(projectId) ? projectId : (Constants.easConfig?.projectId ?? null);
}

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

export const env = {
  /** URL pública (HTTPS) da API de notificações. Definida em `.env` → `EXPO_PUBLIC_API_URL`. */
  apiUrl: isNonEmptyString(rawApiUrl) ? rawApiUrl.replace(/\/+$/, '') : null,
  /** Necessário para gerar Expo push tokens (iOS). Preenchido por `eas init`. */
  easProjectId: readEasProjectId(),
} as const;
