import { describe, it, expect, vi } from 'vitest';
import { TrackingApiAdapter } from './tracking.api.js';
import { ApiError } from '../../shared/errors.js';

const http = { get: vi.fn() } as any;
const adapter = new TrackingApiAdapter(http);

const missing = () => new ApiError(404, 'Request failed with status 404');

describe('TrackingApiAdapter.listTokens', () => {
  it('keeps the tracking tokens with health and never the credential', async () => {
    http.get.mockResolvedValueOnce({
      tokens: [
        {
          id: 't1', title: 'Pixel', type: 'facebook_ads', token: 'EAAB-secret-value', target: '123456789012',
          trackingMode: 'both', status: 'disabled',
          health: { hasSucceeded: true, consecutiveFailures: 3, disabledReason: 'Token expirado', disabledAt: '2026-11-10T00:00:00Z', lastError: 'x'.repeat(500) },
        },
        { id: 'p1', title: 'Stripe', type: 'stripe', token: 'sk_live_x' },
      ],
    });
    const tokens = await adapter.listTokens('biz-1');
    expect(http.get).toHaveBeenCalledWith('/api/get-clients/business/biz-1/tokens');
    expect(tokens).toHaveLength(1);
    expect(tokens![0]).toMatchObject({ id: 't1', channel: 'facebook', trackingMode: 'both', pixelId: '123456789012' });
    expect(tokens![0].health!.lastError!.length).toBeLessThanOrEqual(200);
    expect(JSON.stringify(tokens)).not.toMatch(/EAAB-secret-value|sk_live/);
  });

  it('reads a token without health as health null', async () => {
    http.get.mockResolvedValueOnce([{ id: 't1', type: 'utmify', title: 'U' }]);
    expect((await adapter.listTokens('b'))![0].health).toBeNull();
  });

  it('answers null on a 404, and rethrows anything else', async () => {
    http.get.mockRejectedValueOnce(missing());
    expect(await adapter.listTokens('b')).toBeNull();
    http.get.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await expect(adapter.listTokens('b')).rejects.toThrow('boom');
  });
});

describe('TrackingApiAdapter.listChannelErrors', () => {
  it('asks for the channel, hours and limit and cuts the provider text', async () => {
    http.get.mockResolvedValueOnce({
      errors: [{ channel: 'tiktok', paymentId: 'p', event: 'Purchase', subjectTitle: 'Pixel', subjectCode: 'AB12…YZ89', errorCode: '40001', errorMessage: 'y'.repeat(400), createdAt: '2026-11-10T10:00:00Z' }],
    });
    const result = await adapter.listChannelErrors('tiktok', 24, 50);
    expect(http.get).toHaveBeenCalledWith('/api/integrations/errors?channel=tiktok&hours=24&limit=50');
    expect(result!.rows[0].errorMessage!.length).toBeLessThanOrEqual(200);
  });

  it('answers null on a 404', async () => {
    http.get.mockRejectedValueOnce(missing());
    expect(await adapter.listChannelErrors('google', 24, 50)).toBeNull();
  });
});

describe('TrackingApiAdapter.listCheckouts', () => {
  it('reads metricToken as a string, a list or null, and ignores metricTokensByType', async () => {
    http.get.mockResolvedValueOnce([
      { uid: 'c1', title: 'A', metricToken: 't1', metricTokensByType: { facebook_ads: { token: 'cipher' } } },
      { uid: 'c2', title: 'B', metricToken: ['t1', 't2'] },
      { uid: 'c3', title: 'C', metricToken: null },
      { title: 'no id' },
    ]);
    const checkouts = await adapter.listCheckouts('biz');
    expect(http.get).toHaveBeenCalledWith('/api/checkouts?uuidOwner=biz');
    expect(checkouts.map((c) => c.metricTokenIds)).toEqual([['t1'], ['t1', 't2'], []]);
    expect(JSON.stringify(checkouts)).not.toContain('cipher');
  });
});

describe('TrackingApiAdapter.getFunnel', () => {
  it('reads the token links and the UTMify pixel from the settings', async () => {
    http.get.mockResolvedValueOnce({
      funnel: { id: 'f1', title: 'Quiz', settings: { pixelTokenIds: { facebook_ads: 't1', tiktok_ads: null }, utmify: { pixelId: 'abc' } }, steps: [{ big: true }] },
    });
    expect(await adapter.getFunnel('f1')).toEqual({ id: 'f1', title: 'Quiz', tokenIds: { facebook: 't1' }, utmifyPixelId: 'abc' });
  });
});

describe('TrackingApiAdapter.getPayment', () => {
  const row = {
    id: 'pay1', status: 'paid', createdAt: '2026-11-10T10:00:00Z',
    name: 'Maria Silva', email: 'maria@exemplo.com', cpf: '12345678900', phone: '31999990000',
    fbc: 'fb.1.123.abc', fbp: 'fb.1.456', ttclid: '', ttp: undefined,
    utmify: { params: { utm_source: 'facebook', utm_campaign: 'c'.repeat(300) } },
    trackingDispatch: {
      success: false, at: '2026-11-10T10:01:00Z', metrics_paid_dispatched: false,
      facebook: { ok: false, sent: 0, failed: 1, total: 1, event: 'Purchase', time: 'x', details: [{ title: 'Pixel', code: 'AB12…YZ89', ok: false, error: 'bad token' }] },
      stray: { ok: true },
    },
  };

  it('keeps attribution and dispatch and drops every buyer field', async () => {
    http.get.mockResolvedValueOnce({ payments: [row] });
    const payment = await adapter.getPayment('biz', 'pay1');
    expect(http.get).toHaveBeenCalledWith('/api/get-clients/business/biz/payments/pay1');
    expect(payment.utms.utm_source).toBe('facebook');
    expect(payment.utms.utm_campaign).toHaveLength(120);
    expect(payment.clickIds).toEqual({ fbc: true, fbp: true, ttclid: false, ttp: false });
    expect(payment.dispatch!.facebook).toMatchObject({ ok: false, failed: 1 });
    expect(Object.keys(payment.dispatch!)).toEqual(['facebook']);
    expect(payment.flags).toEqual({ created: null, paid: false, refunded: null, chargedback: null });
    const out = JSON.stringify(payment);
    expect(out).not.toMatch(/Maria|maria@|12345678900|31999990000|fb\.1\./);
  });

  it('has a null dispatch when the row does not carry one', async () => {
    http.get.mockResolvedValueOnce({ payments: [{ id: 'p', status: 'paid' }] });
    expect((await adapter.getPayment('biz', 'p')).dispatch).toBeNull();
  });

  it('throws not found for an empty answer', async () => {
    http.get.mockResolvedValueOnce({ payments: [] });
    await expect(adapter.getPayment('biz', 'nope')).rejects.toThrow('not found');
  });
});
