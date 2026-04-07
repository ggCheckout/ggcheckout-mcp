import type {
  BalanceResponse, BillingStatusResponse, BillingHistoryEntry,
  SellerInvoice, BillingCredit, BillingCard,
} from '../types/billing.js';

export interface BillingPort {
  getBalance(): Promise<BalanceResponse>;
  getStatus(): Promise<BillingStatusResponse>;
  getHistory(options?: { limit?: number; type?: string }): Promise<{ history: BillingHistoryEntry[]; total: number }>;
  listInvoices(options?: { status?: string; limit?: number }): Promise<{ invoices: SellerInvoice[]; total: number }>;
  getInvoice(id: string): Promise<SellerInvoice>;
  payInvoice(id: string, method: 'pix' | 'card' | 'credits'): Promise<{ success: boolean; qrCode?: string; qrCodeImage?: string }>;
  listCredits(options?: { status?: string; limit?: number }): Promise<{ credits: BillingCredit[]; total: number }>;
  addCredit(amountCents: number): Promise<{ success: boolean; creditId: string; qrCode: string; qrCodeImage: string; expiresAt: string }>;
  getCardStatus(): Promise<{ hasCard: boolean; card?: BillingCard; isExpiringSoon: boolean }>;
  removeCard(): Promise<void>;
}
