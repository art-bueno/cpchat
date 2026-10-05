import type { ChatGroup, GroupChanges } from '../types/group';
import { AppError } from './errors';

export const MIN_MEMBER_LIMIT = 2;
export const MAX_MEMBER_LIMIT = 50;
export const MAX_GROUP_NAME_LENGTH = 60;

export type ValidationResult = { valid: true } | { valid: false; message: string };

/** Converte o texto digitado em limite inteiro; `null` se não for um inteiro válido. */
export function parseMemberLimit(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function validateMemberLimit(limit: number | null, currentMemberCount: number): ValidationResult {
  if (limit === null || !Number.isInteger(limit)) return { valid: false, message: 'Informe um número inteiro.' };
  if (limit < MIN_MEMBER_LIMIT || limit > MAX_MEMBER_LIMIT) {
    return { valid: false, message: `O limite deve ficar entre ${MIN_MEMBER_LIMIT} e ${MAX_MEMBER_LIMIT}.` };
  }
  if (limit < currentMemberCount) {
    return { valid: false, message: `O grupo já tem ${currentMemberCount} integrantes; o limite não pode ser menor.` };
  }
  return { valid: true };
}

export function validateGroupName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { valid: false, message: 'Informe o nome do grupo.' };
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) return { valid: false, message: `Máximo de ${MAX_GROUP_NAME_LENGTH} caracteres.` };
  return { valid: true };
}

export function validateMemberCount(memberCount: number, limit: number): ValidationResult {
  if (memberCount < 2) return { valid: false, message: 'Selecione pelo menos um integrante além de você.' };
  if (memberCount > limit) return { valid: false, message: `O grupo comporta no máximo ${limit} integrantes.` };
  return { valid: true };
}

export function availableSlots(memberCount: number, memberLimit: number): number {
  return Math.max(0, memberLimit - memberCount);
}

/**
 * Aplica as alterações sobre o estado MAIS RECENTE do grupo (lido dentro da transação).
 * Membros são aplicados como delta para não sobrescrever inclusões/remoções feitas em paralelo.
 * Lança AppError se o resultado violar alguma regra — a transação é abortada sem gravar nada.
 */
export function applyGroupChanges(current: ChatGroup, changes: GroupChanges, actorUid: string, now: number): ChatGroup {
  if (current.ownerId !== actorUid) throw new AppError('not-owner', 'Somente o proprietário pode alterar o grupo.');

  const removeSet = new Set(changes.removeMemberIds ?? []);
  if (removeSet.has(current.ownerId)) throw new AppError('invalid-argument', 'O proprietário não pode ser removido.');

  const kept = current.memberIds.filter((id) => !removeSet.has(id));
  const additions = (changes.addMemberIds ?? []).filter((id) => !kept.includes(id));
  const memberIds = [...kept, ...new Set(additions)];

  const memberLimit = changes.memberLimit ?? current.memberLimit;
  const name = changes.name?.trim() ?? current.name;

  const checks = [validateGroupName(name), validateMemberLimit(memberLimit, memberIds.length), validateMemberCount(memberIds.length, memberLimit)];
  const failure = checks.find((check): check is Extract<ValidationResult, { valid: false }> => !check.valid);
  if (failure) {
    const code = memberIds.length > memberLimit && additions.length > 0 ? 'group-full' : 'invalid-argument';
    throw new AppError(code, code === 'group-full' ? 'Grupo sem vagas: o limite de integrantes foi atingido.' : failure.message);
  }

  return {
    ...current,
    name,
    memberIds,
    memberLimit,
    notificationPolicy: changes.notificationPolicy ?? current.notificationPolicy,
    updatedAt: now,
  };
}
