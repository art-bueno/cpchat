import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { PickedImage } from '../types/user';
import { AppError, getErrorMessage } from '../utils/errors';
import { storage } from './firebase';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const storagePaths = {
  profilePhoto: (uid: string) => `users/${uid}/profile.jpg`,
  groupPhoto: (groupId: string) => `groups/${groupId}/photo.jpg`,
} as const;

/**
 * Envia o arquivo para o Firebase Storage e devolve a URL pública de download.
 * Somente essa URL é gravada no Firestore — nunca Base64.
 */
export async function uploadImage(path: string, image: PickedImage): Promise<string> {
  try {
    const file = await fetch(image.uri);
    const blob = await file.blob();
    if (blob.size > MAX_IMAGE_BYTES) throw new AppError('upload-failed', 'A imagem deve ter no máximo 5 MB.');
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: image.mimeType });
    return await getDownloadURL(storageRef);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('upload-failed', getErrorMessage(error, 'Não foi possível enviar a imagem.'));
  }
}
