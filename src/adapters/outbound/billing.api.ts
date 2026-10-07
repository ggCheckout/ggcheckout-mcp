import type { BillingPort } from '../../core/ports/billing.port.js';
import type {
  BalanceResponse, BillingStatusResponse, BillingHistoryEntry,
  SellerInvoice, BillingCredit, BillingCard, CreditLedgerPage, CreditTopup,
} from '../../core/types/billing.js';
import { sanitizeBillingCard } from '../../shared/sanitizer.js';
import { ApiError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

export class BillingApiAdapter implements BillingPort {
  constructor(private readonly http: HttpClient) {}

  async getBalance(): Promise<BalanceResponse> {
    return this.http.get<BalanceResponse>('/api/billing/balance');
  }

  async getStatus(): Promise<BillingStatusResponse> {
    return this.http.get<BillingStatusResponse>('/api/billing/status');
  }

  async getHistory(options?: { limit?: number; type?: string }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);
    const qs = params.toString();
    return this.http.get<{ history: BillingHistoryEntry[]; total: number }>(`/api/billing/history${qs ? `?${qs}` : ''}`);
  }

  async listInvoices(options?: { status?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const qs = params.toString();
    return this.http.get<{ invoices: SellerInvoice[]; total: number }>(`/api/billing/invoices${qs ? `?${qs}` : ''}`);
  }

  async getInvoice(id: string): Promise<SellerInvoice> {
    return this.http.get<SellerInvoice>(`/api/billing/invoices/${id}`);
  }

  async payInvoice(id: string, method: 'pix' | 'card' | 'credits') {
    return this.http.post<{ success: boolean; qrCode?: string; qrCodeImage?: string }>(
      `/api/billing/invoices/${id}/pay`, { method },
    );
  }

  /**
   * Two statements, one answer. `/api/billing/credit` is the legacy one and answers an empty list
   * for a seller on the new generation (a true "no legacy PIX credits", not an error); the real
   * statement for those lives in `/api/billing/credit-ledger`, which answers an empty page for a
   * seller still on the old one. Reading both is what the dashboard does, and it means the caller
   * does not have to know which generation the account is on — the side that has data answers.
   */
  async listCredits(options?: { status?: string; limit?: number; before?: string }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const qs = params.toString();

    const ledgerParams = new URLSearchParams();
    if (options?.limit) ledgerParams.append('limit', Math.min(options.limit, 100).toString());
    if (options?.before) ledgerParams.append('before', options.before);
    const ledgerQs = ledgerParams.toString();

    const [legacy, ledger] = await Promise.all([
      this.http.get<{ credits: BillingCredit[]; total: number }>(`/api/billing/credit${qs ? `?${qs}` : ''}`),
      this.http.get<CreditLedgerPage>(`/api/billing/credit-ledger${ledgerQs ? `?${ledgerQs}` : ''}`),
    ]);
    return { ...legacy, ledger };
  }

  /**
   * The legacy route refuses a migrated seller with 409 ("use POST /api/billing/credit/topup"),
   * and the new route is the only one that reaches the Postgres balance. Trying the legacy one
   * first and following the 409 keeps both generations working without the MCP having to know
   * which one the account is on; the 409 is a refusal, so nothing was written when it happens.
   */
  async addCredit(amountCents: number, idempotencyKey?: string): Promise<CreditTopup> {
    try {
      const legacy = await this.http.post<{
        success: boolean; creditId: string; qrCode: string; qrCodeImage: string; expiresAt: string;
      }>('/api/billing/credit', { amountCents });
      return {
        creditId: legacy.creditId,
        amountCents,
        pixCode: legacy.qrCode ?? null,
        pixQrBase64: legacy.qrCodeImage ?? null,
        expiresAt: legacy.expiresAt ?? null,
        via: 'legacy',
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 409) throw error;
      const topup = await this.http.post<{
        topupId: string;
        amountCents: number;
        pix: { emv: string; qrBase64: string; expiresAt: string } | null;
      }>('/api/billing/credit/topup', {
        amountCents,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
      return {
        creditId: topup.topupId,
        amountCents: topup.amountCents,
        pixCode: topup.pix?.emv ?? null,
        pixQrBase64: topup.pix?.qrBase64 ?? null,
        expiresAt: topup.pix?.expiresAt ?? null,
        via: 'topup',
      };
    }
  }

  async getCardStatus() {
    const data = await this.http.get<{ hasCard: boolean; card?: BillingCard; isExpiringSoon: boolean }>('/api/billing/card/status');
    return sanitizeBillingCard(data);
  }

  async removeCard(): Promise<void> {
    await this.http.delete('/api/billing/card/status');
  }
}
