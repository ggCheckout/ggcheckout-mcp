export type BillingStatusType = 'active' | 'pending_card' | 'grace_period' | 'blocked';
export type GraceStage = 'T0' | 'T5' | 'T10' | 'T15' | null;
export type InvoiceStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'overdue';
export type CreditStatus = 'pending' | 'confirmed' | 'used' | 'expired';

export interface BillingCard {
  validated: boolean;
  validatedAt: string | null;
  gateway: string;
  tokenId: string | null;
  lastFour: string | null;
  brand: string | null;
  expiresAt: string | null;
}

export interface BalanceResponse {
  currentBalanceCents: number;
  creditBalanceCents: number;
  netBalanceCents: number;
  level: number;
  limitCents: number;
  limitWithToleranceCents: number;
  usagePercent: number;
  nextChargeAt: string | null;
  cycleStartAt: string;
}

export interface BillingStatusResponse {
  status: BillingStatusType;
  isDelinquent: boolean;
  graceStage: GraceStage;
  graceEndsAt: string | null;
  hasValidCard: boolean;
  usesBillingGateway: boolean;
  billingStatus?: BillingStatusType;
  graceStartedAt?: string | null;
  usagePercent?: number;
  netBalanceCents?: number;
  limitCents?: number;
}

export interface BillingHistoryEntry {
  [key: string]: unknown;
}

export interface SellerInvoice {
  id: string;
  businessId: string;
  periodStart: string;
  periodEnd: string;
  totalFeeCents: number;
  transactionCount: number;
  grossVolumeCents: number;
  creditAppliedCents: number;
  status: InvoiceStatus;
  paymentAttempts: any[];
  createdAt: string;
  dueAt: string;
  paidAt: string | null;
  paymentIds?: string[];
}

/** What a credit ledger line is: the v2 statement, kept in the payments service. */
export type CreditLedgerKind = 'topup' | 'cycle_debit' | 'opening' | 'adjustment' | 'debt_settled';

export interface CreditLedgerEntry {
  id: string;
  kind: CreditLedgerKind;
  /** Signed: credit is positive, debit negative. */
  amountCents: number;
  balanceAfterCents: number;
  refId: string | null;
  description: string | null;
  createdAt: string;
  /** Only on `cycle_debit` / `debt_settled`. */
  invoice?: {
    invoiceId: string;
    closedAt: string;
    closeTrigger: 'cap' | 'time' | null;
    grossCents: number | null;
    creditAppliedCents: number | null;
    remainingCents: number | null;
  } | null;
  /** Only on `topup` / positive `adjustment`. `shortfallCents > 0` means the invoice is not settled. */
  pendingInvoice?: {
    invoiceId: string;
    amountCents: number;
    shortfallCents: number;
  } | null;
}

/** Keyset pagination: `nextBefore` is the cursor to pass back, `null` at the end. */
export interface CreditLedgerPage {
  entries: CreditLedgerEntry[];
  nextBefore: string | null;
}

/**
 * One top-up, however the account's generation happens to mint it. The legacy route answers
 * `{ creditId, qrCode, qrCodeImage }` and the v2 route `{ topupId, pix: { emv, qrBase64 } }`;
 * both are normalized to this so a caller does not branch on the seller's generation.
 */
export interface CreditTopup {
  creditId: string;
  amountCents: number;
  /** PIX copy-and-paste string. */
  pixCode: string | null;
  /** QR image as base64, with no `data:` prefix. */
  pixQrBase64: string | null;
  expiresAt: string | null;
  /** Which route served it — `topup` is the Postgres-backed one. */
  via: 'legacy' | 'topup';
}

export interface BillingCredit {
  id: string;
  businessId: string;
  amountCents: number;
  status: CreditStatus;
  pixTransactionId: string | null;
  qrCode: string | null;
  qrCodeImage: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

/**
 * The seller's current top-up on the new billing, as `GET /api/billing/credit/topup` answers it. A
 * pending one is NOT in the credit ledger: its line is only written once the PIX is paid.
 */
export interface PendingCreditTopup {
  creditId: string;
  amountCents: number;
  status: 'pending' | 'paid' | 'expired';
  pixCode: string | null;
  pixQrBase64: string | null;
  expiresAt: string | null;
}
