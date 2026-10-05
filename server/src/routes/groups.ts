import { Router } from 'express';
import { authenticate, requireUid } from '../middleware/authenticate.js';
import { getConversation, getMirroredMembers, isDirectConversationId, syncGroupMembersMirror } from '../services/dataAccess.js';
import { HttpError } from '../utils/guards.js';
import { firebaseId } from './notifications.js';

export const groupsRouter = Router();

/**
 * POST /groups/:groupId/sync-members
 * Copia `groups/{id}.memberIds` (Firestore) para `groupMembers/{id}` (RTDB). Idempotente: sempre usa o estado
 * atual do Firestore, nunca dados enviados pelo app. Pode ser chamada por integrantes atuais ou por quem
 * estava no espelho (ex.: removido), para que a remoção do acesso seja aplicada.
 */
groupsRouter.post('/:groupId/sync-members', authenticate, async (req, res, next) => {
  try {
    const uid = requireUid(res);
    const parsedId = firebaseId.safeParse(req.params.groupId);
    if (!parsedId.success || isDirectConversationId(parsedId.data)) throw new HttpError(400, 'Grupo inválido.');
    const groupId = parsedId.data;

    const [group, mirrored] = await Promise.all([getConversation(groupId), getMirroredMembers(groupId)]);
    const currentMembers = group?.type === 'group' ? group.memberIds : null;

    const allowed = (currentMembers?.includes(uid) ?? false) || mirrored.includes(uid);
    if (!allowed) throw new HttpError(403, 'Você não participa deste grupo.');

    await syncGroupMembersMirror(groupId, currentMembers);
    res.status(200).json({ groupId, members: currentMembers?.length ?? 0 });
  } catch (error) {
    next(error);
  }
});
