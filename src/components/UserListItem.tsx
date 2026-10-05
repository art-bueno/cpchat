import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { PublicUser } from '../types/user';
import { Avatar } from './Avatar';

type UserListItemProps = {
  user: PublicUser;
  onPress: (user: PublicUser) => void;
  selected?: boolean;
  disabled?: boolean;
  /** Exibe checkbox de seleção (modo de escolha de integrantes). */
  selectable?: boolean;
  subtitle?: string;
};

function UserListItemComponent({ user, onPress, selected = false, disabled = false, selectable = false, subtitle }: UserListItemProps) {
  return (
    <Pressable
      onPress={() => onPress(user)}
      disabled={disabled}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={{ checked: selectable ? selected : undefined, disabled }}
    >
      <Avatar uri={user.photoUrl} name={user.name} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {user.name}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {selectable ? <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View> : null}
    </Pressable>
  );
}

export const UserListItem = memo(UserListItemComponent);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.background },
  disabled: { opacity: 0.45 },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: '#FFFFFF', fontWeight: '800' },
});
