import { File } from 'expo-file-system';
import type { PickedImage } from '../types/user';
import { AppError } from '../utils/errors';
import { isRecord } from '../utils/guards';
import { requestUploadSignature, type UploadTarget } from './apiClient';

export type { UploadTarget };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Envia a imagem ao Cloudinary com uma assinatura emitida pela nossa API e devolve a URL HTTPS final.
 * Somente essa URL é gravada no Firestore — nunca Base64.
 */
export async function uploadImage(target: UploadTarget, image: PickedImage): Promise<string> {
  if (image.fileSize !== null && image.fileSize > MAX_IMAGE_BYTES) {
    throw new AppError('upload-failed', 'A imagem deve ter no máximo 5 MB.');
  }

  let signed: Awaited<ReturnType<typeof requestUploadSignature>>;
  try {
    signed = await requestUploadSignature(target);
  } catch (error) {
    // Diagnóstico só no console (terminal do Metro); o usuário recebe a mensagem amigável.
    console.warn('[upload] falha ao obter assinatura na API:', error instanceof Error ? error.message : error);
    throw error;
  }
  const { cloudName, apiKey, signature, params } = signed;

  const form = new FormData();
  // No SDK 57 o `fetch` global é o `expo/fetch`, que NÃO aceita o formato antigo { uri, name, type }.
  // O `File` do expo-file-system implementa Blob e é lido pelo fetch na hora do envio.
  form.append('file', new File(image.uri));
  form.append('api_key', apiKey);
  form.append('signature', signature);
  for (const [key, value] of Object.entries(params)) form.append(key, value);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body: form });
  } catch (error) {
    console.warn('[upload] erro de rede ao chamar o Cloudinary:', error instanceof Error ? error.message : error);
    throw new AppError('network', 'Falha de conexão ao enviar a imagem.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || typeof body.secure_url !== 'string') {
    const detail = isRecord(body) && isRecord(body.error) ? body.error.message : body;
    console.warn(`[upload] Cloudinary respondeu HTTP ${response.status}:`, detail, `(cloud: ${cloudName}, mime: ${image.mimeType}, uri: ${image.uri.slice(0, 60)})`);
    throw new AppError('upload-failed', 'Não foi possível enviar a imagem.');
  }
  return body.secure_url;
}
