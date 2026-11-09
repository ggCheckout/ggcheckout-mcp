import { describe, expect, it } from 'vitest';
import { formatRemaining, normalizePix, polledStatus, qrImageSrc } from './model';

describe('normalizePix', () => {
  const intent = {
    _notice: 'data', id: 'pi_123456789012345678901234', object: 'payment_intent', livemode: false, status: 'requires_action',
    amount: 4990, description: 'Pedido 1', pix: { copy_paste: '000201...', qr_base64: 'iVBORw0K', expires_at: '2026-11-09T20:00:00Z' },
  };

  it('reads a payment intent and polls it by id', () => {
    const c = normalizePix(intent)!;
    expect(c).toMatchObject({ kind: 'intent', amountCents: 4990, code: '000201...', status: 'pending', livemode: false });
    expect(c.qrSrc).toBe('data:image/png;base64,iVBORw0K');
    expect(c.poll).toEqual({ tool: 'get_payment_intent', args: { id: intent.id } });
    expect(polledStatus(c, { ...intent, status: 'succeeded' })).toBe('paid');
    expect(polledStatus(c, { ...intent, id: 'pi_other', status: 'succeeded' })).toBeNull();
  });

  it('polls a legacy top-up through list_credits and a new one through get_credit_topup', () => {
    const base = { creditId: 'cr_1', amountCents: 1000, pixCode: 'pix', pixQrBase64: 'AAAA', expiresAt: null };
    const legacy = normalizePix({ ...base, via: 'legacy' })!;
    expect(legacy.poll?.tool).toBe('list_credits');
    expect(polledStatus(legacy, { credits: [{ id: 'cr_1', status: 'confirmed' }], ledger: { entries: [] } })).toBe('paid');

    const topup = normalizePix({ ...base, via: 'topup' })!;
    expect(topup.poll?.tool).toBe('get_credit_topup');
    expect(polledStatus(topup, { topup: { creditId: 'cr_1', status: 'expired' } })).toBe('expired');
    expect(polledStatus(topup, { topup: null })).toBeNull();
  });

  it('shows "no top-up" for an empty get_credit_topup', () => {
    expect(normalizePix({ topup: null })).toMatchObject({ status: 'none', poll: null });
  });

  it('takes the invoice id from the tool input, and has no PIX for a card payment', () => {
    const pix = normalizePix({ success: true, qrCode: 'pix', qrCodeImage: 'data:image/png;base64,AAAA' }, { invoiceId: 'inv_1', method: 'pix' })!;
    expect(pix).toMatchObject({ kind: 'invoice', id: 'inv_1', status: 'pending', qrSrc: 'data:image/png;base64,AAAA' });
    expect(polledStatus(pix, { invoice: { id: 'inv_1', status: 'paid' } })).toBe('paid');

    const card = normalizePix({ success: true }, { invoiceId: 'inv_1', method: 'card' })!;
    expect(card).toMatchObject({ status: 'requested', poll: null });
  });

  it('is null for an answer with no PIX', () => {
    expect(normalizePix({ invoices: [] })).toBeNull();
  });
});

describe('qrImageSrc', () => {
  it('accepts only an inline image, never a URL to fetch', () => {
    expect(qrImageSrc('https://example.com/qr.png')).toBeNull();
    expect(qrImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(qrImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });
});

describe('formatRemaining', () => {
  it('counts down and stops at the deadline', () => {
    const now = Date.parse('2026-11-09T20:00:00Z');
    expect(formatRemaining('2026-11-09T20:14:05Z', now)).toBe('14:05');
    expect(formatRemaining('2026-11-09T21:00:00Z', now)).toBe('1:00:00');
    expect(formatRemaining('2026-11-09T19:59:59Z', now)).toBeNull();
  });
});
