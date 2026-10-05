import { env } from '../config/env';
import type { UserProfileView } from '../types/user';
import { AppError } from '../utils/errors';
import { isRecord } from '../utils/guards';
import { auth } from './firebase';
import { parseProfileView } from './parsers';

/** Render (plano free) pode levar ~50s para "acordar"; damos margem antes de desistir. */
const REQUEST_TIMEOUT_MS = 60_000;

type HttpMethod = 'GET' | 'POST';

async function request<T>(method: HttpMethod, path: string, parse: (body: unknown) => T | null, body?: object): Promise<T> {
  if (!env.apiUrl) throw new AppError('api-unavailable', 'URL da API não configurada (EXPO_PUBLIC_API_URL).');
  const user = auth.currentUser;
  if (!user) throw new AppError('unauthenticated', 'Sua sessão expirou. Entre novamente.');

  // O app nunca envia credenciais administrativas: só o ID token do usuário, validado pela API com o Admin SDK.
  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new AppError('network', 'Não foi possível contatar o servidor. Verifique sua conexão.');
  } finally {
    clearTimeout(timeout);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 401) throw new AppError('session-expired', 'Sua sessão expirou. Entre novamente.');
  if (response.status === 403) throw new AppError('permission-denied', 'Você não tem permissão para acessar este recurso.');
  if (response.status === 404) throw new AppError('not-found', 'Registro não encontrado.');
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === 'string' ? payload.message : 'Erro no servidor.';
    throw new AppError('api-error', message);
  }

  const parsed = parse(payload);
  if (parsed === null) throw new AppError('api-error', 'Resposta inesperada do servidor.');
  return parsed;
}

type NotifyResult = { sent: number; duplicate: boolean };

function parseNotifyResult(body: unknown): NotifyResult | null {
  if (!isRecord(body)) return null;
  return { sent: typeof body.sent === 'number' ? body.sent : 0, duplicate: body.duplicate === true };
}

/** Pede à API que calcule os destinatários e dispare o push. O app NÃO envia lista de destinatários. */
export function requestMessageNotification(conversationId: string, messageId: string): Promise<NotifyResult> {
  return request('POST', '/notifications/messages', parseNotifyResult, { conversationId, messageId });
}

/** Espelha `groups/{id}.memberIds` (Firestore, fonte da verdade) em `groupMembers/{id}` (RTDB, usado pelas regras). */
export function syncGroupMembers(groupId: string): Promise<true> {
  return request('POST', `/groups/${encodeURIComponent(groupId)}/sync-members`, () => true);
}

export type UploadTarget = { target: 'profile' } | { target: 'group'; groupId: string };

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  signature: string;
  /** Parâmetros assinados — devem ser enviados exatamente como recebidos. */
  params: Record<string, string>;
};

function parseUploadSignature(body: unknown): UploadSignature | null {
  if (!isRecord(body) || !isRecord(body.params)) return null;
  const { cloudName, apiKey, signature } = body;
  if (typeof cloudName !== 'string' || typeof apiKey !== 'string' || typeof signature !== 'string') return null;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.params)) {
    if (typeof value !== 'string') return null;
    params[key] = value;
  }
  return { cloudName, apiKey, signature, params };
}

/** A API confere permissão (própria foto / dono do grupo) e assina o upload. O segredo do Cloudinary fica no servidor. */
export function requestUploadSignature(target: UploadTarget): Promise<UploadSignature> {
  return request('POST', '/uploads/signature', parseUploadSignature, target);
}

/** Perfil completo de outro usuário — a API só devolve se houver conversa ou grupo em comum. */
export function fetchUserProfile(uid: string): Promise<UserProfileView> {
  return request('GET', `/users/${encodeURIComponent(uid)}/profile`, parseProfileView);
}
