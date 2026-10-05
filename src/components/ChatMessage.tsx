import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import type { ChatMessage, FailedMessage } from '../types/chat';
import { formatMessageTime } from '../utils/formValidation';

type ChatMessageBubbleProps = {
  message: ChatMessage;
  isMine: boolean;
  /** Nome do autor — exibido em grupos para mensagens recebidas. */
  authorName: string | null;
  /** Nome do destinatário quando a mensagem foi direcionada a um integrante. */
  targetName: string | null;
  mentionsMe: boolean;
};

function ChatMessageBubbleComponent({ message, isMine, authorName, targetName, mentionsMe }: ChatMessageBubbleProps) {
  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      <View style={[styles.bubble, isMine ? styles.mine : styles.other, mentionsMe && !isMine && styles.mentioned]}>
        {authorName && !isMine ? <Text style={styles.author}>{authorName}</Text> : null}
        {targetName ? <Text style={[styles.target, isMine && styles.targetMine]}>Para: {targetName}</Text> : null}
        <Text style={[styles.text, isMine && styles.textMine]}>{message.text}</Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>{formatMessageTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

export const ChatMessageBubble = memo(ChatMessageBubbleComponent);

type FailedMessageBubbleProps = {
  message: FailedMessage;
  onRetry: (localId: string) => void;
  onDiscard: (localId: string) => void;
};

/** Mensagem que NÃO foi persistida: mostra o erro e permite reenviar ou descartar. */
export function FailedMessageBubble({ message, onRetry, onDiscard }: FailedMessageBubbleProps) {
  return (
    <View style={[styles.row, styles.rowMine]}>
      <View style={[styles.bubble, styles.failed]}>
        <Text style={styles.text}>{message.text}</Text>
        <Text style={styles.failedText}>⚠ {message.error}</Text>
        <View style={styles.failedActions}>
          <Pressable onPress={() => onRetry(message.localId)} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.failedAction}>Reenviar</Text>
          </Pressable>
          <Pressable onPress={() => onDiscard(message.localId)} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.failedAction}>Descartar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: 3, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  mine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  other: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  mentioned: { borderColor: colors.group, borderWidth: 1.5 },
  author: { fontWeight: '700', color: colors.group, fontSize: 13 },
  target: { fontSize: 12, fontWeight: '600', color: colors.group },
  targetMine: { color: colors.primarySoft },
  text: { fontSize: 16, color: colors.text },
  textMine: { color: '#FFFFFF' },
  time: { fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end' },
  timeMine: { color: colors.primarySoft },
  failed: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  failedText: { color: colors.danger, fontSize: 12 },
  failedActions: { flexDirection: 'row', gap: spacing.lg, marginTop: 2 },
  failedAction: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
