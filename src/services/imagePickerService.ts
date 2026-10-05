import * as ImagePicker from 'expo-image-picker';
import type { PickedImage } from '../types/user';
import { AppError } from '../utils/errors';

export type PickImageResult = { status: 'picked'; image: PickedImage } | { status: 'canceled' };

/** Solicita a permissão da galeria e abre o seletor com recorte quadrado. */
export async function pickSquareImage(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AppError(
      'permission-denied',
      permission.canAskAgain
        ? 'Permita o acesso às fotos para escolher uma imagem.'
        : 'O acesso às fotos foi negado. Libere a permissão nas configurações do aparelho.',
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });

  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'canceled' };
  return { status: 'picked', image: { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', fileSize: asset.fileSize ?? null } };
}
