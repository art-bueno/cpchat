import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ChatGroup, CreateGroupInput, GroupChanges, GroupMutationResult } from '../types/group';
import type { NotificationPolicy } from '../types/notification';
import type { PickedImage } from '../types/user';
import { AppError, getErrorMessage } from '../utils/errors';
import { applyGroupChanges, validateGroupName, validateMemberCount, validateMemberLimit } from '../utils/groupValidation';
import { syncGroupMembers } from './apiClient';
import { firestore } from './firebase';
import { parseGroup } from './parsers';
import { storagePaths, uploadImage } from './storageService';

const groupsCollection = collection(firestore, 'groups');

function assertValid(...results: ReturnType<typeof validateGroupName>[]): void {
  for (const result of results) if (!result.valid) throw new AppError('invalid-argument', result.message);
}

/** Espelha os integrantes no RTDB. Falhas viram aviso: o Firestore já está correto e o chat tenta sincronizar de novo ao abrir. */
async function syncMembersSafely(groupId: string, warnings: string[]): Promise<void> {
  try {
    await syncGroupMembers(groupId);
  } catch (error) {
    warnings.push(`Grupo salvo, mas a sincronização do acesso às mensagens falhou: ${getErrorMessage(error)}`);
  }
}

async function uploadGroupPhoto(groupId: string, photo: PickedImage, warnings: string[]): Promise<void> {
  try {
    const photoUrl = await uploadImage(storagePaths.groupPhoto(groupId), photo);
    await updateDoc(doc(firestore, 'groups', groupId), { photoUrl, updatedAt: Date.now() });
  } catch (error) {
    warnings.push(`A foto do grupo não pôde ser salva: ${getErrorMessage(error)}`);
  }
}

export async function createGroup(input: CreateGroupInput): Promise<GroupMutationResult> {
  const memberIds = [...new Set([input.ownerId, ...input.memberIds])];
  assertValid(
    validateGroupName(input.name),
    validateMemberLimit(input.memberLimit, memberIds.length),
    validateMemberCount(memberIds.length, input.memberLimit),
  );

  const groupRef = doc(groupsCollection);
  const now = Date.now();
  const group: ChatGroup = {
    id: groupRef.id,
    name: input.name.trim(),
    // A foto é enviada depois que o grupo existe: a regra do Storage confere o ownerId no Firestore.
    photoUrl: '',
    ownerId: input.ownerId,
    memberIds,
    memberLimit: input.memberLimit,
    notificationPolicy: input.notificationPolicy,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(groupRef, group);

  const warnings: string[] = [];
  if (input.photo) await uploadGroupPhoto(group.id, input.photo, warnings);
  await syncMembersSafely(group.id, warnings);
  return { groupId: group.id, warnings };
}

/**
 * Toda alteração passa por uma transação: lê o estado atual, aplica o delta e valida o limite.
 * Se outra escrita concorrente mudar o documento, o Firestore reexecuta a transação com os dados novos.
 * As regras do Firestore validam o resultado final de novo (`memberIds.size() <= memberLimit`),
 * então nem um cliente adulterado consegue estourar o limite.
 */
export async function updateGroup(groupId: string, actorUid: string, changes: GroupChanges, photo?: PickedImage | null): Promise<GroupMutationResult> {
  const groupRef = doc(firestore, 'groups', groupId);
  const membersChanged = (changes.addMemberIds?.length ?? 0) > 0 || (changes.removeMemberIds?.length ?? 0) > 0;

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    const current = snapshot.exists() ? parseGroup(snapshot.id, snapshot.data()) : null;
    if (!current) throw new AppError('not-found', 'Grupo não encontrado.');
    const next = applyGroupChanges(current, changes, actorUid, Date.now());
    transaction.update(groupRef, {
      name: next.name,
      memberIds: next.memberIds,
      memberLimit: next.memberLimit,
      notificationPolicy: next.notificationPolicy,
      updatedAt: next.updatedAt,
    });
  });

  const warnings: string[] = [];
  if (photo) await uploadGroupPhoto(groupId, photo, warnings);
  if (membersChanged) await syncMembersSafely(groupId, warnings);
  return { groupId, warnings };
}

export const addMembers = (groupId: string, actorUid: string, memberIds: readonly string[]) =>
  updateGroup(groupId, actorUid, { addMemberIds: memberIds });

export const removeMember = (groupId: string, actorUid: string, memberId: string) =>
  updateGroup(groupId, actorUid, { removeMemberIds: [memberId] });

export const updateMemberLimit = (groupId: string, actorUid: string, memberLimit: number) =>
  updateGroup(groupId, actorUid, { memberLimit });

export const updateNotificationPolicy = (groupId: string, actorUid: string, notificationPolicy: NotificationPolicy) =>
  updateGroup(groupId, actorUid, { notificationPolicy });

export async function deleteGroup(groupId: string, actorUid: string): Promise<void> {
  const snapshot = await getDoc(doc(firestore, 'groups', groupId));
  const group = snapshot.exists() ? parseGroup(snapshot.id, snapshot.data()) : null;
  if (!group) throw new AppError('not-found', 'Grupo não encontrado.');
  if (group.ownerId !== actorUid) throw new AppError('not-owner', 'Somente o proprietário pode excluir o grupo.');
  await deleteDoc(snapshot.ref);
  // Com o documento removido, a API apaga o espelho de integrantes → ninguém mais lê as mensagens.
  await syncGroupMembers(groupId).catch(() => undefined);
}

export function subscribeToUserGroups(
  uid: string,
  onData: (groups: ChatGroup[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(groupsCollection, where('memberIds', 'array-contains', uid)),
    (snapshot) => onData(snapshot.docs.map((d) => parseGroup(d.id, d.data())).filter((g): g is ChatGroup => g !== null)),
    onError,
  );
}

export function subscribeToGroup(
  groupId: string,
  onData: (group: ChatGroup | null) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, 'groups', groupId),
    (snapshot) => onData(snapshot.exists() ? parseGroup(snapshot.id, snapshot.data()) : null),
    onError,
  );
}
