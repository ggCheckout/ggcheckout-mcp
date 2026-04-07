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
