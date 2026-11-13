// Turns the billing tools into what the wallet view draws, following the seller's /billing page
// (saas-checkout app/(app)/(private)/billing and components/billing): get_billing_status and
// get_billing_balance become the CreditWalletCard, list_invoices / get_invoice the InvoiceList and its
// detail, list_credits the Extrato. Every amount is integer cents. Pure.

import { formatDateTime, parseDate } from '../lib/format';
import { type Payload, count, finite, isPayload, text } from '../lib/payload';

/** applyBillingTolerance: the emergency credit on top of the level's limit. */
export const TOLERANCE_PCT = 15;
const withTolerance = (limitCents: number) => Math.ceil(limitCents * (1 + TOLERANCE_PCT / 100));

/** CREDIT_LEVELS (saas lib/constants.ts): limit and paid invoices to unlock, the six gem levels. */
const LEVELS = [
  { name: 'Iron', limitCents: 500, requiredPaidCents: 0 },
  { name: 'Bronze', limitCents: 1000, requiredPaidCents: 500 },
  { name: 'Silver', limitCents: 2000, requiredPaidCents: 1500 },
  { name: 'Gold', limitCents: 3500, requiredPaidCents: 3500 },
  { name: 'Platinum', limitCents: 7000, requiredPaidCents: 7000 },
  { name: 'Diamond', limitCents: 10000, requiredPaidCents: 14000 },
];

export interface CreditLevel {
  name: string;
  /** Past the last gem the limit grows on its own (levels 7 to 10). */
  autoScale: boolean;
  next: { name: string; limitCents: number; requiredPaidCents: number } | null;
}

export function creditLevel(level: number | null): CreditLevel | null {
  if (level == null || level < 1) return null;
  const index = Math.min(level, LEVELS.length) - 1;
  const next = LEVELS[index + 1] ?? null;
  return { name: LEVELS[index].name, autoScale: level >= LEVELS.length, next };
}

export interface Wallet {
  /** Credit minus what is due this cycle: > 0 is prepaid balance, < 0 is owed (CreditWalletCard). */
  signedNetCents: number;
  /** What is owed against the limit, never negative (the usage bar). */
  usedCents: number;
  limitCents: number;
  limitWithToleranceCents: number;
  level: number | null;
  /** Paid invoices so far, which climb the level ladder; only the status answer has it. */
  totalPaidCents: number | null;
  /** When the cycle closes; null when the account has no cycle. */
  closingAt: string | null;
  /** get_billing_balance: the view confirms the closing date against get_billing_status. */
  fromBalance: boolean;
  /** A closed invoice is still unpaid (grace or blocked): the closing is paused until it is paid. */
  overdue: boolean;
  blocked: boolean;
  grace: boolean;
  /** When the store goes down if the open invoice stays unpaid. */
  graceEndsAt: string | null;
  openInvoiceCents: number | null;
}

function fromStatus(s: Payload): Wallet {
  const open = isPayload(s.paymentsOpenInvoice) ? s.paymentsOpenInvoice : null;
  const migrated = typeof s.paymentsCreditBalanceCents === 'number';
  // The page's signed net: payments credit minus the open invoice, or else the cycle's unbilled fee.
  // netBalanceCents is that same fee minus credit, but without the open invoice, so it is only the
  // fallback for an account still on the legacy billing.
  const signedNetCents = migrated
    ? s.paymentsCreditBalanceCents - (finite(open?.amountCents) ?? Math.max(0, count(s.paymentsUnbilledFeeCents)))
    : -count(s.netBalanceCents);
  const limitCents = finite(s.paymentsCreditLimitCents) ?? finite(s.limitCents) ?? LEVELS[0].limitCents;
  const blocked = s.isBlocked === true || (s.billingStatus ?? s.status) === 'blocked';
  return {
    signedNetCents,
    usedCents: Math.max(0, -signedNetCents),
    limitCents,
    limitWithToleranceCents: withTolerance(limitCents),
    level: finite(s.paymentsCreditLevel),
    totalPaidCents: finite(s.paymentsCreditTotalPaidCents),
    closingAt: text(s.paymentsClosingAt),
    fromBalance: false,
    overdue: s.hasOverdueInvoice === true || open?.status === 'overdue' || blocked,
    blocked,
    grace: (s.billingStatus ?? s.status) === 'grace_period',
    graceEndsAt: text(s.graceEndsAt),
    openInvoiceCents: finite(open?.amountCents),
  };
}

function fromBalance(b: Payload): Wallet {
  // On the new billing the route's creditBalanceCents is a frozen mirror (0); netBalanceCents already
  // nets the live payments credit against the cycle's fee, so it is the one number to trust.
  const signedNetCents = -count(b.netBalanceCents);
  const limitCents = finite(b.limitCents) ?? LEVELS[0].limitCents;
  return {
    signedNetCents,
    usedCents: Math.max(0, -signedNetCents),
    limitCents,
    limitWithToleranceCents: finite(b.limitWithToleranceCents) ?? withTolerance(limitCents),
    level: finite(b.level),
    totalPaidCents: null,
    // The payments engine's next close, or null when it did not answer. A saas older than #2232
    // still sends a week counted from the call time here, so the view prefers the status answer's
    // paymentsClosingAt when it has one.
    closingAt: text(b.closingAt),
    fromBalance: true,
    overdue: false,
    blocked: false,
    grace: false,
    graceEndsAt: null,
    openInvoiceCents: null,
  };
}

/** get_billing_status or get_billing_balance; null for anything else. */
export function summarizeWallet(data: unknown): Wallet | null {
  if (!isPayload(data) || typeof data.netBalanceCents !== 'number') return null;
  if ('isDelinquent' in data || 'billingStatus' in data) return fromStatus(data);
  if ('limitWithToleranceCents' in data || 'creditBalanceCents' in data) return fromBalance(data);
  return null;
}

/** usageTone (components/billing/helpers.tsx): against the base limit, not the tolerance. */
export type UsageTone = 'neutral' | 'warn' | 'danger';

export function usageTone(usedCents: number, limitCents: number): UsageTone {
  if (limitCents <= 0) return 'neutral';
  const ratio = usedCents / limitCents;
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.7) return 'warn';
  return 'neutral';
}

/** UsageLimitBar: share of the limit with tolerance, capped at 100. */
export function usagePercent(wallet: Wallet): number {
  if (wallet.limitWithToleranceCents <= 0) return 0;
  return Math.min(100, Math.round((wallet.usedCents / wallet.limitWithToleranceCents) * 100));
}

export interface InvoiceRow {
  id: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
  paidAt: string | null;
  /** Sales and their volume in the period; null when the API did not count them. */
  salesCount: number | null;
  salesVolumeCents: number | null;
  /** computeInvoiceBreakdown: the fee before credit, what credit paid and what was left to pay. */
  grossCents: number;
  creditAppliedCents: number;
  netCents: number;
  whatsappCents: number;
  sacCents: number;
}

/** computeInvoiceBreakdown (components/billing/invoiceBreakdown.ts). */
function breakdown(inv: Payload) {
  const totalFee = count(inv.totalFeeCents);
  const credit = Math.max(0, count(inv.creditAppliedCents));
  if (typeof inv.feeGrossCents === 'number') {
    const applied = Math.min(credit, inv.feeGrossCents);
    return { grossCents: inv.feeGrossCents, creditAppliedCents: applied, netCents: inv.feeGrossCents - applied };
  }
  // Born paid: closed and settled at the same instant, so the total is what credit paid.
  if (inv.paidAt && inv.paidAt === inv.periodEnd) return { grossCents: totalFee, creditAppliedCents: totalFee, netCents: 0 };
  return { grossCents: totalFee + credit, creditAppliedCents: credit, netCents: totalFee };
}

export function toInvoiceRow(inv: Payload): InvoiceRow {
  const salesCount = finite(inv.transactionCount);
  const salesVolumeCents = finite(inv.grossVolumeCents);
  return {
    id: String(inv.id ?? ''),
    status: String(inv.status ?? 'pending'),
    periodStart: text(inv.periodStart),
    periodEnd: text(inv.periodEnd),
    dueAt: text(inv.dueAt),
    paidAt: text(inv.paidAt),
    salesCount,
    salesVolumeCents: salesCount == null ? null : salesVolumeCents,
    ...breakdown(inv),
    whatsappCents: count(inv.whatsappUsageCents),
    sacCents: count(inv.sacOverageCents),
  };
}

/** The amount a row shows: the gross fee once paid, else what is still to pay (InvoiceList). */
export const invoiceAmount = (row: InvoiceRow) => (row.status === 'paid' ? row.grossCents : row.netCents);

/** list_invoices; null for anything else. */
export function summarizeInvoices(data: unknown): InvoiceRow[] | null {
  if (!isPayload(data) || !Array.isArray(data.invoices)) return null;
  return data.invoices.filter(isPayload).map(toInvoiceRow);
}

/** get_invoice answers `{ invoice }`; null for anything else. */
export function summarizeInvoice(data: unknown): InvoiceRow | null {
  if (!isPayload(data) || !isPayload(data.invoice) || !('periodStart' in data.invoice)) return null;
  return toInvoiceRow(data.invoice);
}

const INVOICE_STATUS: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', processing: 'Processando', failed: 'Falhou', overdue: 'Vencida', cancelled: 'Cancelado',
};

/** getStatusBadge (components/billing/helpers.tsx). */
export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUS[status] ?? status;
}

export interface LedgerRow {
  id: string;
  kind: string;
  label: string;
  /** Signed: credit +, debit −. */
  amountCents: number;
  /** The running balance after this line; null on the legacy credits, which have none. */
  balanceAfterCents: number | null;
  createdAt: string | null;
  /** A cycle_debit that closed an invoice: drawn as its receipt. */
  receipt: { trigger: 'cap' | 'time' | null; grossCents: number; creditAppliedCents: number; remainingCents: number } | null;
  /** debt_settled: the closing date of the invoice it paid. */
  settledInvoiceAt: string | null;
  /** A top-up that went to an open invoice. */
  pending: { amountCents: number; shortfallCents: number } | null;
  /** Legacy credits only: pending, confirmed, used or expired. */
  legacyStatus: string | null;
}

const LEDGER_LABELS: Record<string, string> = {
  topup: 'Crédito adicionado',
  cycle_debit: 'Abatido no fechamento',
  debt_settled: 'Abatimento de débito',
  opening: 'Saldo migrado',
  adjustment: 'Ajuste',
};

function fromLedgerEntry(e: Payload): LedgerRow {
  const inv = isPayload(e.invoice) ? e.invoice : null;
  const pending = isPayload(e.pendingInvoice) ? e.pendingInvoice : null;
  const receipt = e.kind === 'cycle_debit' && inv && typeof inv.grossCents === 'number'
    ? {
      trigger: inv.closeTrigger === 'cap' || inv.closeTrigger === 'time' ? inv.closeTrigger : null,
      grossCents: inv.grossCents,
      creditAppliedCents: count(inv.creditAppliedCents),
      remainingCents: count(inv.remainingCents),
    }
    : null;
  return {
    id: String(e.id ?? ''),
    kind: String(e.kind ?? ''),
    label: receipt ? 'Fatura fechada' : LEDGER_LABELS[e.kind] ?? String(e.kind ?? '-'),
    amountCents: count(e.amountCents),
    balanceAfterCents: finite(e.balanceAfterCents),
    createdAt: text(e.createdAt),
    receipt,
    settledInvoiceAt: e.kind === 'debt_settled' && inv ? text(inv.closedAt) : null,
    pending: pending ? { amountCents: count(pending.amountCents), shortfallCents: count(pending.shortfallCents) } : null,
    legacyStatus: null,
  };
}

const CREDIT_STATUS: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', used: 'Utilizado', expired: 'Expirado' };

function fromLegacyCredit(c: Payload): LedgerRow {
  const status = String(c.status ?? 'pending');
  return {
    id: String(c.id ?? ''),
    kind: 'legacy',
    label: 'Crédito via PIX',
    amountCents: count(c.amountCents),
    balanceAfterCents: null,
    createdAt: text(c.confirmedAt) ?? text(c.createdAt),
    receipt: null,
    settledInvoiceAt: null,
    pending: null,
    legacyStatus: CREDIT_STATUS[status] ?? status,
  };
}

export interface Ledger {
  rows: LedgerRow[];
  /** Cursor for older ledger lines; null at the end and on the legacy credits. */
  nextBefore: string | null;
  /** A side of the statement could not be read. */
  error: string | null;
}

/** list_credits: the ledger when it has lines (new billing), else the legacy credits; null for anything else. */
export function summarizeLedger(data: unknown): Ledger | null {
  if (!isPayload(data) || !('ledger' in data || Array.isArray(data.credits))) return null;
  const ledger = isPayload(data.ledger) ? data.ledger : null;
  const entries = Array.isArray(ledger?.entries) ? ledger.entries.filter(isPayload) : [];
  const credits = Array.isArray(data.credits) ? data.credits.filter(isPayload) : [];
  const useLedger = entries.length > 0 || credits.length === 0;
  return {
    rows: useLedger ? entries.map(fromLedgerEntry) : credits.map(fromLegacyCredit),
    nextBefore: useLedger ? text(ledger?.nextBefore) : null,
    error: text(data.ledgerError) ?? text(data.creditsError),
  };
}

/** formatFutureDeadline: null once the moment has passed, so the copy never shows a past deadline. */
export function futureDayTime(iso: string | null, now = Date.now()): string | null {
  const d = parseDate(iso);
  return d && d.getTime() > now ? formatDateTime(iso, { separator: ' às ' }) : null;
}
