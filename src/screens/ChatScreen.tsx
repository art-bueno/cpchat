import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { ChatInput } from '../components/ChatInput';
import { ChatMessageBubble, FailedMessageBubble } from '../components/ChatMessage';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { OfflineBanner } from '../components/StatusBanners';
import { useCurrentUser } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useGroup } from '../hooks/useGroups';
import { useDirectoryEntries } from '../hooks/useUsers';
import { subscribeToDirectConversation, updateDirectNotificationPolicy } from '../services/chatService';
import { colors, spacing } from '../theme';
import type { ChatMessage, DirectConversation, FailedMessage } from '../types/chat';
import type { AppScreenProps } from '../types/navigation';
import type { PublicUser } from '../types/user';
import { getOtherParticipantId } from '../utils/conversationId';
import { getErrorMessage } from '../utils/errors';

type ListItem = { kind: 'message'; message: ChatMessage } | { kind: 'failed'; failed: FailedMessage };

export function ChatScreen({ navigation, route }: AppScreenProps<'Chat'>) {
  const { conversationId, conversationType } = route.params;
  const me = useCurrentUser();
  const isGroup = conversationType === 'group';

  // ─── Metadados da conversa (Firestore) ───
  const groupState = useGroup(isGroup ? conversationId : undefined);
  const group = groupState.status === 'ready' ? groupState.group : null;
  const [direct, setDirect] = useState<DirectConversation | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);

  useEffect(() => {
    if (isGroup) return undefined;
    return subscribeToDirectConversation(conversationId, setDirect, (err) => setPolicyError(getErrorMessage(err)));
  }, [conversationId, isGroup]);

  const otherUid = isGroup ? null : getOtherParticipantId(conversationId, me.uid);
  const participantIds = useMemo(() => (group ? group.memberIds : otherUid ? [otherUid] : []), [group, otherUid]);
  const { entries: directory } = useDirectoryEntries(participantIds);
  const otherUser = otherUid ? directory.get(otherUid) : undefined;

  /** Usuário ainda participa? Em grupos, perder acesso encerra o listener de mensagens. */
  const isParticipant = isGroup ? group !== null && group.memberIds.includes(me.uid) : otherUid !== null;
  const membershipKnown = !isGroup || groupState.status !== 'loading';

  // ─── Mensagens (Realtime Database) ───
  const chat = useChat({ conversationId, conversationType, currentUid: me.uid, enabled: membershipKnown && isParticipant });

  const mentionableMembers = useMemo<PublicUser[]>(
    () => (group ? group.memberIds.filter((id) => id !== me.uid).flatMap((id) => directory.get(id) ?? []) : []),
    [group, directory, me.uid],
  );

  const title = isGroup ? (group?.name ?? 'Grupo') : (otherUser?.name ?? 'Conversa');
  const photo = isGroup ? group?.photoUrl : otherUser?.photoUrl;

  const openDetails = useCallback(() => {
    if (isGroup) navigation.navigate('GroupMembers', { groupId: conversationId });
    else if (otherUid) navigation.navigate('Profile', { uid: otherUid });
  }, [conversationId, isGroup, navigation, otherUid]);

  const toggleDirectNotifications = useCallback(() => {
    if (!direct) return;
    setPolicyError(null);
    const next = direct.notificationPolicy === 'disabled' ? 'direct_messages_only' : 'disabled';
    updateDirectNotificationPolicy(direct.id, next).catch((err: unknown) => setPolicyError(getErrorMessage(err)));
  }, [direct]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable style={styles.headerTitle} onPress={openDetails} accessibilityRole="button" accessibilityLabel={isGroup ? 'Ver integrantes' : 'Ver perfil'}>
          <Avatar uri={photo} name={title} size={34} isGroup={isGroup} />
          <View style={styles.headerTexts}>
            <Text style={styles.headerName} numberOfLines={1}>
              {title}
            </Text>
            {group ? <Text style={styles.headerSub}>{group.memberIds.length} integrantes · toque para ver</Text> : null}
          </View>
        </Pressable>
      ),
      headerRight: () =>
        group && group.ownerId === me.uid ? (
          <Pressable onPress={() => navigation.navigate('GroupForm', { groupId: group.id })} hitSlop={8} accessibilityRole="button">
            <Text style={styles.headerAction}>Editar</Text>
          </Pressable>
        ) : direct ? (
          <Pressable onPress={toggleDirectNotifications} hitSlop={8} accessibilityRole="button" accessibilityLabel="Alternar notificações">
            <Text style={styles.headerAction}>{direct.notificationPolicy === 'disabled' ? '🔕' : '🔔'}</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, openDetails, photo, title, isGroup, group, me.uid, direct, toggleDirectNotifications]);

  // Lista invertida: mais recentes embaixo; falhas locais aparecem por último.
  const listItems = useMemo<ListItem[]>(() => {
    const messages = chat.state.status === 'ready' ? chat.state.messages : [];
    const items: ListItem[] = [
      ...messages.map<ListItem>((message) => ({ kind: 'message', message })),
      ...chat.failed.map<ListItem>((failed) => ({ kind: 'failed', failed })),
    ];
    return items.reverse();
  }, [chat.state, chat.failed]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'failed') return <FailedMessageBubble message={item.failed} onRetry={chat.retry} onDiscard={chat.discard} />;
      const { message } = item;
      const targetName = message.target.type === 'member' ? (message.target.memberId === me.uid ? 'você' : (directory.get(message.target.memberId)?.name ?? 'integrante')) : null;
      return (
        <ChatMessageBubble
          message={message}
          isMine={message.senderId === me.uid}
          authorName={isGroup ? (directory.get(message.senderId)?.name ?? 'Ex-integrante') : null}
          targetName={targetName}
          mentionsMe={message.mentionedUserIds.includes(me.uid) || (message.target.type === 'member' && message.target.memberId === me.uid)}
        />
      );
    },
    [chat.discard, chat.retry, directory, isGroup, me.uid],
  );

  if (!membershipKnown) return <Loading message="Abrindo conversa…" />;

  if (!isParticipant || chat.state.status === 'forbidden') {
    return (
      <EmptyState
        title="Conversa indisponível"
        description={isGroup ? 'Este grupo foi excluído ou você não faz mais parte dele.' : 'Você não participa desta conversa.'}
        actionLabel="Voltar"
        onAction={() => navigation.goBack()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <OfflineBanner />
        {policyError ? <ErrorMessage message={policyError} onDismiss={() => setPolicyError(null)} /> : null}
        {chat.pushWarning ? <ErrorMessage tone="warning" message={chat.pushWarning} onDismiss={chat.dismissPushWarning} /> : null}

        {chat.state.status === 'loading' ? (
          <Loading message="Carregando mensagens…" />
        ) : chat.state.status === 'error' ? (
          <ErrorMessage message={chat.state.message} />
        ) : (
          <FlatList
            data={listItems}
            inverted={listItems.length > 0}
            keyExtractor={(item) => (item.kind === 'message' ? item.message.id : item.failed.localId)}
            renderItem={renderItem}
            contentContainerStyle={listItems.length === 0 ? styles.emptyList : styles.list}
            ListEmptyComponent={<EmptyState title="Nenhuma mensagem ainda" description="Envie a primeira mensagem!" />}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <ChatInput members={mentionableMembers} sending={chat.sending} onSend={chat.send} disabled={chat.state.status !== 'ready'} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: { paddingVertical: spacing.sm },
  emptyList: { flexGrow: 1 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 240 },
  headerTexts: { flexShrink: 1 },
  headerName: { fontWeight: '700', fontSize: 16, color: colors.text },
  headerSub: { fontSize: 11, color: colors.textMuted },
  headerAction: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});
