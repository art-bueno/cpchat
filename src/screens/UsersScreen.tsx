import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { UserListItem } from '../components/UserListItem';
import { useCurrentUser } from '../hooks/useAuth';
import { useUserDirectory } from '../hooks/useUsers';
import { getOrCreateDirectConversation } from '../services/chatService';
import { colors, radius, spacing } from '../theme';
import type { AppScreenProps } from '../types/navigation';
import type { PublicUser } from '../types/user';
import { getErrorMessage } from '../utils/errors';

export function UsersScreen({ navigation, route }: AppScreenProps<'Users'>) {
  const me = useCurrentUser();
  const params = route.params;
  const [search, setSearch] = useState('');
  const [openingUid, setOpeningUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(params.mode === 'selectMembers' ? params.selectedIds : []));

  // O próprio usuário nunca aparece: impede conversa consigo mesmo e auto-seleção no grupo.
  const { users, loading, error: loadError } = useUserDirectory(search, me.uid);

  const maxSelectable = params.mode === 'selectMembers' ? params.maxSelectable : 0;
  const remaining = maxSelectable - selected.size;

  const confirmSelection = useCallback(() => {
    navigation.popTo('GroupForm', { selectedMemberIds: [...selected] }, { merge: true });
  }, [navigation, selected]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: params.mode === 'direct' ? 'Nova conversa' : 'Selecionar integrantes',
      headerRight:
        params.mode === 'selectMembers'
          ? () => (
              <Pressable onPress={confirmSelection} hitSlop={8} accessibilityRole="button">
                <Text style={styles.headerAction}>Concluir</Text>
              </Pressable>
            )
          : undefined,
    });
  }, [navigation, params.mode, confirmSelection]);

  const handlePress = useCallback(
    async (user: PublicUser) => {
      setError(null);
      if (params.mode === 'selectMembers') {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(user.uid)) next.delete(user.uid);
          else if (next.size < params.maxSelectable) next.add(user.uid);
          return next;
        });
        return;
      }
      setOpeningUid(user.uid);
      try {
        const conversation = await getOrCreateDirectConversation(me.uid, user.uid);
        navigation.replace('Chat', { conversationId: conversation.id, conversationType: 'direct' });
      } catch (err) {
        setError(getErrorMessage(err, 'Não foi possível abrir a conversa.'));
        setOpeningUid(null);
      }
    },
    [me.uid, navigation, params],
  );

  const renderItem = useCallback(
    ({ item }: { item: PublicUser }) => {
      const isSelected = selected.has(item.uid);
      return (
        <UserListItem
          user={item}
          onPress={handlePress}
          selectable={params.mode === 'selectMembers'}
          selected={isSelected}
          disabled={openingUid !== null || (params.mode === 'selectMembers' && !isSelected && remaining <= 0)}
          subtitle={openingUid === item.uid ? 'Abrindo conversa…' : undefined}
        />
      );
    },
    [handlePress, openingUid, params.mode, remaining, selected],
  );

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCorrect={false}
          accessibilityLabel="Buscar usuários"
        />
        {params.mode === 'selectMembers' ? (
          <Text style={[styles.counter, remaining <= 0 && styles.counterFull]}>
            {selected.size} selecionado(s) · {remaining > 0 ? `${remaining} vaga(s) disponível(is)` : 'Grupo sem vagas'}
          </Text>
        ) : null}
      </View>
    ),
    [search, params.mode, selected.size, remaining],
  );

  if (loading) return <Loading message="Carregando usuários…" />;

  return (
    <View style={styles.container}>
      {header}
      {error || loadError ? <ErrorMessage message={error ?? loadError ?? ''} /> : null}
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={users.length === 0 ? styles.empty : undefined}
        ListEmptyComponent={
          <EmptyState title={search ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'} description={search ? 'Tente outro nome.' : 'Ainda não há outros usuários cadastrados.'} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  search: { height: 44, borderRadius: radius.md, backgroundColor: colors.background, paddingHorizontal: spacing.md, color: colors.text, fontSize: 16 },
  counter: { color: colors.textMuted, fontWeight: '600' },
  counterFull: { color: colors.danger },
  headerAction: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  empty: { flexGrow: 1 },
});
