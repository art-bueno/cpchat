import { createNavigationContainerRef, StackActions } from '@react-navigation/native';
import type { PushPayloadData } from '../types/notification';
import type { AppStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();

const READY_POLL_MS = 100;
const READY_TIMEOUT_MS = 5000;

/**
 * Abre a conversa indicada no payload do push. Se o navegador ainda não montou
 * (app aberto pelo toque na notificação), aguarda ficar pronto.
 */
export function openConversationFromPush(data: PushPayloadData, waitedMs = 0): void {
  if (!navigationRef.isReady()) {
    if (waitedMs < READY_TIMEOUT_MS) setTimeout(() => openConversationFromPush(data, waitedMs + READY_POLL_MS), READY_POLL_MS);
    return;
  }
  const route = navigationRef.getCurrentRoute();
  const params = { conversationId: data.conversationId, conversationType: data.conversationType };
  const alreadyThere = route?.name === 'Chat' && route.params !== undefined && 'conversationId' in route.params && route.params.conversationId === data.conversationId;
  if (alreadyThere) return;
  navigationRef.dispatch(StackActions.push('Chat', params));
}
