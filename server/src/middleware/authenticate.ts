import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../services/firebaseAdmin.js';

declare global {
  namespace Express {
    interface Locals {
      /** uid do usuário autenticado (definido por `authenticate`). */
      uid?: string;
    }
  }
}

/**
 * Valida o Firebase ID token do header `Authorization: Bearer <token>` com o Admin SDK.
 * `checkRevoked` rejeita tokens de sessões encerradas/revogadas.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) {
    res.status(401).json({ message: 'Token de autenticação ausente.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(match[1], true);
    res.locals.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }
}

export function requireUid(res: Response): string {
  const { uid } = res.locals;
  if (!uid) throw new Error('authenticate() não foi aplicado a esta rota.');
  return uid;
}
