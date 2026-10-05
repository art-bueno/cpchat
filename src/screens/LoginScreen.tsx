import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorMessage } from '../components/ErrorMessage';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing } from '../theme';
import type { AuthScreenProps } from '../types/navigation';
import { getErrorMessage } from '../utils/errors';
import { isValidEmail } from '../utils/formValidation';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldErrors = useMemo(
    () => ({
      email: isValidEmail(email) ? null : 'Informe um e-mail válido.',
      password: password.length > 0 ? null : 'Informe a senha.',
    }),
    [email, password],
  );
  const isValid = !fieldErrors.email && !fieldErrors.password;

  const handleLogin = useCallback(async () => {
    setSubmitted(true);
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível entrar.'));
      setLoading(false);
    }
  }, [email, password, isValid, login]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>cpChat</Text>
            <Text style={styles.subtitle}>Entre com seu e-mail e senha</Text>
          </View>

          {error ? <ErrorMessage message={error} onDismiss={() => setError(null)} /> : null}

          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={submitted ? fieldErrors.email : null}
          />
          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            error={submitted ? fieldErrors.password : null}
            onSubmitEditing={handleLogin}
          />

          <PrimaryButton title="Entrar" onPress={handleLogin} loading={loading} />
          <PrimaryButton title="Criar conta" variant="secondary" onPress={() => navigation.navigate('Register')} disabled={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: 36, fontWeight: '800', color: colors.primary },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs },
});
