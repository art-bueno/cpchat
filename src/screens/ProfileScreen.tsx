import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { ErrorMessage } from '../components/ErrorMessage';
import { ImagePickerField } from '../components/ImagePickerField';
import { Loading } from '../components/Loading';
import { useCurrentUser } from '../hooks/useAuth';
import { fetchUserProfile } from '../services/apiClient';
import { updateOwnPhoto } from '../services/userService';
import { colors, radius, spacing } from '../theme';
import type { AppScreenProps } from '../types/navigation';
import type { PickedImage, UserProfileView } from '../types/user';
import { AppError, getErrorMessage } from '../utils/errors';
import { formatPhoneForDisplay, isoDateToBr } from '../utils/formValidation';

type ProfileState = { status: 'loading' } | { status: 'ready'; profile: UserProfileView } | { status: 'error'; message: string; forbidden: boolean };

const UNAVAILABLE = 'Não informado';

export function ProfileScreen({ navigation, route }: AppScreenProps<'Profile'>) {
  const me = useCurrentUser();
  const { uid } = route.params;
  const isMe = uid === me.uid;
  const [remote, setRemote] = useState<{ uid: string; attempt: number; state: ProfileState } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Perfil de terceiros vem da API, que verifica se há conversa ou grupo em comum.
  useEffect(() => {
    if (isMe) return undefined;
    let active = true;
    fetchUserProfile(uid)
      .then((profile) => active && setRemote({ uid, attempt, state: { status: 'ready', profile } }))
      .catch((err: unknown) => {
        if (!active) return;
        const forbidden = err instanceof AppError && err.code === 'permission-denied';
        const message = forbidden ? 'Você só pode ver o perfil de quem participa de uma conversa ou grupo com você.' : getErrorMessage(err);
        setRemote({ uid, attempt, state: { status: 'error', message, forbidden } });
      });
    return () => {
      active = false;
    };
  }, [isMe, uid, attempt]);

  // O próprio perfil vem do contexto (listener do Firestore), sempre atualizado.
  const state: ProfileState = isMe
    ? { status: 'ready', profile: me }
    : remote?.uid === uid && remote.attempt === attempt
      ? remote.state
      : { status: 'loading' };

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    navigation.setOptions({ title: isMe ? 'Meu perfil' : 'Perfil' });
  }, [navigation, isMe]);

  const changePhoto = useCallback(
    async (image: PickedImage) => {
      setUploading(true);
      setPhotoError(null);
      try {
        await updateOwnPhoto(me.uid, image);
      } catch (err) {
        setPhotoError(getErrorMessage(err));
      } finally {
        setUploading(false);
      }
    },
    [me.uid],
  );

  if (state.status === 'loading') return <Loading message="Carregando perfil…" />;
  if (state.status === 'error') return <ErrorMessage message={state.message} onRetry={state.forbidden ? undefined : retry} />;

  const { profile } = state;
  const fields: { label: string; value: string | null }[] = [
    { label: 'E-mail', value: profile.email },
    { label: 'Celular', value: profile.phoneNumber ? formatPhoneForDisplay(profile.phoneNumber) : null },
    { label: 'Data de nascimento', value: profile.birthDate ? isoDateToBr(profile.birthDate) : null },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {isMe ? (
          <ImagePickerField label={uploading ? 'Enviando foto…' : 'Foto de perfil'} value={null} currentUrl={me.photoUrl} name={me.name} onChange={changePhoto} disabled={uploading} error={photoError} />
        ) : (
          <Avatar uri={profile.photoUrl} name={profile.name ?? '?'} size={112} />
        )}
        <Text style={styles.name}>{profile.name ?? UNAVAILABLE}</Text>
      </View>

      <View style={styles.card}>
        {fields.map((field) => (
          <View key={field.label} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <Text style={[styles.value, !field.value && styles.unavailable]}>{field.value ?? UNAVAILABLE}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  header: { alignItems: 'center', gap: spacing.md },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.lg },
  field: { gap: 2 },
  label: { color: colors.textMuted, fontSize: 13 },
  value: { color: colors.text, fontSize: 16 },
  unavailable: { color: colors.textMuted, fontStyle: 'italic' },
});
