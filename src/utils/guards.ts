/**
 * Narrowing de dados vindos do Firebase. `snapshot.val()` e `DocumentData` são não tipados,
 * então tudo entra como `unknown` e é validado aqui — nunca usamos `any` para "confiar" no banco.
 */
export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Aceita array ou o formato `{0: 'a', 1: 'b'}` que o Realtime Database pode devolver. */
export function asStringArray(value: unknown): string[] {
  const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return items.filter((item): item is string => typeof item === 'string');
}

export function isOneOf<const T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
