import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentApiAdapter } from './payment.api.js';
import { NotFoundError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('PaymentApiAdapter', () => {
  let adapter: PaymentApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new PaymentApiAdapter(http);
  });

  it('list calls correct URL with businessId', async () => {
    vi.mocked(http.get).mockResolvedValue({ payments: [] });
    await adapter.list('biz-1');
    expect(http.get).toHaveBeenCalledWith('/api/get-clients/business/biz-1/payments');
  });

  it('getPaginated builds query string from options', async () => {
    vi.mocked(http.get).mockResolvedValue({ payments: [], total: 0 });
    await adapter.getPaginated('biz-1', { pageSize: 20, status: 'paid', dateFrom: '2024-01-01' });

    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('pageSize=20');
    expect(url).toContain('status=paid');
    expect(url).toContain('dateFrom=2024-01-01');
  });

  it('getPaginated skips status=all', async () => {
    vi.mocked(http.get).mockResolvedValue({ payments: [], total: 0 });
    await adapter.getPaginated('biz-1', { status: 'all' });

    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).not.toContain('status');
  });

  it('getById fetches single payment via dedicated endpoint', async () => {
    const mockPayment = { id: 'pay-1', email: 'test@test.com' };
    vi.mocked(http.get).mockResolvedValue({ payments: [mockPayment] });

    const result = await adapter.getById('biz-1', 'pay-1');
    expect(http.get).toHaveBeenCalledWith('/api/get-clients/business/biz-1/payments/pay-1');
    expect(result.id).toBe('pay-1');
  });

  it('getById throws NotFoundError when payments array is empty', async () => {
    vi.mocked(http.get).mockResolvedValue({ payments: [] });
    await expect(adapter.getById('biz-1', 'pay-missing')).rejects.toThrow(NotFoundError);
  });

  it('getFulfillment GETs correct nested URL', async () => {
    vi.mocked(http.get).mockResolvedValue({ fulfillment: null, shippingInfo: null, address: null });
    await adapter.getFulfillment('biz-1', 'pay-1');
    expect(http.get).toHaveBeenCalledWith('/api/get-clients/business/biz-1/payments/pay-1/fulfillment');
  });

  it('updateFulfillment PATCHes correct URL with body', async () => {
    vi.mocked(http.patch).mockResolvedValue({ success: true, fulfillment: {} });
    await adapter.updateFulfillment('biz-1', 'pay-1', { status: 'shipped' as any, tracking: { code: 'TR123', carrier: 'Correios' } });
    expect(http.patch).toHaveBeenCalledWith(
      '/api/get-clients/business/biz-1/payments/pay-1/fulfillment',
      { status: 'shipped', tracking: { code: 'TR123', carrier: 'Correios' } },
    );
  });

  it('checkStatus GETs /api/payments/check-payment/{id}', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { status: 'paid' } });
    const result = await adapter.checkStatus('pay-1');
    expect(http.get).toHaveBeenCalledWith('/api/payments/check-payment/pay-1');
    expect(result.data.status).toBe('paid');
  });
});
