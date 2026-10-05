import type { NotificationPolicy } from './notification';
import type { PickedImage } from './user';

/** Firestore `groups/{groupId}` */
export type ChatGroup = {
  id: string;
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  createdAt: number;
  updatedAt: number;
};

export type CreateGroupInput = {
  name: string;
  ownerId: string;
  memberIds: readonly string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  photo: PickedImage | null;
};

/** Alterações aplicadas pelo proprietário. Membros são expressos como delta para mesclar com edições concorrentes. */
export type GroupChanges = {
  name?: string;
  memberLimit?: number;
  notificationPolicy?: NotificationPolicy;
  addMemberIds?: readonly string[];
  removeMemberIds?: readonly string[];
};

export type GroupMutationResult = {
  groupId: string;
  warnings: string[];
};
