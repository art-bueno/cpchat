/** Lê e valida as variáveis de ambiente. Segredos existem SOMENTE nas variáveis da hospedagem (Render). */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  firebase: {
    projectId: required('FIREBASE_PROJECT_ID'),
    clientEmail: required('FIREBASE_CLIENT_EMAIL'),
    // A chave chega com "\n" literais quando colada no painel da hospedagem.
    privateKey: required('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    databaseURL: required('FIREBASE_DATABASE_URL'),
  },
  /** Opcional: só necessário se "Enhanced push security" estiver ativo no projeto Expo. */
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || null,
  androidChannelId: 'messages',
} as const;
