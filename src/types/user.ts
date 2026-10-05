/** Perfil completo (privado) — Firestore `users/{uid}`. Só o próprio usuário lê direto; terceiros via API. */
export type ChatUser = {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  /** ISO `YYYY-MM-DD` */
  birthDate: string;
  photoUrl: string;
  createdAt: number;
};

/**
 * Entrada pública mínima — Firestore `userDirectory/{uid}`.
 * Contém apenas o necessário para listar/buscar usuários (sem e-mail, celular ou nascimento).
 */
export type UserDirectoryEntry = {
  uid: string;
  name: string;
  nameLower: string;
  photoUrl: string;
  updatedAt: number;
};

export type PublicUser = Pick<UserDirectoryEntry, 'uid' | 'name' | 'photoUrl'>;

/** Perfil retornado pela API (`GET /users/:uid/profile`) — campos podem estar indisponíveis. */
export type UserProfileView = {
  uid: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  birthDate: string | null;
  photoUrl: string | null;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  birthDate: string;
  photo: PickedImage | null;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type PickedImage = {
  uri: string;
  mimeType: string;
};
