# 💬 cpChat — Chat individual e em grupo com Firebase e Push Notifications

Aplicativo de chat em **React Native + Expo + TypeScript** com conversas individuais e em grupo, mensagens em tempo real no **Firebase Realtime Database**, perfis/grupos/configurações no **Cloud Firestore**, autenticação por **e-mail e senha** e notificações push enviadas por uma **API própria** (Node.js + Express) usando **Firebase Cloud Messaging**.

## 👥 Integrantes

> ⚠️ **Preencher antes da entrega** — sem nome e RM de todos os integrantes o trabalho recebe nota zero.

- RM00000 — Nome Completo
- RM00000 — Nome Completo

---

## 🧰 Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| App | Expo SDK | **57** (`expo ~57.0.26`) |
| App | React Native / React | 0.86 / 19.2 |
| App | TypeScript | 6.0 (`strict` + `noUncheckedIndexedAccess`) |
| App | Firebase JS SDK (Auth, Firestore, Realtime Database) | 12.x |
| App | expo-notifications, expo-image-picker, expo-dev-client | SDK 57 |
| App | React Navigation (native-stack, parâmetros tipados) | 7.x |
| API | Node.js + Express + TypeScript | Node 22 / Express 5 |
| API | Firebase Admin SDK (Auth, Firestore, RTDB, **FCM**) | 14.x |
| API | Zod (validação), Helmet, express-rate-limit | — |
| Hospedagem API | Render (Web Service, HTTPS) | — |
| Imagens | **Cloudinary** (plano gratuito, upload assinado pela API) | — |

---

## 🔥 Responsabilidade de cada serviço

| Serviço | O que guarda / faz |
|---|---|
| **Firebase Authentication** | Cadastro e login **somente e-mail/senha**, sessão persistida (AsyncStorage), `uid`, logout. |
| **Realtime Database** | **Todas as mensagens** (`messages/{conversationId}/{messageId}`), listeners em tempo real e o espelho `groupMembers/{groupId}` (usado pelas regras). |
| **Cloud Firestore** | Perfis (`users`), diretório público (`userDirectory`), grupos + integrantes + `memberLimit` + `notificationPolicy` (`groups`), conversas individuais e sua política (`directConversations`), tokens de dispositivos (`users/{uid}/devices`), controle de idempotência do push (`notificationDispatches`). |
| **Firebase Cloud Messaging** | Entrega do push no Android (app em segundo plano/fechado). Payload contém `conversationId` e `conversationType`. |
| **Cloudinary** | Fotos de perfil e de grupo. No Firestore fica **apenas a URL** (nunca Base64). |
| **API própria (Render)** | Valida o ID token, confere a mensagem no RTDB e participantes/política no Firestore, calcula destinatários e envia o push. Também sincroniza o espelho de integrantes, serve perfis com controle de acesso e assina uploads de imagem. |

### Fluxo de uma mensagem

```text
Usuário envia → RTDB persiste (regras validam senderId, participação, timestamp do servidor)
      ↓
Listeners (onValue) atualizam a conversa aberta em todos os aparelhos
      ↓
App chama POST /notifications/messages { conversationId, messageId } com o ID token
      ↓
API: verifyIdToken → lê a mensagem no RTDB (senderId == usuário?) → lê grupo/conversa no Firestore
     → trava de idempotência → calcula destinatários pela política → FCM (Android) / Expo Push (iOS)
     → desativa tokens inválidos
```

---

## 🗂️ Estrutura do projeto

```text
.
├── App.tsx                      # Providers + navegação
├── firebaseConfig.json          # Config do SDK CLIENTE (sem segredos)
├── google-services.json         # Config cliente Android/FCM (adicionar — ver abaixo)
├── firebase/
│   ├── firestore.rules          # Regras do Firestore
│   └── database.rules.json      # Regras do Realtime Database
├── firebase.json / .firebaserc  # Deploy das regras via Firebase CLI
├── render.yaml                  # Blueprint da API no Render
├── src/
│   ├── components/              # Avatar, ChatInput, ChatMessage, ConversationItem, GroupMemberItem,
│   │                            # ImagePickerField, Loading, ErrorMessage, EmptyState, PolicySelector, ...
│   ├── screens/                 # Login, Register, Conversations, Users, GroupForm, Chat, GroupMembers, Profile
│   ├── services/                # firebase, authService, userService, groupService, chatService,
│   │                            # notificationService, storageService (Cloudinary), apiClient, parsers
│   ├── hooks/                   # useAuth, useChat, useGroups, useConversations, useNotifications, useUsers, ...
│   ├── contexts/                # AuthContext, NotificationContext
│   ├── navigation/              # RootNavigator (stacks tipados) + navigationRef (abrir chat pelo push)
│   ├── types/                   # user, chat, group, notification, navigation
│   └── utils/                   # conversationId, groupValidation, mentions, formValidation, errors, guards
└── server/
    └── src/
        ├── app.ts / index.ts
        ├── middleware/authenticate.ts
        ├── routes/notifications.ts, groups.ts, users.ts, uploads.ts
        └── services/firebaseAdmin.ts, dataAccess.ts, recipientResolver.ts, notificationSender.ts, cloudinarySignature.ts (+ testes)
```

---

## ⚙️ Configuração do Firebase

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Authentication → Sign-in method →** habilite apenas **E-mail/senha**.
3. **Firestore Database →** criar (modo produção).
4. **Realtime Database →** criar (modo bloqueado).
5. **Configurações do projeto → Seus apps:**
   - Adicione um app **Web** e copie a configuração para [`firebaseConfig.json`](firebaseConfig.json) (este arquivo **deve** ficar no GitHub).
   - Adicione um app **Android** com o pacote `br.com.fiap.cpchat`, baixe o **`google-services.json`** e coloque na raiz do projeto (é configuração de cliente, pode ser versionado).
   - (iOS) Adicione um app iOS com o bundle `br.com.fiap.cpchat` se desejar; o push no iOS é entregue via Expo Push Service/APNs.
6. Publique as regras:

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase deploy --only firestore:rules,database
```

7. **Conta de serviço da API:** Configurações do projeto → Contas de serviço → *Gerar nova chave privada*. **Não salve no repositório**: copie `project_id`, `client_email` e `private_key` direto para as variáveis secretas do Render (abaixo) e apague o arquivo baixado.

> Nenhum índice composto é necessário: as consultas usam apenas `array-contains`, `orderBy` em um campo e `where` de igualdade.

---

## 🖼️ Armazenamento de fotos — Cloudinary

Escolhemos o **Cloudinary** (plano gratuito, sem cartão) no lugar do Firebase Storage, que em projetos novos exige o plano pago Blaze.

Fluxo (upload **assinado** — o `api_secret` nunca vai para o app):

1. O usuário escolhe a foto com `expo-image-picker` (permissão solicitada e tratada; se negada, o app orienta a abrir as configurações).
2. O app chama `POST /uploads/signature` na nossa API com o ID token. A API só assina se for a **própria foto de perfil** ou a foto de um **grupo do qual o usuário é proprietário** (conferido no Firestore).
3. A assinatura fixa o destino (`cpchat/users/{uid}/profile` ou `cpchat/groups/{groupId}/photo`), os formatos aceitos (jpg/png/webp/heic) e o redimensionamento (máx. 800×800). O app envia o arquivo direto para `api.cloudinary.com`.
4. O Cloudinary devolve a `secure_url` (HTTPS) e **somente essa URL** é gravada no Firestore. As regras do Firestore só aceitam URLs `https://res.cloudinary.com/...` — Base64 ou links arbitrários são rejeitados.
5. Sem foto ou com erro de carregamento, o componente `Avatar` exibe uma imagem padrão (iniciais).

**Configuração:** crie uma conta grátis em <https://cloudinary.com>, abra **Dashboard → API Keys** e copie *Cloud name*, *API Key* e *API Secret* para as variáveis `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` no Render (seção da API). Nada do Cloudinary fica no app nem no repositório.

---

## 🔔 Configuração das notificações

| Plataforma | Token salvo | Como a API envia |
|---|---|---|
| **Android** | Token nativo **FCM** (`getDevicePushTokenAsync`) — `provider: "fcm"` | `firebase-admin/messaging` → `sendEach` (FCM HTTP v1) |
| **iOS** | Expo push token (`getExpoPushTokenAsync`) — `provider: "expo"` | Expo Push Service → APNs |

- Canal Android `messages` (importância alta) criado antes do pedido de permissão (Android 13+).
- Tokens ficam em `users/{uid}/devices/{deviceId}` (legível só pelo dono). Rotação de token é tratada (`addPushTokenListener`). No logout o dispositivo é removido.
- Toque na notificação (app aberto, em segundo plano ou **fechado**) abre a conversa usando `conversationId`/`conversationType` do payload.
- **Expo Go não serve** para push remoto no Android (SDK 53+). Use um **development build**:

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas init
```

```bash
eas build --profile development --platform android
```

Instale o APK gerado no **aparelho físico** e rode:

```bash
npx expo start --dev-client
```

**iOS (adicional):** requer conta Apple Developer. `eas build --profile development --platform ios` configura a chave de push (APNs) nas credenciais do EAS; `eas init` grava o `projectId` usado para gerar o Expo push token.

---

## 🌐 API de notificações

- **Tecnologia:** Node.js 22 + Express 5 + TypeScript + Firebase Admin SDK.
- **URL pública:** **https://cpchat.onrender.com** (health check: <https://cpchat.onrender.com/health>)

### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | — | Health check (`{"status":"ok",...}`) |
| POST | `/notifications/messages` | Bearer ID token | Body `{ conversationId, messageId }`. Valida autor/participação, aplica a política e envia o push. Idempotente: reenvios retornam `{ "duplicate": true }`. |
| POST | `/groups/:groupId/sync-members` | Bearer ID token | Copia `memberIds` do Firestore para `groupMembers/{groupId}` no RTDB (usado pelas regras). |
| GET | `/users/:uid/profile` | Bearer ID token | Perfil completo somente se houver conversa individual ou grupo em comum (senão `403`). |
| POST | `/uploads/signature` | Bearer ID token | Body `{ target: "profile" }` ou `{ target: "group", groupId }`. Devolve a assinatura de upload do Cloudinary (só para a própria foto ou grupo do qual é dono). |

Verificar disponibilidade:

```bash
curl https://cpchat.onrender.com/health
```

### Variáveis de ambiente (somente os nomes — valores apenas no Render)

`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `EXPO_ACCESS_TOKEN` (opcional). Veja [`server/.env.example`](server/.env.example).

### Publicar no Render

A API está publicada como **Web Service** no Render (plano Free, região Virginia/US East), com deploy automático a cada push na branch `master`.

1. Render → **New → Web Service** → conecte o repositório no GitHub.
2. Configuração:

   | Campo | Valor |
   |---|---|
   | Language | Node |
   | Branch | `master` |
   | Root Directory | `server` |
   | Build Command | `npm ci && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |
   | Instance Type | Free |

3. **Environment Variables:** `NODE_VERSION=22` e as variáveis secretas listadas acima. A `FIREBASE_PRIVATE_KEY` é colada inteira (de `-----BEGIN PRIVATE KEY-----` a `-----END PRIVATE KEY-----`).
4. Após o deploy, teste `GET /health`. A URL pública vai em `EXPO_PUBLIC_API_URL` (`.env` para desenvolvimento e `eas.json` para os builds na nuvem).
5. **Disponibilidade:** o plano Free hiberna após 15 min sem tráfego. Um monitor do UptimeRobot chama `/health` a cada 5 min para manter a API sempre ativa durante a correção. O app também tolera até 60 s de "cold start".

> Alternativa: o arquivo [`render.yaml`](render.yaml) permite criar o mesmo serviço via **New → Blueprint**.

### Rodar localmente (opcional, só para desenvolvimento)

```bash
cd server && npm install && cp .env.example .env
```

```bash
npm run dev
```

```bash
npm test
```

---

## ▶️ Instalação e execução do app

```bash
npm install
```

```bash
cp .env.example .env
```

Edite `.env` com a URL da API, adicione `google-services.json`, gere o development build (seção de notificações) e rode `npx expo start --dev-client`.

Qualidade:

```bash
npm run typecheck
```

```bash
npm run lint
```

> O ESLint está configurado com `@typescript-eslint/no-explicit-any: error` — o projeto não usa `any`. Dados do Firebase entram como `unknown` e passam por parsers/type guards (`src/services/parsers.ts`).

---

## 🔔 Política de notificações

Configurada pelo proprietário na tela de grupo (Firestore `groups/{id}.notificationPolicy`). Os destinatários são **sempre calculados na API** ([`recipientResolver.ts`](server/src/services/recipientResolver.ts)), nunca enviados pelo app.

| Política | Quem recebe push em mensagens do grupo |
|---|---|
| `all_group_messages` | Todos os integrantes atuais, exceto o remetente (mencionados recebem o texto "mencionou você"). |
| `mentioned_members` | Somente quem foi mencionado com `@` ou escolhido como destinatário ("Para: Fulano"), se ainda for integrante. |
| `direct_messages_only` | Ninguém — mensagens de grupo não geram push; só conversas individuais. |
| `disabled` | Ninguém. |

Conversas individuais: o outro participante recebe push, a menos que um dos dois desative (🔔/🔕 no cabeçalho → `directConversations/{id}.notificationPolicy = "disabled"`).

Regras gerais: remetente nunca é notificado; apenas participantes atuais; tokens rejeitados pelo FCM/Expo são marcados `enabled: false`; o push **não inclui o texto da mensagem** (só "Fulano enviou uma mensagem"); chamadas repetidas para a mesma mensagem não geram push duplicado (`notificationDispatches/{conversationId}__{messageId}` criado com `create()` atômico).

---

## 👥 Limite de integrantes e proteção contra concorrência

- `memberLimit` é definido na criação (inteiro entre 2 e 50, incluindo o proprietário) e pode ser alterado pelo proprietário, nunca abaixo da quantidade atual.
- A interface mostra "X de Y integrantes · N vagas" e bloqueia a seleção quando não há vagas.
- **Proteção real (servidor):**
  1. Toda alteração de grupo é feita em **`runTransaction`** do Firestore: lê o estado atual, aplica o *delta* (adições/remoções) e valida o limite. Se outra escrita concorrente mudar o documento, o Firestore reexecuta a transação com os dados novos.
  2. As **regras do Firestore** validam o documento **resultante** de qualquer escrita: `memberIds.size() <= memberLimit`, `memberLimit >= 2`, sem duplicados, proprietário incluído. Mesmo duas requisições simultâneas (ou um cliente adulterado) não conseguem gravar um estado acima do limite — a escrita que ultrapassaria é rejeitada.

---

## 🔒 Regras de segurança

Arquivos versionados: [`firebase/firestore.rules`](firebase/firestore.rules) e [`firebase/database.rules.json`](firebase/database.rules.json). Uploads de imagem são autorizados pela API (assinatura Cloudinary).

- Tudo exige autenticação; raiz do RTDB fechada (`.read/.write: false`).
- **Mensagens (RTDB):** só participantes leem/escrevem. Conversa individual: participação verificada pelo id `dm_<uidA>_<uidB>`. Grupo: `groupMembers/{groupId}/{uid} === true`. `senderId === auth.uid`, `createdAt === now` (timestamp do servidor), texto 1–2000, mensagens imutáveis, destinatário/menções precisam ser integrantes.
- **Grupos (Firestore):** leitura só por integrantes; criação/edição/exclusão só pelo proprietário; limite validado no documento final.
- **Perfis:** `users/{uid}` só o dono lê; terceiros obtêm o perfil pela API, que exige conversa ou grupo em comum. Listagem usa `userDirectory` (apenas nome e foto).
- **Tokens:** `users/{uid}/devices` só o dono; `notificationDispatches` inacessível a clientes.

### Decisão: validações que cruzam Firestore e Realtime Database

As regras do RTDB não conseguem ler o Firestore. Por isso:
- O **Firestore é a fonte da verdade** dos integrantes; a **API** (Admin SDK) espelha `memberIds` em `groupMembers/{groupId}` no RTDB após criar/editar/excluir grupo. Esse nó é **somente leitura** para clientes. Ao remover alguém, o espelho é atualizado e o usuário perde imediatamente o acesso a novas mensagens.
- A **API** valida, antes do push, que a mensagem existe no RTDB, que o autor é o usuário do token e que ele participa da conversa no Firestore.
- O acesso a perfis de outros usuários (que depende de "conversa ou grupo em comum") também é decidido pela API.

---

## 📸 Prints das telas

> Adicionar em `docs/prints/` e referenciar aqui.

| Login | Cadastro | Conversas | Usuários |
|---|---|---|---|
| ![](docs/prints/login.png) | ![](docs/prints/cadastro.png) | ![](docs/prints/conversas.png) | ![](docs/prints/usuarios.png) |

| Grupo | Chat | Integrantes | Perfil |
|---|---|---|---|
| ![](docs/prints/grupo.png) | ![](docs/prints/chat.png) | ![](docs/prints/integrantes.png) | ![](docs/prints/perfil.png) |

## 📲 Evidência de notificação recebida

> Adicionar print/vídeo da notificação recebida com o app fechado e da conversa aberta pelo toque: `docs/prints/push.png`.

![](docs/prints/push.png)
