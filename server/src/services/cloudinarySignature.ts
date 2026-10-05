import { createHash } from 'node:crypto';

/**
 * Assinatura de upload do Cloudinary: SHA-1 dos parâmetros ordenados (`a=1&b=2`) + api_secret.
 * O cliente não consegue alterar nenhum parâmetro assinado (destino, formatos, redimensionamento).
 */
export function signCloudinaryParams(params: Readonly<Record<string, string>>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}
