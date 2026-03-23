import type { BillingPort } from '../../core/ports/billing.port.js';
import type {
  BalanceResponse, BillingStatusResponse, BillingHistoryEntry,
  SellerInvoice, BillingCredit, BillingCard,
} from '../../core/types/billing.js';
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

  async listCredits(options?: { status?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const qs = params.toString();
    return this.http.get<{ credits: BillingCredit[]; total: number }>(`/api/billing/credit${qs ? `?${qs}` : ''}`);
  }

  async addCredit(amountCents: number) {
    return this.http.post<{ success: boolean; creditId: string; qrCode: string; qrCodeImage: string; expiresAt: string }>(
      '/api/billing/credit', { amountCents },
    );
  }

  async getCardStatus() {
    return this.http.get<{ hasCard: boolean; card?: BillingCard; isExpiringSoon: boolean }>('/api/billing/card/status');
  }

  async removeCard(): Promise<void> {
    await this.http.delete('/api/billing/card/status');
  }
}
