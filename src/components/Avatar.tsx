import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type AvatarProps = {
  uri: string | null | undefined;
  name: string;
  size?: number;
  isGroup?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Foto com fallback: sem URL ou com erro de carregamento, mostra a imagem padrão (iniciais). */
export function Avatar({ uri, name, size = 44, isGroup = false, onPress, accessibilityLabel }: AvatarProps) {
  // Guarda QUAL url falhou: ao trocar a foto, a nova é tentada sem precisar resetar estado.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = Boolean(uri) && failedUri === uri;

  const initials = useMemo(
    () =>
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?',
    [name],
  );

  const dimension = { width: size, height: size, borderRadius: size / 2 };
  const content =
    uri && !failed ? (
      <Image source={{ uri }} style={[styles.image, dimension]} onError={() => setFailedUri(uri)} />
    ) : (
      <View style={[styles.placeholder, dimension, isGroup && styles.groupPlaceholder]}>
        <Text style={[styles.initials, { fontSize: size * 0.38 }, isGroup && styles.groupInitials]}>{initials}</Text>
      </View>
    );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `Ver ${name}`} hitSlop={6}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  placeholder: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  groupPlaceholder: { backgroundColor: colors.groupSoft },
  initials: { color: colors.primaryDark, fontWeight: '700' },
  groupInitials: { color: colors.group },
});
