import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShippingApiAdapter } from './shipping.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('ShippingApiAdapter', () => {
  let adapter: ShippingApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new ShippingApiAdapter(http);
  });

  it('calculate POSTs to /api/melhorenvio/calculate', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, options: [] });
    await adapter.calculate({ toPostalCode: '01001000', checkoutId: 'ck-1' });
    expect(http.post).toHaveBeenCalledWith('/api/melhorenvio/calculate', { toPostalCode: '01001000', checkoutId: 'ck-1' });
  });

  it('verifyShipping GETs with paymentId and businessId as query params', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, posted: false });
    await adapter.verifyShipping('pay-1', 'biz-1');
    expect(http.get).toHaveBeenCalledWith('/api/melhorenvio/verify-shipping?paymentId=pay-1&businessId=biz-1');
  });

  it('cancelCart DELETEs with body payload', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.cancelCart('pay-1', 'biz-1', 'cart-1');
    expect(http.delete).toHaveBeenCalledWith('/api/melhorenvio/cart/cancel', { paymentId: 'pay-1', businessId: 'biz-1', cartId: 'cart-1' });
  });

  it('generateLabel POSTs paymentId, businessId, orderId', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, generated: true, printUrl: 'https://...' });
    await adapter.generateLabel('pay-1', 'biz-1', 'order-1');
    expect(http.post).toHaveBeenCalledWith('/api/melhorenvio/generate', { paymentId: 'pay-1', businessId: 'biz-1', orderId: 'order-1' });
  });

  it('printLabel POSTs businessId and orderId', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, url: 'https://print.url' });
    const result = await adapter.printLabel('biz-1', 'order-1');
    expect(http.post).toHaveBeenCalledWith('/api/melhorenvio/print', { businessId: 'biz-1', orderId: 'order-1' });
    expect(result.url).toBe('https://print.url');
  });
});
