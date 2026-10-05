import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import type { ChatUser, LoginInput, RegisterInput, UserDirectoryEntry } from '../types/user';
import { auth, firestore } from './firebase';
import { uploadImage } from './storageService';

export type RegisterResult = { warnings: string[] };

/**
 * Cadastro: cria a conta (Auth) → envia a foto (Cloudinary, upload assinado pela API) → grava perfil privado e entrada pública (Firestore).
 * Se o perfil não puder ser gravado, a conta recém-criada é removida para não deixar usuário "órfão".
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const credential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  const { uid } = credential.user;
  const warnings: string[] = [];

  let photoUrl = '';
  if (input.photo) {
    try {
      photoUrl = await uploadImage({ target: 'profile' }, input.photo);
    } catch {
      warnings.push('Conta criada, mas a foto não pôde ser enviada. Você pode alterá-la no seu perfil.');
    }
  }

  const now = Date.now();
  const name = input.name.trim();
  const profile: ChatUser = {
    uid,
    name,
    email: credential.user.email ?? input.email.trim(),
    phoneNumber: input.phoneNumber,
    birthDate: input.birthDate,
    photoUrl,
    createdAt: now,
  };
  const directoryEntry: UserDirectoryEntry = { uid, name, nameLower: name.toLowerCase(), photoUrl, updatedAt: now };

  try {
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'users', uid), profile);
    batch.set(doc(firestore, 'userDirectory', uid), directoryEntry);
    await batch.commit();
  } catch (error) {
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }

  return { warnings };
}

export async function login({ email, password }: LoginInput): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export function logout(): Promise<void> {
  return signOut(auth);
}

export function observeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
