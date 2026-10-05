import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { NOTIFICATION_POLICIES, POLICY_LABELS, type NotificationPolicy } from '../types/notification';

type PolicySelectorProps = {
  value: NotificationPolicy;
  onChange: (policy: NotificationPolicy) => void;
  disabled?: boolean;
};

export function PolicySelector({ value, onChange, disabled = false }: PolicySelectorProps) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {NOTIFICATION_POLICIES.map((policy) => {
        const selected = policy === value;
        return (
          <Pressable
            key={policy}
            onPress={() => onChange(policy)}
            disabled={disabled}
            style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
          >
            <View style={[styles.radio, selected && styles.radioSelected]} />
            <View style={styles.texts}>
              <Text style={styles.title}>{POLICY_LABELS[policy].title}</Text>
              <Text style={styles.description}>{POLICY_LABELS[policy].description}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.6 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, marginTop: 2 },
  radioSelected: { borderColor: colors.primary, borderWidth: 6 },
  texts: { flex: 1 },
  title: { fontWeight: '700', color: colors.text },
  description: { color: colors.textMuted, fontSize: 13 },
});
