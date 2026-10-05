import { Router } from 'express';
import { authenticate, requireUid } from '../middleware/authenticate.js';
import { firestore } from '../services/firebaseAdmin.js';
import { HttpError, isNonEmptyString, isRecord } from '../utils/guards.js';
import { firebaseId } from './notifications.js';

export const usersRouter = Router();

function directId(a: string, b: string): string {
  return a < b ? `dm_${a}_${b}` : `dm_${b}_${a}`;
}

/** Há conversa individual OU grupo em comum? (Consulta que as regras do Firestore não conseguem expressar.) */
async function sharesConversation(requesterUid: string, targetUid: string): Promise<boolean> {
  const direct = await firestore.collection('directConversations').doc(directId(requesterUid, targetUid)).get();
  if (direct.exists) return true;
  const groups = await firestore.collection('groups').where('memberIds', 'array-contains', requesterUid).select('memberIds').get();
  return groups.docs.some((doc) => {
    const members: unknown = doc.get('memberIds');
    return Array.isArray(members) && members.includes(targetUid);
  });
}

const optional = (value: unknown): string | null => (isNonEmptyString(value) ? value : null);

/** GET /users/:uid/profile — dados cadastrais somente para quem compartilha conversa ou grupo. */
usersRouter.get('/:uid/profile', authenticate, async (req, res, next) => {
  try {
    const requesterUid = requireUid(res);
    const parsed = firebaseId.safeParse(req.params.uid);
    if (!parsed.success) throw new HttpError(400, 'Usuário inválido.');
    const targetUid = parsed.data;

    if (targetUid !== requesterUid && !(await sharesConversation(requesterUid, targetUid))) {
      throw new HttpError(403, 'Perfil disponível apenas para contatos de conversas ou grupos em comum.');
    }

    const snapshot = await firestore.collection('users').doc(targetUid).get();
    const data: unknown = snapshot.data();
    if (!isRecord(data)) throw new HttpError(404, 'Usuário não encontrado.');

    res.status(200).json({
      uid: targetUid,
      name: optional(data.name),
      email: optional(data.email),
      phoneNumber: optional(data.phoneNumber),
      birthDate: optional(data.birthDate),
      photoUrl: optional(data.photoUrl),
    });
  } catch (error) {
    next(error);
  }
});
