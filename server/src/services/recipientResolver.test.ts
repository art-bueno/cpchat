import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConversationContext, NotificationPolicy } from '../types.js';
import { resolveRecipients } from './recipientResolver.js';

const group = (policy: NotificationPolicy): ConversationContext => ({
  type: 'group',
  id: 'g1',
  name: 'Grupo',
  ownerId: 'ana',
  memberIds: ['ana', 'bia', 'caio', 'duda'],
  policy,
});

const general = { senderId: 'ana', target: { type: 'conversation' } as const, mentionedUserIds: [] };

describe('resolveRecipients', () => {
  it('all_group_messages: todos menos o remetente', () => {
    assert.deepEqual(resolveRecipients(group('all_group_messages'), general).recipientIds, ['bia', 'caio', 'duda']);
  });

  it('mentioned_members: só mencionados/destinatário, ignorando não-membros e o próprio remetente', () => {
    const result = resolveRecipients(group('mentioned_members'), {
      senderId: 'ana',
      target: { type: 'member', memberId: 'caio' },
      mentionedUserIds: ['bia', 'ana', 'intruso'],
    });
    assert.deepEqual(new Set(result.recipientIds), new Set(['bia', 'caio']));
  });

  it('mentioned_members sem menção: ninguém', () => {
    assert.deepEqual(resolveRecipients(group('mentioned_members'), general).recipientIds, []);
  });

  it('direct_messages_only e disabled: grupos não geram push', () => {
    assert.deepEqual(resolveRecipients(group('direct_messages_only'), general).recipientIds, []);
    assert.deepEqual(resolveRecipients(group('disabled'), general).recipientIds, []);
  });

  it('conversa individual: notifica o outro participante, exceto se desativada', () => {
    const direct = (policy: NotificationPolicy): ConversationContext => ({ type: 'direct', id: 'dm_ana_bia', participantIds: ['ana', 'bia'], policy });
    assert.deepEqual(resolveRecipients(direct('direct_messages_only'), general).recipientIds, ['bia']);
    assert.deepEqual(resolveRecipients(direct('disabled'), general).recipientIds, []);
  });
});
