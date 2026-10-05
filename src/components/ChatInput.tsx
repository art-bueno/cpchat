import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_MESSAGE_LENGTH } from '../services/chatService';
import { colors, radius, spacing } from '../theme';
import type { MessageTarget, OutgoingMessage } from '../types/chat';
import type { PublicUser } from '../types/user';
import { getActiveMentionQuery, insertMention, resolveMentionedUserIds } from '../utils/mentions';
import { Avatar } from './Avatar';

type ChatInputProps = {
  /** Integrantes que podem ser mencionados/escolhidos como destinatário (grupos). Vazio em conversas individuais. */
  members: readonly PublicUser[];
  sending: boolean;
  disabled?: boolean;
  onSend: (message: OutgoingMessage) => Promise<boolean>;
};

export function ChatInput({ members, sending, disabled = false, onSend }: ChatInputProps) {
  const [text, setText] = useState('');
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isGroup = members.length > 0;
  const targetMember = useMemo(() => members.find((m) => m.uid === targetMemberId) ?? null, [members, targetMemberId]);

  const mentionQuery = isGroup ? getActiveMentionQuery(text) : null;
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const term = mentionQuery.toLowerCase();
    return members.filter((member) => member.name.toLowerCase().includes(term)).slice(0, 5);
  }, [members, mentionQuery]);

  const canSend = text.trim().length > 0 && !sending && !disabled;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const target: MessageTarget = targetMember ? { type: 'member', memberId: targetMember.uid } : { type: 'conversation' };
    const ok = await onSend({ text, target, mentionedUserIds: resolveMentionedUserIds(text, members) });
    if (ok) {
      setText('');
      setTargetMemberId(null);
    }
  }, [canSend, members, onSend, targetMember, text]);

  const selectTarget = useCallback((uid: string | null) => {
    setTargetMemberId(uid);
    setPickerOpen(false);
  }, []);

  return (
    <View style={styles.wrapper}>
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((member) => (
            <Pressable key={member.uid} style={styles.suggestion} onPress={() => setText((prev) => insertMention(prev, member))}>
              <Avatar uri={member.photoUrl} name={member.name} size={28} />
              <Text style={styles.suggestionText}>{member.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isGroup ? (
        <Pressable style={styles.targetChip} onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Escolher destinatário">
          <Text style={styles.targetChipText}>Para: {targetMember ? targetMember.name : 'Todos do grupo'} ▾</Text>
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={isGroup ? 'Mensagem (use @ para mencionar)' : 'Mensagem'}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!disabled}
          style={styles.input}
          accessibilityLabel="Campo de mensagem"
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.send, !canSend && styles.sendDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
        >
          <Text style={styles.sendText}>{sending ? '…' : 'Enviar'}</Text>
        </Pressable>
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Enviar para</Text>
            <FlatList
              data={[null, ...members]}
              keyExtractor={(item) => item?.uid ?? 'all'}
              renderItem={({ item }) => (
                <Pressable style={styles.sheetItem} onPress={() => selectTarget(item?.uid ?? null)}>
                  {item ? <Avatar uri={item.photoUrl} name={item.name} size={32} /> : null}
                  <Text style={styles.sheetItemText}>{item ? item.name : 'Todos do grupo'}</Text>
                  {(item?.uid ?? null) === targetMemberId ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: colors.text,
  },
  send: { height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#FFFFFF', fontWeight: '700' },
  targetChip: { alignSelf: 'flex-start', backgroundColor: colors.groupSoft, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  targetChipText: { color: colors.group, fontWeight: '600', fontSize: 13 },
  suggestions: { borderRadius: radius.md, backgroundColor: colors.background, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  suggestionText: { color: colors.text, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '60%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.sm, color: colors.text },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  sheetItemText: { flex: 1, fontSize: 16, color: colors.text },
  check: { color: colors.primary, fontWeight: '800' },
});
