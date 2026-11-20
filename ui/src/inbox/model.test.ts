import { describe, expect, it } from 'vitest';
import {
  activityLabel, appendConversations, bodyOf, clockLabel, codePointLength, contactLabel, conversationLabels, errorText, latestIncomingId, maskContact,
  mergeConversations, mergeMessages, newClientMessageId, pendingFor, previewOf, replyProblem, runLabel, startOutcome, summarizeInbox,
  toContactRun, toConversations, toFunnelOptions, toMessages, type Conversation, type ThreadMessage,
} from './model';

const raw = (key: string, extra: Record<string, unknown> = {}) => ({
  contactKey: key, name: null, chipId: 'c1', openedByChipId: 'c1', lastText: 'oi', lastType: 'text', lastAt: '2026-11-20T12:00:00Z', unread: 0, interacted: true, ...extra,
});
const conv = (key: string, lastAt: string): Conversation => ({
  key, name: null, lastText: null, lastType: null, lastAt, unread: 0, exitRequested: false, optedOut: false,
});
const msg = (id: string, at: string, dir: 'in' | 'out' = 'in'): ThreadMessage => ({ id, dir, type: 'text', text: id, at, auto: false });

describe('open_whatsapp_inbox payload', () => {
  it('reads the four fields', () => {
    expect(summarizeInbox({ available: true, enabled: true, conversations: 3, unread: 5 })).toEqual({ available: true, enabled: true, conversations: 3, unread: 5 });
    expect(summarizeInbox({ available: false, enabled: false, conversations: 0, unread: 0 })).toMatchObject({ available: false });
  });

  it('does not take another tool\'s answer for it', () => {
    expect(summarizeInbox({ object: 'limits_unavailable', available: false })).toBeNull();
    expect(summarizeInbox({ available: true })).toBeNull();
    expect(summarizeInbox({ available: 'yes', enabled: true, conversations: 1, unread: 1 })).toBeNull();
    expect(summarizeInbox(null)).toBeNull();
  });
});

describe('conversations', () => {
  it('reads the page with its labels and drops rows without a key', () => {
    const page = toConversations({
      items: [raw('553199998888', { name: 'Ana', unread: 2, exitRequestedAt: '2026-11-20T11:00:00Z', optedOut: true }), { name: 'sem chave' }],
      nextBefore: '9:553199998888',
    })!;
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ key: '553199998888', name: 'Ana', unread: 2, exitRequested: true, optedOut: true });
    expect(page.nextBefore).toBe('9:553199998888');
    expect(toConversations({ nope: 1 })).toBeNull();
  });

  it('shows the name, else the phone masked to its last four digits', () => {
    expect(contactLabel({ key: '553199998888', name: 'Ana' })).toBe('Ana');
    expect(contactLabel({ key: '553199998888', name: null })).toBe('•••• 8888');
    expect(contactLabel({ key: 'lid:abc@lid', name: null })).toBe('Contato do WhatsApp');
    expect(maskContact('553199998888')).not.toContain('5531');
  });

  it('previews the text, else the kind of message', () => {
    expect(previewOf({ lastText: 'Oi, tudo bem?', lastType: 'text' })).toBe('Oi, tudo bem?');
    expect(previewOf({ lastText: null, lastType: 'media' })).toMatch(/Mídia/);
    expect(previewOf({ lastText: null, lastType: null })).toBe('Sem mensagens');
  });

  it('tags a row as the panel does', () => {
    expect(conversationLabels({ exitRequested: true, optedOut: false })).toEqual(['Pediu para sair']);
    expect(conversationLabels({ exitRequested: true, optedOut: true })).toEqual(['Pediu para sair', 'Não recebe funis']);
    expect(conversationLabels({ exitRequested: false, optedOut: false })).toEqual([]);
  });

  it('words the last activity', () => {
    const now = new Date('2026-11-20T15:00:00Z');
    expect(activityLabel('2026-11-20T14:59:50Z', now)).toBe('agora');
    expect(activityLabel('2026-11-20T14:30:00Z', now)).toBe('há 30 min');
    expect(activityLabel('2026-11-20T10:00:00Z', now)).toBe('há 5 h');
    expect(activityLabel('2026-11-19T10:00:00Z', now)).toBe('ontem');
    expect(activityLabel('2026-11-10T15:00:00Z', now)).toBe('10/11');
    expect(activityLabel(null, now)).toBe('');
  });

  it('words a message time: the hour today, the day and hour before', () => {
    const now = new Date('2026-11-20T15:00:00Z');
    expect(clockLabel('2026-11-20T14:32:00Z', now)).toBe('11:32');
    expect(clockLabel('2026-11-19T14:32:00Z', now)).toBe('19/11 11:32');
    expect(clockLabel(null, now)).toBe('');
  });

  it('a poll that reads the whole list replaces it', () => {
    const current = [conv('a', '2026-11-20T10:00:00Z'), conv('b', '2026-11-20T09:00:00Z')];
    expect(mergeConversations(current, { items: [conv('b', '2026-11-20T11:00:00Z')], nextBefore: null }).map((c) => c.key)).toEqual(['b']);
  });

  it('a poll of the newest page keeps the older pages already loaded, without repeating a row', () => {
    const current = [conv('a', '2026-11-20T10:00:00Z'), conv('b', '2026-11-20T09:00:00Z'), conv('c', '2026-11-20T08:00:00Z')];
    const fresh = { items: [conv('b', '2026-11-20T11:00:00Z'), conv('a', '2026-11-20T10:00:00Z')], nextBefore: 'more' };
    expect(mergeConversations(current, fresh).map((c) => c.key)).toEqual(['b', 'a', 'c']);
  });

  it('"Carregar mais" appends an older page without repeating a row', () => {
    const merged = appendConversations([conv('a', '2026-11-20T10:00:00Z')], [conv('a', '2026-11-20T10:00:00Z'), conv('z', '2026-11-19T10:00:00Z')]);
    expect(merged.map((c) => c.key)).toEqual(['a', 'z']);
  });
});

describe('messages', () => {
  it('reads messages as sent and drops rows without an id', () => {
    const page = toMessages({
      items: [
        { id: '1-1', messageId: 'w1', dir: 'in', chipId: 'c', type: 'text', text: '  Olá\n<b>mundo</b>  ', at: '2026-11-20T12:00:00Z', auto: false },
        { id: '1-2', dir: 'out', type: 'media', text: null, at: '2026-11-20T12:01:00Z', auto: true },
        { text: 'sem id' },
      ],
      nextBefore: null,
    })!;
    expect(page.items).toHaveLength(2);
    // The text is kept verbatim: the view renders it as text, so markup in it stays literal.
    expect(page.items[0].text).toBe('  Olá\n<b>mundo</b>  ');
    expect(page.items[1]).toMatchObject({ dir: 'out', auto: true, text: null });
    expect(toMessages(undefined)).toBeNull();
  });

  it('orders a thread oldest first and keeps each message once, the newest copy winning', () => {
    const merged = mergeMessages(
      [msg('1-10', '2026-11-20T12:00:00Z'), msg('1-2', '2026-11-20T12:00:00Z')],
      [msg('1-3', '2026-11-20T12:05:00Z'), { ...msg('1-2', '2026-11-20T12:00:00Z'), text: 'editada' }],
    );
    expect(merged.map((m) => m.id)).toEqual(['1-2', '1-10', '1-3']);
    expect(merged[0].text).toBe('editada');
  });

  it('shows the text, else the kind of message', () => {
    expect(bodyOf({ text: 'Oi', type: 'text' })).toBe('Oi');
    expect(bodyOf({ text: null, type: 'reaction' })).toBe('Reação');
    expect(bodyOf({ text: null, type: 'other' })).toBe('Mensagem sem texto');
  });

  it('finds the newest message from the contact', () => {
    expect(latestIncomingId([msg('1', '2026-11-20T12:00:00Z', 'in'), msg('2', '2026-11-20T12:01:00Z', 'out')])).toBe('1');
    expect(latestIncomingId([msg('2', '2026-11-20T12:01:00Z', 'out')])).toBeNull();
  });
});

describe('composer', () => {
  it('refuses an empty reply and one over 4096 characters, counting an emoji as one', () => {
    expect(replyProblem('   ')).toMatch(/Escreva/);
    expect(replyProblem('Oi')).toBeNull();
    expect(replyProblem('😀'.repeat(4096))).toBeNull();
    expect(replyProblem('😀'.repeat(4097))).toMatch(/4096/);
    expect(codePointLength('😀a')).toBe(2);
  });

  it('makes a client id the saas accepts', () => {
    const id = newClientMessageId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(newClientMessageId()).not.toBe(id);
  });

  it('keeps the id of the same message on a retry and makes a new one for another text', () => {
    let n = 0;
    const make = () => `id-${++n}`;
    const first = pendingFor(null, 'Oi', make);
    const retry = pendingFor(first, 'Oi', make);
    expect(retry.clientMessageId).toBe(first.clientMessageId);
    expect(n).toBe(1);
    const edited = pendingFor(first, 'Oi!', make);
    expect(edited.clientMessageId).not.toBe(first.clientMessageId);
    expect(pendingFor(null, 'Oi', make).clientMessageId).toBe('id-3');
  });
});

describe('funnel', () => {
  it('labels a running funnel "funil n/m" and nothing else', () => {
    expect(runLabel(toContactRun({ run: { status: 'running', funnelName: 'Boas-vindas', currentStep: 2, totalSteps: 3 } })!)).toBe('funil 2/3');
    expect(runLabel({ status: 'done', funnelName: 'x', currentStep: 3, totalSteps: 3 })).toBeNull();
    expect(runLabel(null)).toBeNull();
  });

  it('reads a contact with no run as null and another answer as unknown', () => {
    expect(toContactRun({ run: null })).toBeNull();
    expect(toContactRun({ nope: true })).toBeUndefined();
  });

  it('offers only enabled manual funnels', () => {
    const options = toFunnelOptions({
      items: [
        { id: 'f1', name: 'Boas-vindas', trigger: 'manual', isEnabled: true },
        { id: 'f2', name: 'Carrinho', trigger: 'abandoned_cart', isEnabled: true },
        { id: 'f3', name: 'Desligado', trigger: 'manual', isEnabled: false },
      ],
      nextAfter: null,
    });
    expect(options).toEqual([{ id: 'f1', name: 'Boas-vindas' }]);
    expect(toFunnelOptions({})).toBeNull();
  });

  it('tells a started run from a refused one', () => {
    expect(startOutcome({ started: true, run: { status: 'running', funnelName: 'F', currentStep: 0, totalSteps: 2 }, replacedRunId: null })).toMatchObject({ kind: 'started', run: { totalSteps: 2 } });
    expect(startOutcome({ started: false, reason: 'opted_out' })).toMatchObject({ kind: 'refused', message: expect.stringMatching(/não recebe/) });
    expect(startOutcome({})).toBeNull();
  });
});

describe('errorText', () => {
  it('keeps the message the saas wrote for the seller', () => {
    expect(errorText(new Error('Error: API Error (422): O chip desta conversa caiu: escolha outro chip. (INBOX_REPLY_REFUSED)')))
      .toBe('O chip desta conversa caiu: escolha outro chip.');
    expect(errorText(new Error('Error: API Error (404): Funil não encontrado.'))).toBe('Funil não encontrado.');
  });

  it('names the switch and the term in the panel words', () => {
    expect(errorText(new Error('Error: O acesso ... (INBOX_API_ACCESS_DISABLED)'))).toContain('Permitir acesso pelo MCP');
    expect(errorText(new Error('Error: Aceite o termo (INBOX_TERMS_REQUIRED)'))).toContain('termo');
  });

  it('falls back when there is no message', () => {
    expect(errorText('boom')).toMatch(/Tente de novo/);
    expect(errorText(new Error(''), 'Falhou')).toBe('Falhou');
  });
});
