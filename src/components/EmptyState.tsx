import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? <PrimaryButton title={actionLabel} onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  description: { color: colors.textMuted, textAlign: 'center' },
  button: { marginTop: spacing.md, alignSelf: 'stretch' },
});
