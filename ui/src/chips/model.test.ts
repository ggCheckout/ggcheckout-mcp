import { describe, expect, it } from 'vitest';
import { canPair, chipStatus, formatCode, pairingPhone, sessionsLabel, summarizeChip, summarizeChips, summarizePairing } from './model';

// The shapes of /api/whatsapp/numbers after sanitizeWhatsappNumber (phone masked, no qrCode).
const waha = { uid: 'c1', provider: 'waha', displayName: 'Suporte', status: 'disconnected', phoneNumber: '5531*****4321', isActive: true, groupsCount: 2 };
const meta = { uid: 'c2', provider: 'meta', displayName: '', status: 'authenticated', phoneNumber: '5511*****0000', isActive: true, groupsCount: 0 };

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

  it('pairs only an active QR code chip that is not connected', () => {
    const [w, m] = summarizeChips({ numbers: [waha, meta] })!;
    expect(canPair(w)).toBe(true);
    expect(canPair(m)).toBe(false);
    expect(canPair({ ...w, status: 'authenticated' })).toBe(false);
    expect(canPair({ ...w, isActive: false })).toBe(false);
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

  it('counts sessions and ignores other payloads', () => {
    expect(sessionsLabel(1)).toBe('1 sessão');
    expect(summarizeChips({ sessions: [] })).toBeNull();
    expect(summarizeChip({ number: 5 })).toBeNull();
  });
});
