import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ConversationType } from './chat';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type UsersScreenParams =
  | { mode: 'direct' }
  | {
      mode: 'selectMembers';
      /** Integrantes já escolhidos (sem o proprietário). */
      selectedIds: string[];
      /** Vagas para escolher além do proprietário. */
      maxSelectable: number;
    };

export type AppStackParamList = {
  Conversations: undefined;
  Users: UsersScreenParams;
  GroupForm: { groupId?: string; selectedMemberIds?: string[] } | undefined;
  Chat: { conversationId: string; conversationType: ConversationType };
  GroupMembers: { groupId: string };
  Profile: { uid: string };
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, T>;
