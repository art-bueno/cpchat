import { FirebaseError } from 'firebase/app';

export type AppErrorCode =
  | 'invalid-argument'
  | 'group-full'
  | 'not-owner'
  | 'not-member'
  | 'unauthenticated'
  | 'session-expired'
  | 'network'
  | 'api-unavailable'
  | 'api-error'
  | 'not-found'
  | 'upload-failed'
  | 'permission-denied';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

const PERMISSION_DENIED_MESSAGE = 'Você não tem permissão para realizar esta ação.';

const FIREBASE_MESSAGES: Partial<Record<string, string>> = {
  // Auth
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/user-token-expired': 'Sua sessão expirou. Entre novamente.',
  'auth/requires-recent-login': 'Sua sessão expirou. Entre novamente.',
  // Firestore
  'permission-denied': PERMISSION_DENIED_MESSAGE,
  unavailable: 'Serviço indisponível. Verifique sua conexão.',
  unauthenticated: 'Sua sessão expirou. Entre novamente.',
  'not-found': 'Registro não encontrado.',
  'failed-precondition': 'Operação não permitida no estado atual.',
  aborted: 'Conflito com outra alteração simultânea. Tente novamente.',
  'resource-exhausted': 'Limite de uso atingido. Tente mais tarde.',
  'deadline-exceeded': 'A operação demorou demais. Verifique sua conexão.',
  // Storage
  'storage/unauthorized': 'Sem permissão para enviar a imagem.',
  'storage/canceled': 'Envio da imagem cancelado.',
  'storage/retry-limit-exceeded': 'Falha de conexão ao enviar a imagem.',
  'storage/quota-exceeded': 'Cota de armazenamento excedida.',
};

/** Converte qualquer erro em uma mensagem compreensível, sem expor detalhes internos. */
export function getErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof FirebaseError) {
    return FIREBASE_MESSAGES[error.code] ?? FIREBASE_MESSAGES[error.code.replace(/^firestore\//, '')] ?? fallback;
  }
  if (error instanceof Error) {
    // Realtime Database rejeita com "PERMISSION_DENIED: ..." (sem FirebaseError).
    if (/permission[_ ]denied/i.test(error.message)) return PERMISSION_DENIED_MESSAGE;
    if (/network|offline|failed to fetch/i.test(error.message)) return 'Sem conexão com a internet.';
  }
  return fallback;
}

export function isPermissionDenied(error: unknown): boolean {
  if (error instanceof FirebaseError) return error.code === 'permission-denied' || error.code === 'storage/unauthorized';
  return error instanceof Error && /permission[_ ]denied/i.test(error.message);
}

export function isSessionError(error: unknown): boolean {
  if (error instanceof AppError) return error.code === 'session-expired' || error.code === 'unauthenticated';
  return error instanceof FirebaseError && ['auth/user-token-expired', 'auth/requires-recent-login', 'unauthenticated'].includes(error.code);
}
