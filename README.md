# cpChat

App de chat em React Native (Expo + TypeScript) com conversas individuais e em grupo, mensagens sincronizadas em tempo real e notificações push. O backend é o Firebase: Authentication para login com e-mail e senha, Realtime Database para as mensagens e Cloud Firestore para perfis, grupos e configurações. O envio dos pushes fica numa API própria em Node.js, publicada no Render, que usa o Firebase Admin SDK e o Firebase Cloud Messaging.

Trabalho da disciplina de Mobile (3ESPX), FIAP.

## Integrantes

- RM558396 - Arthur Bueno de Oliveira
- RM555187 - João Vitor Carotta Ribeiro
- RM556729 - Victor Magdaleno Marcos

## Como testar

- APK Android (81 MB): https://expo.dev/artifacts/eas/smFBPfEjgaJYWDe8iXo_B1P3K9Bkbq5IeicNfvx_YX8.apk
- API: https://cpchat.onrender.com
- Health check: https://cpchat.onrender.com/health

O APK roda sozinho, sem Expo Go e sem servidor local: a configuração do Firebase e a URL da API já vão embutidas no build. Basta instalar em um Android físico (liberando "instalar apps desconhecidos"), criar uma conta e aceitar a permissão de notificações.

Para ver o push funcionando é preciso uma segunda conta logada em outro aparelho. Com o app do destinatário fechado, envie uma mensagem: a notificação chega e o toque nela abre a conversa.

A API está no plano gratuito do Render, que hiberna depois de alguns minutos sem tráfego. Para evitar isso, um monitor do UptimeRobot chama o `/health` a cada 5 minutos.

## Tecnologias

**App:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6 (`strict` e `noUncheckedIndexedAccess`), Firebase JS SDK 12, React Navigation 7 (native-stack com parâmetros tipados), expo-notifications, expo-image-picker, expo-file-system e expo-dev-client.

**API:** Node.js 22, Express 5, TypeScript, Firebase Admin SDK 14, Zod para validar as requisições, Helmet e express-rate-limit.

**Infra:** Render para hospedar a API e Cloudinary para as imagens.

## Arquitetura

Cada serviço tem um papel bem definido:

- **Authentication**: cadastro e login por e-mail e senha. A sessão fica persistida no AsyncStorage, então o usuário continua logado ao reabrir o app. Todo o resto identifica o usuário pelo `uid`.
- **Realtime Database**: guarda todas as mensagens em `messages/{conversationId}/{messageId}`. O chat aberto escuta esse nó com `onValue`, e o listener é removido ao sair da tela ou fazer logout. Também existe o nó `groupMembers/{groupId}`, um espelho dos integrantes usado pelas regras (detalhado em [Segurança](#segurança)).
- **Firestore**: `users` (perfil completo), `userDirectory` (só nome e foto, para a busca de usuários), `groups` (nome, foto, dono, integrantes, `memberLimit` e `notificationPolicy`), `directConversations` (pares de usuários e a política de push da conversa), `users/{uid}/devices` (tokens de push) e `notificationDispatches` (controle para não enviar o mesmo push duas vezes).
- **Cloud Messaging**: entrega das notificações no Android, inclusive com o app fechado.
- **API**: tudo que precisa de privilégio administrativo ou que cruza os dois bancos. Valida o usuário, confere a mensagem, calcula os destinatários e dispara o push. Também mantém o espelho de integrantes, entrega perfis de terceiros com controle de acesso e assina os uploads de imagem.

O caminho de uma mensagem, do envio ao push:

1. O app grava a mensagem no Realtime Database. As regras conferem se o remetente é o usuário logado, se ele participa da conversa e se o `createdAt` é o horário do servidor.
2. Os listeners atualizam a conversa em todos os aparelhos que estão com ela aberta.
3. Com a mensagem salva, o app chama `POST /notifications/messages` enviando apenas `conversationId` e `messageId`, junto com o ID token do usuário.
4. A API valida o token, lê a mensagem no RTDB, confirma que o autor é quem fez a chamada e busca no Firestore os participantes, a política e os tokens.
5. A API calcula quem deve receber e envia pelo FCM. Tokens que o FCM recusar são desativados.

## Estrutura

```text
.
├── App.tsx
├── firebaseConfig.json        configuração do SDK cliente
├── google-services.json       configuração do app Android (FCM)
├── firebase/                  regras do Firestore e do Realtime Database
├── src/
│   ├── components/            Avatar, ChatInput, ChatMessage, ConversationItem, GroupMemberItem, ...
│   ├── screens/               Login, Register, Conversations, Users, GroupForm, Chat, GroupMembers, Profile
│   ├── services/              firebase, auth, user, group, chat, notification, storage, apiClient, parsers
│   ├── hooks/                 useAuth, useChat, useGroup, useConversations, useNotifications, useUsers
│   ├── contexts/              AuthContext, NotificationContext
│   ├── navigation/            stacks tipados e navegação a partir do push
│   ├── types/                 user, chat, group, notification, navigation
│   └── utils/                 conversationId, groupValidation, mentions, formValidation, errors, guards
└── server/
    └── src/
        ├── app.ts, index.ts, config.ts
        ├── middleware/        autenticação via ID token
        ├── routes/            notifications, groups, users, uploads
        └── services/          firebaseAdmin, dataAccess, recipientResolver, notificationSender, cloudinarySignature
```

O projeto não usa `any`: o ESLint trata `@typescript-eslint/no-explicit-any` como erro. Os dados lidos do Firebase chegam como `unknown` e passam pelos parsers em `src/services/parsers.ts` antes de virar tipo de domínio.

## Rodando o app

Pré-requisitos: Node 22, uma conta na Expo e um Android físico.

```bash
npm install
cp .env.example .env    # EXPO_PUBLIC_API_URL=https://cpchat.onrender.com
```

O Expo Go não recebe push remoto no Android desde o SDK 53, por isso o desenvolvimento é feito com um development build gerado pelo EAS:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

Com o APK instalado no celular:

```bash
npx expo start --dev-client
```

O APK de distribuição, que funciona sem o computador, sai do perfil `preview`:

```bash
npx eas-cli@latest build --profile preview --platform android
```

Para os builds na nuvem, a URL da API vem do `eas.json`, já que o `.env` não é versionado.

Checagens de qualidade:

```bash
npm run typecheck
npm run lint
```

## Configuração do Firebase

1. Criar o projeto no console do Firebase e ativar em Authentication apenas o provedor **E-mail/senha**.
2. Criar o Firestore (modo produção, `southamerica-east1`) e o Realtime Database (modo bloqueado, `us-central1`).
3. Registrar um app Web e copiar a configuração para o `firebaseConfig.json`.
4. Registrar um app Android com o pacote `br.com.fiap.cpchat` e colocar o `google-services.json` na raiz. Os dois arquivos só identificam o projeto, não dão acesso administrativo, por isso ficam no repositório.
5. Publicar as regras:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,database
```

6. Criar a credencial da API. Em vez da conta padrão `firebase-adminsdk`, que tem permissões bem amplas, criamos no Google Cloud a conta de serviço `cpchat-api` só com o que a API precisa:

| Papel | Para quê |
|---|---|
| Firebase Authentication Viewer | validar o ID token |
| Cloud Datastore User | ler e gravar no Firestore |
| Firebase Realtime Database Admin | ler mensagens e gravar o espelho de integrantes |
| Firebase Cloud Messaging API Admin | enviar os pushes |

A chave dessa conta existe apenas nas variáveis de ambiente do Render. Ela não está no repositório nem no app.

Não foi preciso criar índices compostos: as consultas usam só `array-contains`, igualdade e `orderBy` em um campo.

## Fotos

As fotos de perfil e de grupo ficam no **Cloudinary**. O Firebase Storage exige o plano pago (Blaze) em projetos novos, e o enunciado permite outro serviço desde que só a URL vá para o Firestore.

O upload é assinado, para que o segredo do Cloudinary nunca chegue ao app:

1. O usuário escolhe a imagem com o `expo-image-picker`. Se a permissão da galeria for negada, o app explica e indica as configurações do aparelho.
2. O app pede uma assinatura em `POST /uploads/signature`. A API só assina a foto de perfil do próprio usuário ou a foto de um grupo do qual ele é dono.
3. A assinatura fixa o caminho do arquivo, os formatos aceitos e um redimensionamento máximo de 800x800. O app envia o arquivo direto para o Cloudinary.
4. A `secure_url` devolvida é gravada no Firestore. As regras só aceitam URLs que começam com `https://res.cloudinary.com/`, o que bloqueia Base64 e links arbitrários.

Quando não há foto, ou ela falha ao carregar, o componente `Avatar` mostra as iniciais do nome.

Para configurar, basta copiar o Cloud name, a API Key e o API Secret do painel do Cloudinary para as variáveis `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` da API.

## Notificações

No **Android**, o app registra o token nativo do FCM (`getDevicePushTokenAsync`) e a API envia com `messaging.sendEach` do Admin SDK. O canal `messages`, de importância alta, é criado antes de pedir a permissão, o que é exigido a partir do Android 13.

No **iOS**, o app registra um Expo push token e a API envia pelo Expo Push Service, que entrega via APNs. O código está pronto, mas gerar um build iOS com push exige uma conta Apple Developer (US$ 99/ano), que a equipe não tem. Por isso o push foi validado apenas em Android físico. Com a conta, bastaria rodar `eas build --platform ios`, porque o `projectId` do EAS já está no `app.json`.

Outros pontos:

- Os tokens ficam em `users/{uid}/devices/{deviceId}`, legíveis só pelo dono. Se o token mudar, ele é regravado; no logout, o registro do aparelho é apagado.
- O payload sempre leva `conversationId` e `conversationType`. Tocando na notificação, com o app aberto, em segundo plano ou fechado, o app abre a conversa certa.
- O texto da notificação não inclui o conteúdo da mensagem, só quem enviou ("Arthur enviou uma mensagem"), para não expor nada na tela bloqueada.
- Se a permissão for negada, ou o aparelho não tiver token, a tela de conversas mostra um aviso com atalho para as configurações.

## API

URL pública: https://cpchat.onrender.com

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check, não exige autenticação |
| POST | `/notifications/messages` | Recebe `{ conversationId, messageId }`, valida e envia o push. Se chamado de novo para a mesma mensagem, responde `{ "duplicate": true }` sem reenviar |
| POST | `/groups/:groupId/sync-members` | Copia os integrantes do Firestore para o Realtime Database |
| GET | `/users/:uid/profile` | Perfil completo de outro usuário, desde que haja conversa ou grupo em comum (caso contrário, 403) |
| POST | `/uploads/signature` | Assinatura de upload do Cloudinary (`{ target: "profile" }` ou `{ target: "group", groupId }`) |

Todas as rotas, exceto `/health`, exigem o header `Authorization: Bearer <ID token do Firebase>`. O token é validado com `verifyIdToken` do Admin SDK, com checagem de revogação.

A lista de destinatários nunca vem do app. Ela é montada no servidor a partir do Firestore ([`recipientResolver.ts`](server/src/services/recipientResolver.ts), que tem testes). Para evitar push duplicado, antes do envio a API cria o documento `notificationDispatches/{conversationId}__{messageId}` com `create()`, operação que falha se o documento já existir. Assim, duas chamadas simultâneas para a mesma mensagem não disparam dois pushes.

### Variáveis de ambiente

`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` e, opcionalmente, `EXPO_ACCESS_TOKEN`. Os nomes estão em [`server/.env.example`](server/.env.example); os valores reais ficam somente no Render.

### Deploy no Render

Web Service no plano gratuito, região Virginia, com deploy automático a cada push na `master`:

| Campo | Valor |
|---|---|
| Root Directory | `server` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Além das variáveis acima, é preciso definir `NODE_VERSION=22`. A `FIREBASE_PRIVATE_KEY` é colada inteira, de `-----BEGIN PRIVATE KEY-----` até `-----END PRIVATE KEY-----`. O [`render.yaml`](render.yaml) cria o mesmo serviço via Blueprint, caso prefira.

Para rodar a API localmente:

```bash
cd server
npm install
cp .env.example .env    # preencher com as credenciais
npm run dev
npm test
```

## Política de notificações

Cada grupo tem uma política definida pelo dono na tela de edição:

| Política | Quem recebe push |
|---|---|
| `all_group_messages` | Todos os integrantes, menos quem enviou |
| `mentioned_members` | Só quem foi mencionado com `@` ou escolhido no campo "Para:" |
| `direct_messages_only` | Ninguém: mensagens do grupo não geram push, só as conversas individuais |
| `disabled` | Ninguém |

Nas conversas individuais, o outro participante é notificado, a não ser que um dos dois desligue o sino no topo do chat (a conversa passa a ter a política `disabled`).

Em qualquer caso, quem enviou nunca recebe o próprio push, e apenas os integrantes atuais são considerados. Alguém removido do grupo, ou mencionado sem fazer parte dele, não é notificado.

## Limite de integrantes

O limite (`memberLimit`) é definido na criação do grupo e vale de 2 a 50, contando o dono. O dono pode alterá-lo depois, mas não para um número menor que a quantidade atual de integrantes. A tela mostra quantos integrantes há e quantas vagas restam, e não deixa selecionar mais gente quando o grupo está cheio.

A interface é só a primeira barreira. A garantia está no banco:

1. Toda alteração de integrantes roda dentro de `runTransaction` no Firestore. A transação lê o grupo, aplica a mudança como diferença (quem entra e quem sai) e valida o limite. Se outro dispositivo alterar o grupo no meio do caminho, o Firestore repete a transação com os dados atualizados.
2. As regras do Firestore validam o documento final de qualquer escrita: `memberIds.size() <= memberLimit`, sem ids repetidos e com o dono na lista. Mesmo com requisições concorrentes, ou com um cliente modificado, a escrita que passaria do limite é rejeitada.

## Segurança

As regras estão versionadas em [`firebase/firestore.rules`](firebase/firestore.rules) e [`firebase/database.rules.json`](firebase/database.rules.json).

- Nada é acessível sem autenticação. A raiz do Realtime Database é fechada para leitura e escrita.
- Mensagens só podem ser lidas e escritas por participantes. Em conversas individuais, a participação é verificada pelo próprio id da conversa (`dm_<uid1>_<uid2>`, com os uids ordenados, o que também impede duas conversas para o mesmo par). Nos grupos, pelo nó `groupMembers`.
- Na gravação, o `senderId` precisa ser o usuário autenticado, o `createdAt` precisa ser o horário do servidor, e o texto tem de 1 a 2000 caracteres. Mensagens não podem ser editadas depois.
- Grupos só podem ser lidos pelos integrantes e alterados ou excluídos pelo dono.
- `users/{uid}` só é lido pelo próprio usuário. Para ver o perfil de outra pessoa, o app passa pela API, que confere se existe conversa ou grupo em comum. A busca de usuários usa o `userDirectory`, que tem apenas nome e foto.
- Tokens de dispositivos só são acessíveis pelo dono, e a coleção `notificationDispatches` é fechada para os clientes.

Uma limitação influenciou o desenho: as regras do Realtime Database não conseguem consultar o Firestore. Como os integrantes de um grupo estão no Firestore e as mensagens no RTDB, a API mantém o espelho `groupMembers/{groupId}`, que só ela pode escrever (pelo Admin SDK), atualizado a cada criação, edição ou exclusão de grupo. Quando alguém é removido, o espelho muda e a pessoa perde na hora o acesso às mensagens novas. Pelo mesmo motivo, as validações do push, que dependem dos dois bancos, também ficam na API.

## Telas

Capturas de um Android físico rodando o development build. O botão flutuante de engrenagem é o menu de desenvolvimento do Expo e não aparece no APK de distribuição.

| Login | Cadastro | Usuários | Perfil |
|---|---|---|---|
| <img src="docs/prints/login.jpg" width="200"> | <img src="docs/prints/cadastro.jpg" width="200"> | <img src="docs/prints/usuarios.jpg" width="200"> | <img src="docs/prints/perfil.jpg" width="200"> |
| Erro de credencial | Foto, celular e data de nascimento | Busca; o próprio usuário não aparece | Aberto pela foto do participante |

| Conversas | Conversas (grupo) | Novo grupo | Chat |
|---|---|---|---|
| <img src="docs/prints/conversas.jpg" width="200"> | <img src="docs/prints/conversas-grupo.jpg" width="200"> | <img src="docs/prints/grupo.jpg" width="200"> | <img src="docs/prints/chat.jpg" width="200"> |
| Conversa individual com prévia da última mensagem | Grupo identificado pela etiqueta | Limite 3 atingido e política de push | Mensagem sincronizada em tempo real |

## Notificação recebida

<img src="docs/prints/push.jpg" width="250">

Notificação recebida com o app fechado, na tela de bloqueio de um Android físico. Ela foi enviada pela API via FCM depois de uma mensagem individual. Como dito acima, a notificação mostra só o remetente, sem o conteúdo da mensagem.
