import { describe, expect, it } from 'vitest';
import { summarizeHealth, phoneLabel, sessionByChip, needsRestart, canPair, chipStatus, formatCode, pairingPhone, summarizeChip, summarizeChips, summarizePairing } from './model';

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

  it('labels the status as the dashboard', () => {
    expect(chipStatus('authenticated', true)).toMatchObject({ label: 'Conectado', tone: 'success' });
    expect(chipStatus('starting', true)).toMatchObject({ label: 'Conectando…', pulse: true });
    expect(chipStatus('authenticated', false).label).toBe('Desativado');
    expect(chipStatus('banned', true).tone).toBe('danger');
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
