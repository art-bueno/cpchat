import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { authenticate, requireUid } from '../middleware/authenticate.js';
import { signCloudinaryParams } from '../services/cloudinarySignature.js';
import { firestore } from '../services/firebaseAdmin.js';
import { HttpError } from '../utils/guards.js';
import { firebaseId } from './notifications.js';

export const uploadsRouter = Router();

const bodySchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('profile') }).strict(),
  z.object({ target: z.literal('group'), groupId: firebaseId }).strict(),
]);

/**
 * POST /uploads/signature  { target: 'profile' } | { target: 'group', groupId }
 * Autoriza o upload de UMA imagem num caminho fixo: a própria foto de perfil, ou a foto de um grupo
 * do qual o usuário é proprietário. O api_secret nunca sai do servidor.
 */
uploadsRouter.post('/signature', authenticate, async (req, res, next) => {
  try {
    const uid = requireUid(res);
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Requisição de upload inválida.');

    let publicId: string;
    if (parsed.data.target === 'profile') {
      publicId = `cpchat/users/${uid}/profile`;
    } else {
      const group = await firestore.collection('groups').doc(parsed.data.groupId).get();
      if (!group.exists) throw new HttpError(404, 'Grupo não encontrado.');
      if (group.get('ownerId') !== uid) throw new HttpError(403, 'Somente o proprietário pode alterar a foto do grupo.');
      publicId = `cpchat/groups/${parsed.data.groupId}/photo`;
    }

    const params = {
      allowed_formats: 'jpg,jpeg,png,webp,heic,heif',
      overwrite: 'true',
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      // Reduz no próprio Cloudinary: fotos grandes não ocupam a cota gratuita.
      transformation: 'c_limit,w_800,h_800',
    };

    res.status(200).json({
      cloudName: config.cloudinary.cloudName,
      apiKey: config.cloudinary.apiKey,
      params,
      signature: signCloudinaryParams(params, config.cloudinary.apiSecret),
    });
  } catch (error) {
    next(error);
  }
});
