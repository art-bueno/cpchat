import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pickSquareImage } from '../services/imagePickerService';
import { colors, spacing } from '../theme';
import type { PickedImage } from '../types/user';
import { getErrorMessage } from '../utils/errors';
import { Avatar } from './Avatar';

type ImagePickerFieldProps = {
  label: string;
  /** Imagem recém-escolhida (ainda não enviada). */
  value: PickedImage | null;
  /** URL atual já salva, exibida enquanto nada novo é escolhido. */
  currentUrl?: string;
  name: string;
  isGroup?: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange: (image: PickedImage) => void;
};

export function ImagePickerField({ label, value, currentUrl, name, isGroup, disabled, error, onChange }: ImagePickerFieldProps) {
  const [pickError, setPickError] = useState<string | null>(null);

  const handlePick = useCallback(async () => {
    setPickError(null);
    try {
      const result = await pickSquareImage();
      if (result.status === 'picked') onChange(result.image);
    } catch (err) {
      setPickError(getErrorMessage(err, 'Não foi possível abrir a galeria.'));
    }
  }, [onChange]);

  const shownError = pickError ?? error;

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePick} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
        <Avatar uri={value?.uri ?? currentUrl} name={name || '?'} size={72} isGroup={isGroup} />
        <View style={styles.texts}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.link}>{value || currentUrl ? 'Trocar foto' : 'Escolher foto'}</Text>
        </View>
      </Pressable>
      {shownError ? <Text style={styles.error}>{shownError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  texts: { gap: spacing.xs },
  label: { fontWeight: '600', color: colors.text },
  link: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13 },
});
