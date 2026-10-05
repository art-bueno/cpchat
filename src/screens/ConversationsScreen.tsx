import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { ConversationItem } from '../components/ConversationItem';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { NotificationBanner, OfflineBanner } from '../components/StatusBanners';
import { useNotificationStatus } from '../contexts/NotificationContext';
import { useAuth, useCurrentUser } from '../hooks/useAuth';
import { useConversations } from '../hooks/useConversations';
import { useDirectoryEntries } from '../hooks/useUsers';
import { colors, radius, spacing } from '../theme';
import type { ConversationListItem } from '../types/chat';
import type { AppScreenProps } from '../types/navigation';

export function ConversationsScreen({ navigation }: AppScreenProps<'Conversations'>) {
  const me = useCurrentUser();
  const { logout } = useAuth();
  const notifications = useNotificationStatus();
  const { items, lastMessages, loading, error } = useConversations(me.uid);
  const [loggingOut, setLoggingOut] = useState(false);
  const insets = useSafeAreaInsets();

  const otherUserIds = useMemo(() => items.flatMap((item) => (item.kind === 'direct' ? [item.otherUserId] : [])), [items]);
  const { entries: directory } = useDirectoryEntries(otherUserIds);

  const confirmLogout = useCallback(() => {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          setLoggingOut(true);
          logout().catch(() => setLoggingOut(false));
        },
      },
    ]);
  }, [logout]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <Avatar uri={me.photoUrl} name={me.name} size={32} onPress={() => navigation.navigate('Profile', { uid: me.uid })} accessibilityLabel="Meu perfil" />,
      headerRight: () => (
        <Pressable onPress={confirmLogout} disabled={loggingOut} hitSlop={8} accessibilityRole="button">
          <Text style={styles.headerAction}>{loggingOut ? 'Saindo…' : 'Sair'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, me, confirmLogout, loggingOut]);

  const openConversation = useCallback(
    (item: ConversationListItem) => navigation.navigate('Chat', { conversationId: item.id, conversationType: item.kind }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationListItem }) => (
      <ConversationItem
        item={item}
        otherUser={item.kind === 'direct' ? directory.get(item.otherUserId) : undefined}
        lastMessage={lastMessages.get(item.id)}
        currentUid={me.uid}
        onPress={openConversation}
      />
    ),
    [directory, lastMessages, me.uid, openConversation],
  );

  if (loading) return <Loading message="Carregando conversas…" />;

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <NotificationBanner status={notifications.status} onRetry={notifications.retry} />
      {error ? <ErrorMessage message={error} /> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma conversa ainda"
            description="Comece uma conversa individual ou crie um grupo."
            actionLabel="Nova conversa"
            onAction={() => navigation.navigate('Users', { mode: 'direct' })}
          />
        }
      />

      <View style={[styles.actions, { bottom: spacing.xl + insets.bottom }]}>
        <Pressable style={[styles.fab, styles.fabSecondary]} onPress={() => navigation.navigate('GroupForm')} accessibilityRole="button">
          <Text style={styles.fabSecondaryText}>+ Grupo</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('Users', { mode: 'direct' })} accessibilityRole="button">
          <Text style={styles.fabText}>+ Conversa</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyContainer: { flexGrow: 1 },
  listContent: { paddingBottom: 140 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 72 },
  headerAction: { color: colors.danger, fontWeight: '700' },
  actions: { position: 'absolute', right: spacing.lg, gap: spacing.sm, alignItems: 'flex-end' },
  fab: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, elevation: 3 },
  fabText: { color: '#FFFFFF', fontWeight: '700' },
  fabSecondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.group },
  fabSecondaryText: { color: colors.group, fontWeight: '700' },
});
