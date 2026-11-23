import { describe, expect, it } from 'vitest';
import { PROVIDER, activeChips, chipsNeedingAction, summarizeHealth, phoneLabel, sessionByChip, needsRestart, canPair, chipStatus, formatCode, pairingPhone, summarizeChip, summarizeChips, summarizePairing } from './model';

// The shapes of /api/whatsapp/numbers after sanitizeWhatsappNumber (phone masked, no qrCode).
const waha = { uid: 'c1', provider: 'waha', displayName: 'Suporte', status: 'disconnected', phoneNumber: '*********4321', isActive: true, groupsCount: 2 };
const meta = { uid: 'c2', provider: 'meta', displayName: '', status: 'authenticated', phoneNumber: '*******0000', isActive: true, groupsCount: 0 };

describe('chips', () => {
  it('reads the chips list', () => {
    const [a, b] = summarizeChips({ numbers: [waha, meta] })!;
    expect(a).toMatchObject({ id: 'c1', name: 'Suporte', provider: 'waha', sessionsCount: 2, usedBy: null });
    expect(b).toMatchObject({ name: 'Sem nome', provider: 'meta' });
  });

  it('reads one chip with the sessions that use it', () => {
    const chip = summarizeChip({ number: { ...waha, usedBy: [{ groupId: 'g1', name: 'Curso', role: 'primary' }, { groupId: 'g2', name: 'Mentoria', role: 'fallback' }] } })!;
    expect(chip.usedBy).toEqual([{ sessionId: 'g1', name: 'Curso', role: 'primary' }, { sessionId: 'g2', name: 'Mentoria', role: 'fallback' }]);
    expect(chip.sessionsCount).toBe(2);
  });

  const now = Date.parse('2026-11-20T12:00:00Z');
  const base = { status: 'authenticated', isActive: true, provider: 'waha' as const, removalAt: null, removalReason: null };
  const inHours = (h: number) => new Date(now + h * 3_600_000).toISOString();

  it('labels the status as the dashboard, explained', () => {
    expect(chipStatus(base, now)).toMatchObject({ label: 'Conectado', tone: 'success', description: 'O chip está enviando mensagens normalmente.' });
    expect(chipStatus({ ...base, status: 'starting' }, now)).toMatchObject({ label: 'Conectando…', pulse: true });
    expect(chipStatus({ ...base, isActive: false }, now).label).toBe('Desativado');
    expect(chipStatus({ ...base, status: 'banned' }, now).tone).toBe('danger');
    expect(chipStatus({ ...base, status: 'disconnected', provider: 'meta' }, now).description).toContain('API oficial');
  });

  it('puts the removal countdown before any other state, rounded up and capped at 48 hours', () => {
    const removal = { ...base, isActive: false, removalReason: 'seller' as const };
    expect(chipStatus({ ...removal, removalAt: inHours(22.2) }, now)).toMatchObject({ label: 'Será removido em 23 horas', tone: 'warning' });
    expect(chipStatus({ ...removal, removalAt: inHours(1) }, now).label).toBe('Será removido em 1 hora');
    expect(chipStatus({ ...removal, removalAt: inHours(0.5) }, now).label).toBe('Será removido em menos de 1 hora');
    expect(chipStatus({ ...removal, removalAt: inHours(30) }, now).label).toBe('Será removido em 2 dias');
    expect(chipStatus({ ...removal, removalAt: inHours(48.01) }, now).label).toBe('Será removido em 2 dias');
    expect(chipStatus({ ...removal, removalAt: inHours(-1) }, now).label).toBe('Removendo…');
    expect(chipStatus({ ...removal, removalAt: inHours(5) }, now).description).toContain('Desfazer');
    expect(chipStatus({ ...removal, removalReason: 'disconnected', removalAt: inHours(5) }, now).description).toContain('Reinicie e conecte');
  });

  it('reads the removal mark and lists the chips that need the seller, removals soonest first', () => {
    const [marked] = summarizeChips({ numbers: [{ ...waha, removalScheduledAt: inHours(3), removalReason: 'disconnected' }] })!;
    expect(marked).toMatchObject({ removalAt: inHours(3), removalReason: 'disconnected' });
    const chip = (id: string, extra: object) => ({ ...summarizeChips({ numbers: [waha] })![0], id, ...extra });
    const list = [
      chip('ok', { status: 'authenticated' }),
      chip('down', { status: 'disconnected' }),
      chip('paused', { status: 'disconnected', isActive: false }),
      chip('connecting', { status: 'pending' }),
      chip('late', { removalAt: inHours(20), removalReason: 'seller' }),
      chip('soon', { removalAt: inHours(2), removalReason: 'seller' }),
    ];
    expect(chipsNeedingAction(list).map((c) => c.id)).toEqual(['soon', 'late', 'down']);
    expect(activeChips(list)).toBe(3);
  });

  it('names the chip types as the dashboard', () => {
    expect(PROVIDER.waha.label).toBe('WhatsApp GG');
    expect(PROVIDER.meta.label).toBe('Meta oficial');
  });

  it('pairs an active QR code chip in the handshake, and restarts a dropped one first', () => {
    const [w, m] = summarizeChips({ numbers: [waha, meta] })!;
    expect(canPair(w)).toBe(false);
    expect(needsRestart(w)).toBe(true);
    expect(canPair({ ...w, status: 'pending' })).toBe(true);
    expect(canPair({ ...w, status: 'qr_code' })).toBe(true);
    expect(canPair({ ...w, status: 'starting' })).toBe(true);
    expect(canPair({ ...w, status: 'authenticated' })).toBe(false);
    expect(canPair({ ...w, status: 'pending', isActive: false })).toBe(false);
    expect(canPair(m)).toBe(false);
    expect(needsRestart(m)).toBe(false);
  });

  it('connects a chip marked for lack of a connection, never one the seller marked', () => {
    const [w] = summarizeChips({ numbers: [waha] })!;
    const at = '2026-11-21T12:00:00Z';
    expect(needsRestart({ ...w, isActive: false, removalAt: at, removalReason: 'disconnected' })).toBe(true);
    expect(canPair({ ...w, status: 'qr_code', isActive: false, removalAt: at, removalReason: 'disconnected' })).toBe(true);
    expect(needsRestart({ ...w, removalAt: at, removalReason: 'seller' })).toBe(false);
    expect(canPair({ ...w, status: 'qr_code', removalAt: at, removalReason: 'seller' })).toBe(false);
  });

  it('reads and formats the pairing code', () => {
    expect(summarizePairing({ success: true, code: 'abcd1234' })).toBe('abcd1234');
    expect(summarizePairing({ code: 'x' })).toBeNull();
    expect(formatCode('abcd1234')).toBe('ABCD-1234');
    expect(formatCode('ABCD-1234')).toBe('ABCD-1234');
  });

  it('turns a typed number into the one the route takes', () => {
    expect(pairingPhone('(31) 99876-5432')).toBe('5531998765432');
    expect(pairingPhone('+55 31 99876-5432')).toBe('5531998765432');
    expect(pairingPhone('12345')).toBeNull();
  });

  it('finds the first session that uses each chip, primary or fallback', () => {
    const map = sessionByChip({ sessions: [
      { uid: 'g1', name: 'Curso', primaryNumberId: 'c1', fallbackNumberIds: ['c2'] },
      { uid: 'g2', name: 'Mentoria', primaryNumberId: 'c2', fallbackNumberIds: [] },
    ] })!;
    expect(map).toEqual({ c1: 'Curso', c2: 'Curso' });
    expect(sessionByChip({ numbers: [] })).toBeNull();
  });

  it('shows the masked number by its last four digits', () => {
    expect(phoneLabel('*********1671')).toBe('•••• 1671');
    expect(phoneLabel('*******6230')).toBe('•••• 6230');
    expect(phoneLabel(null)).toBe('—');
  });

  it('words the status check as the chips screen', () => {
    const summary = { total: 3, connected: 2, disconnected: 1, divergent: 0, synced: 0 };
    expect(summarizeHealth({ summary, numbers: [] })).toMatchObject({ tone: 'success', title: 'Tudo certo', detail: '2/3 chip(s) conectado(s), sem divergências.' });
    expect(summarizeHealth({ summary: { ...summary, divergent: 1 }, numbers: [{ numberId: 'abcdef123', diverged: true }, { numberId: 'x', displayName: 'Ok', diverged: false }] }))
      .toMatchObject({ tone: 'danger', title: '1 chip(s) divergente(s), sincronizado(s)', detail: 'Status real diferia do salvo: abcdef. Status atualizado.' });
    expect(summarizeHealth({ summary: { ...summary, total: 0 }, numbers: [] })!.title).toBe('Sem chips');
    expect(summarizeHealth({ numbers: [] })).toBeNull();
  });

  it('counts sessions and ignores other payloads', () => {
    expect(summarizeChips({ sessions: [] })).toBeNull();
    expect(summarizeChip({ number: 5 })).toBeNull();
  });
});
