import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import type { ChatMessage, ConversationListItem } from '../types/chat';
import type { PublicUser } from '../types/user';
import { formatMessageTime } from '../utils/formValidation';
import { Avatar } from './Avatar';

type ConversationItemProps = {
  item: ConversationListItem;
  /** Outro participante (conversa individual), quando já carregado. */
  otherUser: PublicUser | undefined;
  lastMessage: ChatMessage | undefined;
  currentUid: string;
  onPress: (item: ConversationListItem) => void;
};

function ConversationItemComponent({ item, otherUser, lastMessage, currentUid, onPress }: ConversationItemProps) {
  const isGroup = item.kind === 'group';
  const title = isGroup ? item.group.name : (otherUser?.name ?? 'Usuário');
  const photo = isGroup ? item.group.photoUrl : otherUser?.photoUrl;
  const preview = lastMessage
    ? `${lastMessage.senderId === currentUid ? 'Você: ' : ''}${lastMessage.text}`
    : isGroup
      ? `${item.group.memberIds.length} integrantes`
      : 'Nenhuma mensagem ainda';

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${isGroup ? 'Grupo' : 'Conversa com'} ${title}`}
    >
      <Avatar uri={photo} name={title} isGroup={isGroup} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.badge, isGroup ? styles.groupBadge : styles.directBadge]}>
            <Text style={[styles.badgeText, isGroup ? styles.groupBadgeText : styles.directBadgeText]}>{isGroup ? 'Grupo' : 'Individual'}</Text>
          </View>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {lastMessage ? <Text style={styles.time}>{formatMessageTime(lastMessage.createdAt)}</Text> : null}
    </Pressable>
  );
}

export const ConversationItem = memo(ConversationItemComponent);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.background },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  preview: { color: colors.textMuted },
  time: { color: colors.textMuted, fontSize: 12, alignSelf: 'flex-start' },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  groupBadge: { backgroundColor: colors.groupSoft },
  directBadge: { backgroundColor: colors.primarySoft },
  badgeText: { fontSize: 11, fontWeight: '700' },
  groupBadgeText: { color: colors.group },
  directBadgeText: { color: colors.primaryDark },
});
