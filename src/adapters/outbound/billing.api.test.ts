import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingApiAdapter } from './billing.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('BillingApiAdapter', () => {
  let adapter: BillingApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new BillingApiAdapter(http);
  });

  it('getBalance GETs /api/billing/balance', async () => {
    vi.mocked(http.get).mockResolvedValue({ currentBalanceCents: 5000 });
    const result = await adapter.getBalance();
    expect(http.get).toHaveBeenCalledWith('/api/billing/balance');
    expect(result.currentBalanceCents).toBe(5000);
  });

  it('listInvoices passes status and limit filters', async () => {
    vi.mocked(http.get).mockResolvedValue({ invoices: [], total: 0 });
    await adapter.listInvoices({ status: 'pending', limit: 10 });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('status=pending');
    expect(url).toContain('limit=10');
  });

  it('payInvoice POSTs with method in body', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, qrCode: 'qr123' });
    const result = await adapter.payInvoice('inv-1', 'pix');
    expect(http.post).toHaveBeenCalledWith('/api/billing/invoices/inv-1/pay', { method: 'pix' });
    expect(result.qrCode).toBe('qr123');
  });

  it('addCredit POSTs amountCents', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, creditId: 'cr-1', qrCode: 'qr', qrCodeImage: 'img', expiresAt: '2024-12-31' });
    const result = await adapter.addCredit(10000);
    expect(http.post).toHaveBeenCalledWith('/api/billing/credit', { amountCents: 10000 });
    expect(result.creditId).toBe('cr-1');
  });

  it('removeCard calls DELETE /api/billing/card/status', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.removeCard();
    expect(http.delete).toHaveBeenCalledWith('/api/billing/card/status');
  });
});
