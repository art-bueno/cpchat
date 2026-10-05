import type { PublicUser } from '../types/user';

/** Token `@algo` sendo digitado no final do texto, ou `null`. */
export function getActiveMentionQuery(text: string): string | null {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(text);
  return match ? (match[1] ?? '') : null;
}

/** Substitui o `@parcial` no final do texto pelo nome completo do integrante. */
export function insertMention(text: string, user: PublicUser): string {
  return text.replace(/@([^\s@]*)$/, `@${user.name} `);
}

/** Mantém apenas as menções cujo `@Nome` ainda está presente no texto final. */
export function resolveMentionedUserIds(text: string, candidates: readonly PublicUser[]): string[] {
  return candidates.filter((user) => text.includes(`@${user.name}`)).map((user) => user.uid);
}
