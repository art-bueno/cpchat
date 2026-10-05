import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import type { PublicUser } from '../types/user';
import { Avatar } from './Avatar';

type GroupMemberItemProps = {
  member: PublicUser;
  isOwner: boolean;
  isCurrentUser: boolean;
  /** Exibe o botão "Remover" (somente para o proprietário, em outros integrantes). */
  canRemove: boolean;
  removing?: boolean;
  onPress: (member: PublicUser) => void;
  onRemove?: (member: PublicUser) => void;
};

function GroupMemberItemComponent({ member, isOwner, isCurrentUser, canRemove, removing = false, onPress, onRemove }: GroupMemberItemProps) {
  return (
    <Pressable onPress={() => onPress(member)} style={({ pressed }) => [styles.container, pressed && styles.pressed]} accessibilityRole="button">
      <Avatar uri={member.photoUrl} name={member.name} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
          {isCurrentUser ? ' (você)' : ''}
        </Text>
        {isOwner ? (
          <View style={styles.ownerBadge}>
            <Text style={styles.ownerText}>Proprietário</Text>
          </View>
        ) : null}
      </View>
      {canRemove && onRemove ? (
        <Pressable onPress={() => onRemove(member)} disabled={removing} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover ${member.name}`}>
          <Text style={[styles.remove, removing && styles.removing]}>{removing ? 'Removendo…' : 'Remover'}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export const GroupMemberItem = memo(GroupMemberItemComponent);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.background },
  body: { flex: 1, gap: 2, alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  ownerBadge: { backgroundColor: colors.groupSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm },
  ownerText: { color: colors.group, fontSize: 11, fontWeight: '700' },
  remove: { color: colors.danger, fontWeight: '700' },
  removing: { opacity: 0.5 },
});
