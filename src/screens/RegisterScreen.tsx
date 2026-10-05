import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { ErrorMessage } from '../components/ErrorMessage';
import { ImagePickerField } from '../components/ImagePickerField';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing } from '../theme';
import type { AuthScreenProps } from '../types/navigation';
import type { PickedImage } from '../types/user';
import { getErrorMessage } from '../utils/errors';
import { brDateToIso, formatDateInput, formatPhoneInput, isValidEmail, phoneToE164 } from '../utils/formValidation';

type FormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  birthDate: string;
};

type FieldErrors = Partial<Record<keyof FormValues | 'photo', string>>;

const INITIAL_VALUES: FormValues = { name: '', email: '', password: '', confirmPassword: '', phone: '', birthDate: '' };

function validate(values: FormValues, photo: PickedImage | null): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 2) errors.name = 'Informe seu nome (mínimo 2 letras).';
  if (!isValidEmail(values.email)) errors.email = 'Informe um e-mail válido.';
  if (values.password.length < 6) errors.password = 'A senha precisa ter pelo menos 6 caracteres.';
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'As senhas não conferem.';
  if (!phoneToE164(values.phone)) errors.phone = 'Informe DDD + número.';
  if (!brDateToIso(values.birthDate)) errors.birthDate = 'Data inválida (DD/MM/AAAA).';
  if (!photo) errors.photo = 'Escolha uma foto de perfil.';
  return errors;
}

export function RegisterScreen(_props: AuthScreenProps<'Register'>) {
  const { register } = useAuth();
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => validate(values, photo), [values, photo]);
  const shown = submitted ? errors : {};

  // Atualização imutável de um único campo, com tipagem por chave.
  const setField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitted(true);
    const phoneNumber = phoneToE164(values.phone);
    const birthDate = brDateToIso(values.birthDate);
    if (Object.keys(errors).length > 0 || !phoneNumber || !birthDate) return;

    setLoading(true);
    setError(null);
    try {
      const result = await register({ name: values.name, email: values.email, password: values.password, phoneNumber, birthDate, photo });
      // A navegação troca sozinha para a área logada; avisos aparecem como alerta.
      if (result.warnings.length > 0) Alert.alert('Atenção', result.warnings.join('\n'));
    } catch (err) {
      const message = getErrorMessage(err, 'Não foi possível criar a conta.');
      setError(message);
      setLoading(false);
      // Se a conta chegou a ser criada e foi desfeita, esta tela pode ter sido desmontada — o alerta garante o feedback.
      Alert.alert('Cadastro não concluído', message);
    }
  }, [errors, photo, register, values]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <ErrorMessage message={error} onDismiss={() => setError(null)} /> : null}

        <ImagePickerField label="Foto de perfil" value={photo} name={values.name} onChange={setPhoto} disabled={loading} error={shown.photo} />

        <TextField label="Nome" value={values.name} onChangeText={(t) => setField('name', t)} autoComplete="name" error={shown.name} />
        <TextField
          label="E-mail"
          value={values.email}
          onChangeText={(t) => setField('email', t)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={shown.email}
        />
        <TextField
          label="Celular"
          value={values.phone}
          onChangeText={(t) => setField('phone', formatPhoneInput(t))}
          keyboardType="phone-pad"
          placeholder="(11) 98765-4321"
          autoComplete="tel"
          error={shown.phone}
        />
        <TextField
          label="Data de nascimento"
          value={values.birthDate}
          onChangeText={(t) => setField('birthDate', formatDateInput(t))}
          keyboardType="number-pad"
          placeholder="DD/MM/AAAA"
          error={shown.birthDate}
        />
        <TextField label="Senha" value={values.password} onChangeText={(t) => setField('password', t)} secureTextEntry autoComplete="new-password" error={shown.password} />
        <TextField
          label="Confirmar senha"
          value={values.confirmPassword}
          onChangeText={(t) => setField('confirmPassword', t)}
          secureTextEntry
          error={shown.confirmPassword}
        />

        <PrimaryButton title="Criar conta" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
});
