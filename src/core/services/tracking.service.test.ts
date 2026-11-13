import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingService } from './tracking.service.js';

const health = { hasSucceeded: true, consecutiveFailures: 0, disabledReason: null, disabledAt: null, lastError: null };
const tokens = [
  { id: 't1', title: 'Pixel', type: 'facebook_ads', channel: 'facebook', trackingMode: 'pixel', status: 'active', pixelId: '123456789012', health },
];
const emptyErrors = (channel: string) => ({ channel, hours: 24, rows: [] });

describe('TrackingService.diagnose', () => {
  const port = {
    listTokens: vi.fn(),
    listChannelErrors: vi.fn(),
    listCheckouts: vi.fn(),
    getFunnel: vi.fn(),
    getPayment: vi.fn(),
  };
  const auth = { getMyBusinessId: vi.fn() };
  const service = new TrackingService(port as any, auth);

  beforeEach(() => {
    Object.values(port).forEach((m) => m.mockReset());
    auth.getMyBusinessId.mockResolvedValue('biz-1');
    port.listTokens.mockResolvedValue(tokens);
    port.listChannelErrors.mockImplementation(async (channel: string) => emptyErrors(channel));
    port.listCheckouts.mockResolvedValue([{ id: 'c1', title: 'Curso', metricTokenIds: ['t1'] }, { id: 'c2', title: 'Outro', metricTokenIds: [] }]);
  });

  it('is an account overview with no ids, and masks the pixel id', async () => {
    const result = await service.diagnose({});
    expect(result.scope).toEqual({ kind: 'account' });
    expect(port.getFunnel).not.toHaveBeenCalled();
    expect(port.getPayment).not.toHaveBeenCalled();
    expect(result.tokens[0].pixelId).toBe('1234…9012');
    expect(result.tokens[0].health).toMatchObject({ disabledReasonText: null });
    expect(result.findings.map((f) => f.code)).toContain('checkout_no_metric_token');
    expect(result.findings.map((f) => f.code)).toContain('token_mode_pixel');
    expect(Object.keys(result.errors!)).toEqual(['facebook', 'tiktok', 'google', 'utmify']);
  });

  it('asks for the errors of the last 24 hours, per channel', async () => {
    await service.diagnose({});
    expect(port.listChannelErrors.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['facebook', 24], ['tiktok', 24], ['google', 24], ['utmify', 24],
    ]);
  });

  it('limits a checkout scope to that checkout', async () => {
    const result = await service.diagnose({ checkoutId: 'c1' });
    expect(result.scope).toMatchObject({ kind: 'checkout', checkoutId: 'c1', title: 'Curso' });
    expect(result.findings.map((f) => f.code)).not.toContain('checkout_no_metric_token');
  });

  it('reports an unknown checkout as a finding', async () => {
    const result = await service.diagnose({ checkoutId: 'zzz' });
    expect(result.findings[0]).toMatchObject({ severity: 'critical', code: 'checkout_not_found' });
  });

  it('reads the payment and hides its funnel link and buyer data from the answer', async () => {
    port.getPayment.mockResolvedValue({
      id: 'p1', status: 'paid', createdAt: null, funnelId: 'f9', utms: {}, clickIds: { fbc: false, fbp: false, ttclid: false, ttp: false },
      dispatch: null, dispatchAt: null, dispatchSuccess: null, flags: { created: null, paid: null, refunded: null, chargedback: null },
    });
    const result = await service.diagnose({ paymentId: 'p1' });
    expect(port.getPayment).toHaveBeenCalledWith('biz-1', 'p1');
    expect(port.listCheckouts).not.toHaveBeenCalled();
    expect(result.scope.kind).toBe('payment');
    expect(result.payment).not.toHaveProperty('funnelId');
    expect(result.findings.map((f) => f.code)).toContain('payment_no_utms');
  });

  it('degrades routes the API does not have yet to findings', async () => {
    port.listTokens.mockResolvedValue(null);
    port.listChannelErrors.mockResolvedValue(null);
    port.getFunnel.mockResolvedValue({ id: 'f1', title: 'Quiz', tokenIds: {}, utmifyPixelId: null });
    const ok = await service.diagnose({ funnelId: 'f1' });
    expect(ok.findings.map((f) => f.code)).toEqual(expect.arrayContaining(['tokens_unavailable', 'errors_unavailable']));
    expect(ok.errors!.facebook.available).toBe(false);
    expect(ok.tokens).toEqual([]);
  });
});

describe('TrackingService token view', () => {
  it('carries the pt-BR text next to the disabledReason code', async () => {
    const port = {
      listTokens: vi.fn().mockResolvedValue([{ ...tokens[0], status: 'disabled', health: { ...health, disabledReason: 'invalid_credential' } }]),
      listChannelErrors: vi.fn().mockResolvedValue(null),
      listCheckouts: vi.fn().mockResolvedValue([]),
    };
    const result = await new TrackingService(port as any, { getMyBusinessId: async () => 'b' }).diagnose({});
    expect(result.tokens[0].health).toMatchObject({ disabledReason: 'invalid_credential', disabledReasonText: 'credencial inválida desde o início' });
  });
});
