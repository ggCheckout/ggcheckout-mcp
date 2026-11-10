import { describe, expect, it } from 'vitest';
import { statusBadge, summarizeDeliveries, summarizeResend, typeLabel } from './model';

const embedded = {
  paymentId: 'pay_1',
  source: 'embedded',
  deliveries: [
    { id: 'd1', uid: 'd1', type: 'product_delivery', status: 'read', provider: 'waha', messageId: 'wamid', recipientPhone: '*********7766', sentAt: '2026-11-10T12:00:00Z', readAt: '2026-11-10T12:05:00Z', retryCount: 0 },
    { id: 'd2', uid: 'd2', type: 'order_bump_file_ob9', status: 'sent', recipientPhone: '*********7766', retryCount: 1 },
  ],
  summary: { total: 2, pending: 0, sent: 1, delivered: 0, read: 1, failed: 0, permanentFailure: 0 },
};

describe('summarizeDeliveries', () => {
  it('reads the embedded deliveries and flags a WAHA send the device has not confirmed', () => {
    const { deliveries, summary, paymentId } = summarizeDeliveries(embedded)!;
    expect(paymentId).toBe('pay_1');
    expect(deliveries.map((d) => d.label)).toEqual(['Entrega de Produto', 'Arquivo Order Bump']);
    expect(deliveries[0].unconfirmed).toBe(false);
    expect(deliveries[1]).toMatchObject({ provider: 'waha', unconfirmed: true, retryCount: 1 });
    expect(summary).toMatchObject({ total: 2, read: 1 });
  });

  it('reads a legacy delivery by its messageType and customer phone', () => {
    const legacy = summarizeDeliveries({
      deliveries: [{ uid: 'l1', messageType: 'payment_confirmed', status: 'failed', customerPhone: '***99', error: 'PHONE_NOT_ON_WHATSAPP', retryCount: 3 }],
      summary: { total: 1, failed: 1, permanentFailure: 1 },
    })!;
    expect(legacy.deliveries[0]).toMatchObject({ label: 'Pagamento Confirmado', phone: '***99', error: 'PHONE_NOT_ON_WHATSAPP' });
    expect(legacy.summary).toMatchObject({ failed: 2 });
  });

  it('ignores other payloads', () => {
    expect(summarizeDeliveries({ deliveries: [] })).toBeNull();
    expect(summarizeDeliveries({ payments: [] })).toBeNull();
  });
});

describe('statusBadge', () => {
  it('follows DeliveryStatusBadge', () => {
    expect(statusBadge({ status: 'queued', provider: 'waha', unconfirmed: false }).label).toBe('Na fila');
    expect(statusBadge({ status: 'sent', provider: 'waha', unconfirmed: true }).tone).toBe('amber');
    expect(statusBadge({ status: 'sent', provider: 'meta', unconfirmed: false }).tone).toBe('emerald');
    expect(statusBadge({ status: 'read', provider: 'waha', unconfirmed: false })).toMatchObject({ tone: 'sky', label: 'Lido' });
    expect(statusBadge({ status: 'permanent_failure', provider: 'waha', unconfirmed: false }).label).toBe('Falha permanente');
  });
});

describe('typeLabel and summarizeResend', () => {
  it('labels the kinds and keeps an unknown one raw', () => {
    expect(typeLabel('pix')).toBe('PIX pendente');
    expect(typeLabel('weird_kind')).toBe('weird_kind');
    expect(typeLabel(null)).toBe('Mensagem');
  });

  it('reads the resend answer', () => {
    expect(summarizeResend({ success: true, message: 'ok', remaining: { user: 49, payment: 19 } })).toEqual({ ok: true, message: 'Mensagem WhatsApp reenviada com sucesso!' });
    expect(summarizeResend({ deliveries: [] })).toBeNull();
  });
});
