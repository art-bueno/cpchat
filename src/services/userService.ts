import {
  collection,
  doc,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ChatUser, PickedImage, UserDirectoryEntry } from '../types/user';
import { firestore } from './firebase';
import { parseChatUser, parseDirectoryEntry } from './parsers';
import { uploadImage } from './storageService';

const DIRECTORY_PAGE_SIZE = 300;
/** Limite do operador `in` do Firestore. */
const IN_QUERY_CHUNK = 30;

export function subscribeToOwnProfile(
  uid: string,
  onData: (profile: ChatUser | null) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, 'users', uid),
    (snapshot) => onData(snapshot.exists() ? parseChatUser(uid, snapshot.data()) : null),
    onError,
  );
}

export function subscribeToUserDirectory(
  onData: (users: UserDirectoryEntry[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const directoryQuery = query(collection(firestore, 'userDirectory'), orderBy('nameLower'), limit(DIRECTORY_PAGE_SIZE));
  return onSnapshot(
    directoryQuery,
    (snapshot) => {
      const users = snapshot.docs
        .map((document) => parseDirectoryEntry(document.id, document.data()))
        .filter((user): user is UserDirectoryEntry => user !== null);
      onData(users);
    },
    onError,
  );
}

/** Escuta um conjunto específico de usuários (ex.: integrantes de um grupo), em lotes de 30. */
export function subscribeToDirectoryEntries(
  uids: readonly string[],
  onData: (users: Map<string, UserDirectoryEntry>) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const unique = [...new Set(uids)];
  if (unique.length === 0) {
    onData(new Map());
    return () => undefined;
  }

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_QUERY_CHUNK) chunks.push(unique.slice(i, i + IN_QUERY_CHUNK));

  const results = new Map<number, UserDirectoryEntry[]>();
  const emit = () => onData(new Map([...results.values()].flat().map((user) => [user.uid, user])));

  const unsubscribers = chunks.map((chunk, index) =>
    onSnapshot(
      query(collection(firestore, 'userDirectory'), where(documentId(), 'in', chunk)),
      (snapshot) => {
        results.set(
          index,
          snapshot.docs.map((d) => parseDirectoryEntry(d.id, d.data())).filter((u): u is UserDirectoryEntry => u !== null),
        );
        if (results.size === chunks.length) emit();
      },
      onError,
    ),
  );

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function updateOwnPhoto(uid: string, image: PickedImage): Promise<string> {
  const photoUrl = await uploadImage({ target: 'profile' }, image);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'users', uid), { photoUrl });
  batch.update(doc(firestore, 'userDirectory', uid), { photoUrl, updatedAt: Date.now() });
  await batch.commit();
  return photoUrl;
}
