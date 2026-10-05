import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { PrimaryButton } from '../components/PrimaryButton';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroup } from '../hooks/useGroups';
import { useDirectoryEntries } from '../hooks/useUsers';
import { removeMember } from '../services/groupService';
import { colors, spacing } from '../theme';
import { POLICY_LABELS } from '../types/notification';
import type { AppScreenProps } from '../types/navigation';
import type { PublicUser } from '../types/user';
import { getErrorMessage } from '../utils/errors';
import { availableSlots } from '../utils/groupValidation';

export function GroupMembersScreen({ navigation, route }: AppScreenProps<'GroupMembers'>) {
  const me = useCurrentUser();
  const groupState = useGroup(route.params.groupId);
  const group = groupState.status === 'ready' ? groupState.group : null;
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { entries } = useDirectoryEntries(group?.memberIds ?? []);
  const members = useMemo<PublicUser[]>(() => {
    if (!group) return [];
    const list = group.memberIds.map((uid) => entries.get(uid) ?? { uid, name: 'Carregando…', photoUrl: '' });
    // Proprietário primeiro, demais em ordem alfabética (cópia nova, sem mutar o estado).
    return [...list].sort((a, b) => (a.uid === group.ownerId ? -1 : b.uid === group.ownerId ? 1 : a.name.localeCompare(b.name)));
  }, [group, entries]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: group?.name ?? 'Integrantes' });
  }, [navigation, group?.name]);

  const isOwner = group?.ownerId === me.uid;

  const handleRemove = useCallback(
    (member: PublicUser) => {
      if (!group) return;
      Alert.alert('Remover integrante', `Remover ${member.name} do grupo? Ele deixará de ver novas mensagens.`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            setRemovingUid(member.uid);
            setError(null);
            removeMember(group.id, me.uid, member.uid)
              .then((result) => {
                if (result.warnings.length > 0) setError(result.warnings.join('\n'));
              })
              .catch((err: unknown) => setError(getErrorMessage(err)))
              .finally(() => setRemovingUid(null));
          },
        },
      ]);
    },
    [group, me.uid],
  );

  const renderItem = useCallback(
    ({ item }: { item: PublicUser }) => (
      <GroupMemberItem
        member={item}
        isOwner={item.uid === group?.ownerId}
        isCurrentUser={item.uid === me.uid}
        canRemove={isOwner && item.uid !== me.uid}
        removing={removingUid === item.uid}
        onPress={(member) => navigation.navigate('Profile', { uid: member.uid })}
        onRemove={handleRemove}
      />
    ),
    [group?.ownerId, handleRemove, isOwner, me.uid, navigation, removingUid],
  );

  if (groupState.status === 'loading') return <Loading message="Carregando integrantes…" />;
  if (groupState.status === 'error') return <ErrorMessage message={groupState.message} />;
  if (!group) return <EmptyState title="Grupo indisponível" description="O grupo foi excluído ou você não faz mais parte dele." />;

  const slots = availableSlots(group.memberIds.length, group.memberLimit);

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Avatar uri={group.photoUrl} name={group.name} size={96} isGroup />
            <Text style={styles.name}>{group.name}</Text>
            <Text style={styles.meta}>
              {group.memberIds.length}/{group.memberLimit} integrantes · {slots > 0 ? `${slots} vaga(s)` : 'sem vagas'}
            </Text>
            <Text style={styles.meta}>Notificações: {POLICY_LABELS[group.notificationPolicy].title}</Text>
            {error ? <ErrorMessage message={error} onDismiss={() => setError(null)} /> : null}
            {isOwner ? (
              <PrimaryButton title="Editar grupo" variant="secondary" onPress={() => navigation.navigate('GroupForm', { groupId: group.id })} style={styles.button} />
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', padding: spacing.xl, gap: spacing.xs },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  meta: { color: colors.textMuted },
  button: { alignSelf: 'stretch', marginTop: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 72 },
});
