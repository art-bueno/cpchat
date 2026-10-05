import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type ErrorMessageProps = {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  tone?: 'error' | 'warning';
};

export function ErrorMessage({ message, onRetry, onDismiss, tone = 'error' }: ErrorMessageProps) {
  const palette = tone === 'error' ? { bg: colors.dangerSoft, fg: colors.danger } : { bg: colors.warningSoft, fg: colors.warning };
  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]} accessibilityRole="alert">
      <Text style={[styles.text, { color: palette.fg }]}>{message}</Text>
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.action, { color: palette.fg }]}>Tentar novamente</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.action, { color: palette.fg }]}>Fechar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.md, padding: spacing.md, margin: spacing.md, gap: spacing.sm },
  text: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.lg },
  action: { fontWeight: '700' },
});
