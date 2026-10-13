import type {
  BalanceResponse, BillingStatusResponse, BillingHistoryEntry,
  SellerInvoice, BillingCredit, BillingCard, CreditLedgerPage, CreditTopup,
} from '../types/billing.js';

export interface BillingPort {
  getBalance(): Promise<BalanceResponse>;
  getStatus(): Promise<BillingStatusResponse>;
  getHistory(options?: { limit?: number; type?: string }): Promise<{ history: BillingHistoryEntry[]; total: number }>;
  listInvoices(options?: { status?: string; limit?: number }): Promise<{ invoices: SellerInvoice[]; total: number }>;
  getInvoice(id: string): Promise<SellerInvoice>;
  payInvoice(id: string, method: 'pix' | 'card' | 'credits'): Promise<{ success: boolean; qrCode?: string; qrCodeImage?: string }>;
  listCredits(options?: { status?: string; limit?: number; before?: string }): Promise<{
    credits: BillingCredit[];
    total: number;
    ledger: CreditLedgerPage;
    /** Set when that side failed; its list above is then empty, not "no data". */
    creditsError?: string;
    ledgerError?: string;
  }>;
  addCredit(amountCents: number, idempotencyKey?: string): Promise<CreditTopup>;
  getCardStatus(): Promise<{ hasCard: boolean; card?: BillingCard; isExpiringSoon: boolean }>;
  removeCard(): Promise<void>;
}
