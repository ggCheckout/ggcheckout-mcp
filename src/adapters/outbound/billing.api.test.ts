import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingApiAdapter } from './billing.api.js';
import type { HttpClient } from './http-client.js';
import { ApiError } from '../../shared/errors.js';
import type { BalanceResponse } from '../../core/types/billing.js';

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

  // closingAt and cycleStartAt come null when the payments engine did not answer; they pass through
  // untouched.
  it('getBalance passes null cycle dates through', async () => {
    const body: BalanceResponse = {
      currentBalanceCents: 0, creditBalanceCents: 0, netBalanceCents: 820, level: 5, limitCents: 7000,
      limitWithToleranceCents: 8050, usagePercent: 12, usageCents: 820, usageLimitCents: 7000,
      closingAt: null, cycleStartAt: null,
    };
    vi.mocked(http.get).mockResolvedValue(body);
    const result = await adapter.getBalance();
    expect(result.closingAt).toBeNull();
    expect(result.cycleStartAt).toBeNull();
  });

  it('listInvoices passes status and limit filters', async () => {
    vi.mocked(http.get).mockResolvedValue({ invoices: [], total: 0 });
    await adapter.listInvoices({ status: 'pending', limit: 10 });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('status=pending');
    expect(url).toContain('limit=10');
  });

  describe('payInvoice', () => {
    const open = { id: 'inv-1', status: 'overdue', track: 'sales' };
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const pix = { invoiceId: 'inv-1', amountCents: 1460, status: 'overdue', pix: { emv: 'emv', qrBase64: 'qr', gateway: 'efi', expiresAt: 'x' } };
    const livePix = { ...pix, pix: { ...pix.pix, expiresAt: future } };
    const noPix = { pix: null };

    /** The invoice read, then the read-only PIX lookup. */
    function mockReads(invoice: object, lookup: object) {
      vi.mocked(http.get).mockImplementation(async (url: string) => (url.startsWith('/api/billing/pix') ? lookup : invoice) as any);
    }

    it('asks for the PIX of the invoice track and normalizes it', async () => {
      mockReads(open, noPix);
      vi.mocked(http.post).mockResolvedValue(pix);

      expect(await adapter.payInvoice('inv-1')).toEqual({
        invoiceId: 'inv-1', amountCents: 1460, status: 'overdue', pixCode: 'emv', pixQrBase64: 'qr', expiresAt: 'x',
      });
      expect(http.get).toHaveBeenCalledWith('/api/billing/invoices/inv-1');
      expect(http.get).toHaveBeenCalledWith('/api/billing/pix?track=sales');
      expect(http.post).toHaveBeenCalledWith('/api/billing/pix?track=sales');
    });

    it('returns the live PIX of the invoice without spending the POST limit', async () => {
      mockReads(open, livePix);

      expect(await adapter.payInvoice('inv-1')).toEqual({
        invoiceId: 'inv-1', amountCents: 1460, status: 'overdue', pixCode: 'emv', pixQrBase64: 'qr', expiresAt: future,
      });
      expect(http.post).not.toHaveBeenCalled();
    });

    it('issues a new PIX when the one on file is expired', async () => {
      mockReads(open, { ...pix, pix: { ...pix.pix, expiresAt: new Date(Date.now() - 1000).toISOString() } });
      vi.mocked(http.post).mockResolvedValue(livePix);

      expect((await adapter.payInvoice('inv-1')).expiresAt).toBe(future);
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('routes a WhatsApp invoice to its own track', async () => {
      mockReads({ ...open, track: 'whatsapp' }, noPix);
      vi.mocked(http.post).mockResolvedValue(pix);
      await adapter.payInvoice('inv-1');
      expect(http.get).toHaveBeenCalledWith('/api/billing/pix?track=whatsapp');
      expect(http.post).toHaveBeenCalledWith('/api/billing/pix?track=whatsapp');
    });

    it('does not issue a PIX for a paid invoice', async () => {
      vi.mocked(http.get).mockResolvedValue({ ...open, status: 'paid' });
      await expect(adapter.payInvoice('inv-1')).rejects.toThrow('already paid');
      expect(http.post).not.toHaveBeenCalled();
    });

    // The route pays the open invoice of the track, whichever it is: handing that PIX back for
    // another id would have the seller pay an invoice they did not ask about. The GET names it
    // for free, so the limited POST is never spent on it.
    it('refuses another invoice from the read, names the open one and never POSTs', async () => {
      mockReads({ ...open, id: 'inv-old' }, livePix);
      await expect(adapter.payInvoice('inv-old')).rejects.toThrow('only inv-1 can be paid now');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('refuses a POST answer that pays another invoice', async () => {
      mockReads({ ...open, id: 'inv-old' }, noPix);
      vi.mocked(http.post).mockResolvedValue(pix);
      await expect(adapter.payInvoice('inv-old')).rejects.toThrow('only inv-1 can be paid now');
    });

    it('says so when there is no open invoice', async () => {
      mockReads(open, noPix);
      vi.mocked(http.post).mockResolvedValue({ pix: null });
      await expect(adapter.payInvoice('inv-1')).rejects.toThrow('has no PIX to pay');
    });

    it('explains the PIX rate limit', async () => {
      mockReads(open, noPix);
      vi.mocked(http.post).mockRejectedValue(new ApiError(429, 'pix_refused'));
      await expect(adapter.payInvoice('inv-1')).rejects.toThrow('10 per hour');
    });

    it('explains a gateway refusal', async () => {
      mockReads(open, noPix);
      vi.mocked(http.post).mockRejectedValue(new ApiError(422, 'refused'));
      await expect(adapter.payInvoice('inv-1')).rejects.toThrow('gateway refused');
    });
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
