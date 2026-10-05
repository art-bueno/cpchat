import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { ImagePickerField } from '../components/ImagePickerField';
import { Loading } from '../components/Loading';
import { PolicySelector } from '../components/PolicySelector';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroup } from '../hooks/useGroups';
import { useDirectoryEntries } from '../hooks/useUsers';
import { createGroup, deleteGroup, updateGroup } from '../services/groupService';
import { colors, radius, spacing } from '../theme';
import type { ChatGroup } from '../types/group';
import type { AppScreenProps } from '../types/navigation';
import type { NotificationPolicy } from '../types/notification';
import type { PickedImage } from '../types/user';
import { getErrorMessage } from '../utils/errors';
import {
  availableSlots,
  MAX_MEMBER_LIMIT,
  parseMemberLimit,
  validateGroupName,
  validateMemberCount,
  validateMemberLimit,
} from '../utils/groupValidation';

const DEFAULT_LIMIT = '10';

/** Carrega o grupo (modo edição) e só então monta o formulário com os valores iniciais. */
export function GroupFormScreen({ navigation, route }: AppScreenProps<'GroupForm'>) {
  const me = useCurrentUser();
  const groupId = route.params?.groupId;
  const groupState = useGroup(groupId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: groupId ? 'Editar grupo' : 'Novo grupo' });
  }, [navigation, groupId]);

  if (groupId) {
    if (groupState.status === 'loading') return <Loading message="Carregando grupo…" />;
    if (groupState.status === 'unavailable') return <EmptyState title="Grupo indisponível" description="O grupo foi excluído ou você não faz mais parte dele." />;
    if (groupState.status === 'error') return <ErrorMessage message={groupState.message} />;
    if (groupState.group.ownerId !== me.uid) return <EmptyState title="Sem permissão" description="Somente o proprietário pode editar o grupo." />;
  }

  const original = groupState.status === 'ready' ? groupState.group : null;
  return <GroupForm key={original?.id ?? 'new'} navigation={navigation} route={route} original={original} />;
}

type GroupFormProps = AppScreenProps<'GroupForm'> & { original: ChatGroup | null };

function GroupForm({ navigation, route, original }: GroupFormProps) {
  const me = useCurrentUser();
  const isEditing = original !== null;
  const selectedFromPicker = route.params?.selectedMemberIds;

  const [name, setName] = useState(original?.name ?? '');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [limitText, setLimitText] = useState(original ? String(original.memberLimit) : DEFAULT_LIMIT);
  const [policy, setPolicy] = useState<NotificationPolicy>(original?.notificationPolicy ?? 'all_group_messages');
  /** Integrantes além do proprietário. */
  const [memberIds, setMemberIds] = useState<string[]>(() => original?.memberIds.filter((id) => id !== original.ownerId) ?? []);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retorno da tela de seleção de usuários: aplica a nova seleção quando o parâmetro muda
  // (padrão "ajustar estado durante o render" — evita um effect só para copiar props).
  const [appliedSelection, setAppliedSelection] = useState(selectedFromPicker);
  if (selectedFromPicker !== appliedSelection) {
    setAppliedSelection(selectedFromPicker);
    if (selectedFromPicker) setMemberIds(selectedFromPicker.filter((id) => id !== me.uid));
  }

  const memberLimit = parseMemberLimit(limitText);
  const totalMembers = memberIds.length + 1;

  const errors = useMemo(() => {
    const nameCheck = validateGroupName(name);
    const limitCheck = validateMemberLimit(memberLimit, totalMembers);
    const countCheck = validateMemberCount(totalMembers, memberLimit ?? MAX_MEMBER_LIMIT);
    return {
      name: nameCheck.valid ? null : nameCheck.message,
      limit: limitCheck.valid ? null : limitCheck.message,
      members: countCheck.valid ? null : countCheck.message,
    };
  }, [name, memberLimit, totalMembers]);
  const hasErrors = Boolean(errors.name || errors.limit || errors.members);

  const slots = memberLimit !== null ? availableSlots(totalMembers, memberLimit) : null;
  const { entries: directory } = useDirectoryEntries(memberIds);

  const openMemberPicker = useCallback(() => {
    const limit = memberLimit ?? MAX_MEMBER_LIMIT;
    navigation.navigate('Users', { mode: 'selectMembers', selectedIds: memberIds, maxSelectable: Math.max(0, limit - 1) });
  }, [navigation, memberIds, memberLimit]);

  const removeLocalMember = useCallback((uid: string) => {
    setMemberIds((prev) => prev.filter((id) => id !== uid));
  }, []);

  const handleSave = useCallback(async () => {
    setSubmitted(true);
    if (hasErrors || memberLimit === null) return;
    setSaving(true);
    setError(null);
    try {
      if (!isEditing) {
        const result = await createGroup({ name, ownerId: me.uid, memberIds, memberLimit, notificationPolicy: policy, photo });
        if (result.warnings.length > 0) Alert.alert('Grupo criado com avisos', result.warnings.join('\n\n'));
        navigation.replace('Chat', { conversationId: result.groupId, conversationType: 'group' });
        return;
      }
      if (!original) return;
      // Delta em relação ao estado original — a transação aplica sobre o estado atual do servidor.
      const originalMembers = original.memberIds.filter((id) => id !== original.ownerId);
      const result = await updateGroup(
        original.id,
        me.uid,
        {
          name,
          memberLimit,
          notificationPolicy: policy,
          addMemberIds: memberIds.filter((id) => !originalMembers.includes(id)),
          removeMemberIds: originalMembers.filter((id) => !memberIds.includes(id)),
        },
        photo,
      );
      if (result.warnings.length > 0) Alert.alert('Grupo salvo com avisos', result.warnings.join('\n\n'));
      navigation.goBack();
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar o grupo.'));
    } finally {
      setSaving(false);
    }
  }, [hasErrors, isEditing, me.uid, memberIds, memberLimit, name, navigation, original, photo, policy]);

  const handleDelete = useCallback(() => {
    if (!original) return;
    Alert.alert('Excluir grupo', `Excluir "${original.name}"? Os integrantes perderão o acesso às mensagens.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          deleteGroup(original.id, me.uid)
            .then(() => navigation.popToTop())
            .catch((err: unknown) => {
              setError(getErrorMessage(err));
              setSaving(false);
            });
        },
      },
    ]);
  }, [me.uid, navigation, original]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <ErrorMessage message={error} onDismiss={() => setError(null)} /> : null}

        <ImagePickerField label="Foto do grupo" value={photo} currentUrl={original?.photoUrl} name={name} isGroup onChange={setPhoto} disabled={saving} />
        <TextField label="Nome do grupo" value={name} onChangeText={setName} maxLength={60} error={submitted ? errors.name : null} />
        <TextField
          label="Limite de integrantes (incluindo você)"
          value={limitText}
          onChangeText={(t) => setLimitText(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          error={errors.limit}
          hint={`Entre 2 e ${MAX_MEMBER_LIMIT}.`}
        />

        <View style={styles.capacity}>
          <Text style={styles.capacityText}>
            {totalMembers} de {memberLimit ?? '—'} integrantes
          </Text>
          <Text style={[styles.capacityText, slots === 0 && styles.full]}>
            {slots === null ? '' : slots > 0 ? `${slots} vaga(s) disponível(is)` : 'Grupo sem vagas'}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Integrantes</Text>
            <Pressable onPress={openMemberPicker} disabled={saving} accessibilityRole="button">
              <Text style={styles.link}>Selecionar</Text>
            </Pressable>
          </View>
          <View style={styles.memberRow}>
            <Avatar uri={me.photoUrl} name={me.name} size={32} />
            <Text style={styles.memberName}>{me.name} (você, proprietário)</Text>
          </View>
          {memberIds.map((uid) => {
            const user = directory.get(uid);
            return (
              <View key={uid} style={styles.memberRow}>
                <Avatar uri={user?.photoUrl} name={user?.name ?? '?'} size={32} />
                <Text style={styles.memberName}>{user?.name ?? 'Carregando…'}</Text>
                <Pressable onPress={() => removeLocalMember(uid)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover ${user?.name ?? 'integrante'}`}>
                  <Text style={styles.remove}>Remover</Text>
                </Pressable>
              </View>
            );
          })}
          {submitted && errors.members ? <Text style={styles.error}>{errors.members}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificações push</Text>
          <PolicySelector value={policy} onChange={setPolicy} disabled={saving} />
        </View>

        <PrimaryButton title={isEditing ? 'Salvar alterações' : 'Criar grupo'} onPress={handleSave} loading={saving} />
        {isEditing ? <PrimaryButton title="Excluir grupo" variant="danger" onPress={handleDelete} disabled={saving} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 48 },
  capacity: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  capacityText: { fontWeight: '600', color: colors.text },
  full: { color: colors.danger },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: radius.md },
  memberName: { flex: 1, color: colors.text },
  remove: { color: colors.danger, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13 },
});
