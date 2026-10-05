import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireUid } from '../middleware/authenticate.js';
import {
  acquireDispatchLock,
  completeDispatch,
  disableDevices,
  getActiveDevices,
  getConversation,
  getDisplayName,
  getMessage,
  isParticipant,
  releaseDispatchLock,
} from '../services/dataAccess.js';
import { sendPushes, type OutgoingPush } from '../services/notificationSender.js';
import { resolveRecipients } from '../services/recipientResolver.js';
import { HttpError } from '../utils/guards.js';

/** Ids seguros para caminhos do RTDB/Firestore (sem `/ . # $ [ ]`). */
export const firebaseId = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/, 'id inválido');

const bodySchema = z.object({ conversationId: firebaseId, messageId: firebaseId }).strict();

export const notificationsRouter = Router();

/**
 * POST /notifications/messages  { conversationId, messageId }
 * 1. token validado (middleware) → 2. mensagem existe e senderId === usuário → 3. participantes/política no Firestore
 * → 4. trava de idempotência → 5. destinatários calculados no servidor → 6. FCM / Expo Push → 7. tokens inválidos desativados.
 */
notificationsRouter.post('/messages', authenticate, async (req, res, next) => {
  try {
    const uid = requireUid(res);
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Requisição inválida: informe conversationId e messageId.');
    const { conversationId, messageId } = parsed.data;

    const message = await getMessage(conversationId, messageId);
    if (!message) throw new HttpError(404, 'Mensagem não encontrada.');
    if (message.senderId !== uid) throw new HttpError(403, 'Somente o autor pode solicitar a notificação da mensagem.');

    const conversation = await getConversation(conversationId);
    if (!conversation) throw new HttpError(404, 'Conversa não encontrada.');
    if (conversation.type !== message.conversationType) throw new HttpError(400, 'Tipo de conversa inconsistente.');
    if (!isParticipant(conversation, uid)) throw new HttpError(403, 'Você não participa desta conversa.');

    if (!(await acquireDispatchLock(conversationId, messageId, uid))) {
      res.status(200).json({ duplicate: true, sent: 0 });
      return;
    }

    try {
      const { recipientIds, mentionedIds } = resolveRecipients(conversation, message);
      const devices = recipientIds.length > 0 ? await getActiveDevices(recipientIds) : [];

      let sent = 0;
      let failed = 0;
      if (devices.length > 0) {
        const senderName = await getDisplayName(uid);
        const data = { conversationId, conversationType: conversation.type };
        // O conteúdo da mensagem NÃO vai no push: só quem enviou e onde (evita expor dados sensíveis na tela bloqueada).
        const pushes: OutgoingPush[] = devices.map((device) => ({
          device,
          content:
            conversation.type === 'direct'
              ? { title: senderName, body: 'Enviou uma nova mensagem.', data }
              : {
                  title: conversation.name,
                  body: mentionedIds.has(device.uid) ? `${senderName} mencionou você.` : `${senderName} enviou uma mensagem.`,
                  data,
                },
        }));
        const report = await sendPushes(pushes);
        sent = report.sent;
        failed = report.failed;
        await disableDevices(report.invalidDevices);
      }

      await completeDispatch(conversationId, messageId, { recipients: recipientIds.length, sent, failed });
      res.status(200).json({ duplicate: false, recipients: recipientIds.length, sent, failed });
    } catch (error) {
      // Falhou antes de concluir: libera a trava para que o app possa tentar de novo.
      await releaseDispatchLock(conversationId, messageId).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});
