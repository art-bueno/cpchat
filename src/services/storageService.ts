import type { PickedImage } from '../types/user';
import { AppError } from '../utils/errors';
import { isRecord } from '../utils/guards';
import { requestUploadSignature, type UploadTarget } from './apiClient';

export type { UploadTarget };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileExtension(mimeType: string): string {
  const subtype = mimeType.split('/')[1] ?? 'jpeg';
  return subtype === 'jpeg' ? 'jpg' : subtype;
}

/**
 * Envia a imagem ao Cloudinary com uma assinatura emitida pela nossa API e devolve a URL HTTPS final.
 * Somente essa URL é gravada no Firestore — nunca Base64.
 */
export async function uploadImage(target: UploadTarget, image: PickedImage): Promise<string> {
  if (image.fileSize !== null && image.fileSize > MAX_IMAGE_BYTES) {
    throw new AppError('upload-failed', 'A imagem deve ter no máximo 5 MB.');
  }

  const { cloudName, apiKey, signature, params } = await requestUploadSignature(target);

  const form = new FormData();
  // No React Native o arquivo é enviado por referência ({ uri, name, type }), sem carregar em memória.
  form.append('file', { uri: image.uri, name: `upload.${fileExtension(image.mimeType)}`, type: image.mimeType });
  form.append('api_key', apiKey);
  form.append('signature', signature);
  for (const [key, value] of Object.entries(params)) form.append(key, value);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body: form });
  } catch {
    throw new AppError('network', 'Falha de conexão ao enviar a imagem.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || typeof body.secure_url !== 'string') {
    throw new AppError('upload-failed', 'Não foi possível enviar a imagem.');
  }
  return body.secure_url;
}
