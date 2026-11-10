// Turns get_payments_paginated / list_payments (a page of payments) and get_payment (one payment)
// into what the payments view draws. The amount is `finalValueInCents` (what the buyer paid, in
// cents); `value` is the same in reais as a float and is only a fallback. Pure.

import { parseDate } from '../lib/format';
import { count, isPayload, type Payload } from '../lib/payload';

export interface PaymentRow {
  id: string;
  status: string;
  method: string | null;
  gateway: string | null;
  amountCents: number;
  installments: number;
  customerName: string | null;
  customerEmail: string | null;
  /** Masked by the server, like the CPF. */
  customerPhone: string | null;
  customerCpf: string | null;
  offer: string | null;
  /** Commission percent when an affiliate made the sale. */
  affiliatePercent: number | null;
  subscription: boolean;
  orderBumps: { title: string; amountCents: number | null }[];
  createdAt: string | null;
  paidAt: string | null;
}

export interface PaymentsPage {
  payments: PaymentRow[];
  /** Count of every payment the filter matches; null when the API skipped counting. */
  total: number | null;
  /** The count stopped at its cap: `total` is a floor. */
  totalCapped: boolean;
  /** Cursor for the next page (`lastCreatedAt`), null on the last one or when the tool has none. */
  nextCursor: string | null;
  /** A search scan hit its read cap: older matches may exist. */
  coverageCapped: boolean;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

function amountCents(p: Payload): number {
  if (typeof p.finalValueInCents === 'number') return p.finalValueInCents;
  if (typeof p.value === 'number') return Math.round(p.value * 100);
  return 0;
}

export function toPaymentRow(p: Payload): PaymentRow {
  return {
    id: String(p.id ?? ''),
    status: String(p.status ?? 'pending'),
    method: text(p.paymentMethod),
    gateway: text(p.gatewayName),
    amountCents: amountCents(p),
    installments: count(p.installments) || 1,
    customerName: text(p.name) ?? text(p.payer_name),
    customerEmail: text(p.emailFormatted) ?? text(p.email),
    customerPhone: text(p.phone),
    customerCpf: text(p.cpf),
    offer: text(p.titleOffer),
    affiliatePercent: isPayload(p.affiliateData) && typeof p.affiliateData.commissionPercent === 'number' ? p.affiliateData.commissionPercent : null,
    subscription: p.paymentMode === 'subscription',
    // Bump prices are cents in both fields (saas PaymentOrderBumpsSection).
    orderBumps: (Array.isArray(p.orderBumps) ? p.orderBumps : []).filter(isPayload).map((b) => {
      const cents = typeof b.priceCents === 'number' ? b.priceCents : typeof b.price === 'number' ? b.price : null;
      return { title: text(b.title) ?? text(b.name) ?? 'Order bump', amountCents: cents };
    }),
    createdAt: text(p.createdAt),
    paidAt: text(p.paidAt),
  };
}

/** A page of payments (get_payments_paginated, list_payments); null for anything else. */
export function summarizePaymentsPage(data: unknown): PaymentsPage | null {
  if (!isPayload(data) || !Array.isArray(data.payments)) return null;
  const counted = typeof data.total === 'number' && (data.total > 0 || data.payments.length === 0);
  return {
    payments: data.payments.filter(isPayload).map(toPaymentRow),
    total: counted ? data.total : null,
    totalCapped: data.totalCapped === true,
    nextCursor: text(data.nextCursor),
    coverageCapped: data.coverageCapped === true,
  };
}

/** One payment (get_payment answers `{ payment }`); null for anything else. */
export function summarizePayment(data: unknown): PaymentRow | null {
  if (!isPayload(data) || !isPayload(data.payment)) return null;
  return toPaymentRow(data.payment);
}

/** Badge tone (saas grid/cells/statusVariant.ts): a raw `failed` stays neutral, like on the dashboard. */
export type StatusVariant = 'paid' | 'expired' | 'failed' | 'pending';

export function statusVariant(status: string): StatusVariant {
  const s = status.toUpperCase();
  if (s === 'PAID') return 'paid';
  if (s === 'EXPIRED') return 'expired';
  if (['REFUSED', 'CHARGEBACK', 'CHARGED_BACK', 'REFUNDED'].includes(s)) return 'failed';
  return 'pending';
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhou', refunded: 'Reembolsado', expired: 'Expirado',
  processing: 'Processando', cancelled: 'Cancelado', chargeback: 'Chargeback', charged_back: 'Chargeback',
  refused: 'Recusado',
};
const STATUS_ALIASES: Record<string, string> = { canceled: 'cancelled', refounded: 'refunded' };

/** lib/statusLabel.ts: legacy spellings mapped, the raw status upper-cased when unknown. */
export function statusLabel(status: string): string {
  const key = status.toLowerCase();
  return STATUS_LABELS[STATUS_ALIASES[key] ?? key] ?? (status ? status.toUpperCase() : '-');
}

const METHOD_NAMES: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão', bank_slip: 'Boleto', paypal: 'PayPal' };

export function methodName(method: string | null): string {
  if (!method) return 'Não informado';
  return METHOD_NAMES[method.toLowerCase()] ?? method;
}

/** lib/utils/initials.ts: the first letters of the name, else of the e-mail's local part. */
export function initials(name: string | null, email: string | null): string {
  const source = name ?? email?.split('@')[0] ?? '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? '').slice(0, 2);
  return letters.toUpperCase() || '?';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The list's date (dayjs 'DD/MM/YYYY · HH:mm'), in the viewer's time zone. */
export function formatListDate(iso: string | null): string {
  const d = parseDate(iso);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}` : '-';
}

/** The detail's date (toLocaleString('pt-BR'), with seconds). */
export function formatDetailDate(iso: string | null): string {
  return parseDate(iso)?.toLocaleString('pt-BR') ?? '-';
}

/** grid/computePageWindow.ts: 1, last and the neighbors of the current page; gaps become null (…). */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  const pages = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const n of pages) {
    const last = out[out.length - 1];
    if (typeof last === 'number' && n - last > 1) out.push(null);
    out.push(n);
  }
  return out;
}
