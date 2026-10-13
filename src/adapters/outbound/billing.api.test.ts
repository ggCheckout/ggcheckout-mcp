import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingApiAdapter } from './billing.api.js';
import type { HttpClient } from './http-client.js';
import { ApiError } from '../../shared/errors.js';

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

  it('addCredit follows the 409 that sends a migrated seller to the top-up route', async () => {
    vi.mocked(http.post)
      .mockRejectedValueOnce(new ApiError(409, 'Seller migrado: use POST /api/billing/credit/topup'))
      .mockResolvedValueOnce({ topupId: 't-1', amountCents: 1000, pix: { emv: 'emv', qrBase64: 'qr', expiresAt: 'x' } });

    const result = await adapter.addCredit(1000, 'key-1');

    expect(http.post).toHaveBeenLastCalledWith('/api/billing/credit/topup', { amountCents: 1000, idempotencyKey: 'key-1' });
    expect(result).toMatchObject({ creditId: 't-1', pixCode: 'emv', via: 'topup' });
  });

  it('addCredit surfaces any other 409 instead of opening a top-up', async () => {
    vi.mocked(http.post).mockRejectedValueOnce(new ApiError(409, 'Conflito'));

    await expect(adapter.addCredit(1000)).rejects.toThrow('Conflito');
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('listCredits sends the same limit to both statements', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({ credits: [], total: 0 })
      .mockResolvedValueOnce({ entries: [], nextBefore: null });

    await adapter.listCredits({ limit: 200 });

    const urls = vi.mocked(http.get).mock.calls.map((call) => call[0] as string);
    expect(urls).toEqual(['/api/billing/credit?limit=200', '/api/billing/credit-ledger?limit=200']);
  });

  // An empty list beside a failure would read as "no credits", which is the very confusion
  // reading both statements exists to avoid.
  it('listCredits keeps the side that answered and reports the one that failed', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({ credits: [{ id: 'c1' }], total: 1 })
      .mockRejectedValueOnce(new ApiError(500, 'ledger down'));

    const result = await adapter.listCredits();

    expect(result.credits).toEqual([{ id: 'c1' }]);
    expect(result.ledger).toEqual({ entries: [], nextBefore: null });
    expect(result.ledgerError).toContain('ledger down');
    expect(result).not.toHaveProperty('creditsError');
  });

  it('listCredits fails when neither statement answers', async () => {
    vi.mocked(http.get)
      .mockRejectedValueOnce(new ApiError(500, 'legacy down'))
      .mockRejectedValueOnce(new ApiError(500, 'ledger down'));

    await expect(adapter.listCredits()).rejects.toThrow('legacy down');
  });

  it('getCreditTopup normalizes the current top-up of the new billing', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({
      topupId: 't-1', amountCents: 1000, status: 'pending', pix: { emv: 'emv', qrBase64: 'qr', expiresAt: 'x' },
    });

    expect(await adapter.getCreditTopup()).toEqual({
      creditId: 't-1', amountCents: 1000, status: 'pending', pixCode: 'emv', pixQrBase64: 'qr', expiresAt: 'x',
    });
    expect(http.get).toHaveBeenCalledWith('/api/billing/credit/topup');
  });

  it('getCreditTopup answers null when there is none', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ topup: null });

    expect(await adapter.getCreditTopup()).toBeNull();
  });

  it('removeCard calls DELETE /api/billing/card/status', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.removeCard();
    expect(http.delete).toHaveBeenCalledWith('/api/billing/card/status');
  });
});
