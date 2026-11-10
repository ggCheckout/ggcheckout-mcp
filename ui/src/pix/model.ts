// One PIX view for every tool that answers with a PIX: create_pix_charge / get_payment_intent
// (payments API), add_credit / get_credit_topup (billing credit) and pay_invoice. The answer's shape
// says which one it is, and `poll` is the tool call that tells whether it was paid. Pure.

import { isPayload, type Payload } from '../lib/payload';

export type PixStatus = 'pending' | 'paid' | 'expired' | 'canceled' | 'failed' | 'none';

export interface PixCharge {
  kind: 'intent' | 'topup' | 'invoice';
  title: string;
  id: string | null;
  amountCents: number | null;
  description?: string | null;
  code: string | null;
  qrSrc: string | null;
  expiresAt: string | null;
  status: PixStatus;
  livemode: boolean;
  poll: { tool: string; args: Record<string, unknown> } | null;
}

const INTENT_STATUS: Record<string, PixStatus> = {
  processing: 'pending',
  requires_action: 'pending',
  succeeded: 'paid',
  expired: 'expired',
  canceled: 'canceled',
  failed: 'failed',
};
const TOPUP_STATUS: Record<string, PixStatus> = { pending: 'pending', paid: 'paid', expired: 'expired' };
const LEGACY_CREDIT_STATUS: Record<string, PixStatus> = { pending: 'pending', confirmed: 'paid', used: 'paid', expired: 'expired' };

export const FINAL_STATUSES = new Set<PixStatus>(['paid', 'expired', 'canceled', 'failed']);

/** An <img> src for the QR: only a base64 image, never a URL the sandbox would try to fetch. */
export function qrImageSrc(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('data:')) return /^data:image\/(png|jpeg|gif|svg\+xml|webp);base64,/.test(value) ? value : null;
  return /^[A-Za-z0-9+/=\s]+$/.test(value) ? `data:image/png;base64,${value.replace(/\s/g, '')}` : null;
}

function fromTopup(t: Payload, via: string): PixCharge {
  return {
    kind: 'topup',
    title: 'Recarga de créditos',
    id: t.creditId ?? null,
    amountCents: t.amountCents ?? null,
    code: t.pixCode ?? null,
    qrSrc: qrImageSrc(t.pixQrBase64),
    expiresAt: t.expiresAt ?? null,
    status: TOPUP_STATUS[t.status] ?? 'pending',
    livemode: true,
    poll: via === 'legacy' ? { tool: 'list_credits', args: { limit: 50 } } : { tool: 'get_credit_topup', args: {} },
  };
}

/** Null when `data` is no PIX answer this view knows. */
export function normalizePix(data: unknown, now = Date.now()): PixCharge | null {
  if (!isPayload(data)) return null;

  if (data.object === 'payment_intent') {
    return {
      kind: 'intent',
      title: data.livemode === false ? 'Cobrança PIX (teste)' : 'Cobrança PIX',
      id: data.id,
      amountCents: data.amount ?? null,
      description: data.description ?? null,
      code: data.pix?.copy_paste ?? null,
      qrSrc: qrImageSrc(data.pix?.qr_base64),
      expiresAt: data.pix?.expires_at ?? data.expires_at ?? null,
      status: INTENT_STATUS[data.status] ?? 'pending',
      livemode: data.livemode !== false,
      poll: { tool: 'get_payment_intent', args: { id: data.id } },
    };
  }

  // add_credit: { creditId, via, pixCode, ... }; a fresh top-up is pending by definition.
  if (typeof data.creditId === 'string' && 'via' in data) return fromTopup({ ...data, status: 'pending' }, data.via);

  // get_credit_topup: { topup: {...} | null }. The route answers the seller's LATEST top-up, finished
  // or not (the poll after add_credit needs to see it turn paid). Once its PIX window is over, a
  // finished one is history, not the current top-up: QA drew a two-month-old paid R$ 5,00 as if the
  // seller had just asked about it.
  if ('topup' in data) {
    const t = isPayload(data.topup) ? data.topup : null;
    const status = t ? TOPUP_STATUS[t.status] ?? 'pending' : 'none';
    const over = t && status !== 'pending' && Date.parse(t.expiresAt) < now;
    if (!t || over) {
      return { kind: 'topup', title: 'Recarga de créditos', id: null, amountCents: null, code: null, qrSrc: null, expiresAt: null, status: 'none', livemode: true, poll: null };
    }
    return fromTopup(t, 'topup');
  }

  // pay_invoice: the open invoice's PIX, { invoiceId, amountCents, status, pixCode, pixQrBase64, expiresAt }.
  if (typeof data.invoiceId === 'string' && 'pixCode' in data) {
    return {
      kind: 'invoice',
      title: 'Pagamento de fatura',
      id: data.invoiceId,
      amountCents: data.amountCents ?? null,
      code: data.pixCode ?? null,
      qrSrc: qrImageSrc(data.pixQrBase64),
      expiresAt: data.expiresAt ?? null,
      status: data.status === 'paid' ? 'paid' : 'pending',
      livemode: true,
      poll: { tool: 'get_invoice', args: { invoiceId: data.invoiceId } },
    };
  }

  return null;
}

/** The status a poll answer reports for `charge`, or null when it does not mention it. */
export function polledStatus(charge: PixCharge, data: unknown): PixStatus | null {
  if (!isPayload(data)) return null;
  switch (charge.poll?.tool) {
    case 'get_payment_intent':
      return data.id === charge.id ? (INTENT_STATUS[data.status] ?? null) : null;
    case 'get_credit_topup':
      return data.topup?.creditId === charge.id ? (TOPUP_STATUS[data.topup.status] ?? null) : null;
    case 'list_credits': {
      const credit = (Array.isArray(data.credits) ? data.credits : []).find((c: Payload) => c.id === charge.id);
      return credit ? (LEGACY_CREDIT_STATUS[credit.status] ?? null) : null;
    }
    case 'get_invoice':
      return data.invoice?.id === charge.id && data.invoice.status === 'paid' ? 'paid' : null;
    default:
      return null;
  }
}

/** "14:59" for the time left, null once past. */
export function formatRemaining(expiresAt: string, now = Date.now()): string | null {
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return null;
  const seconds = Math.floor((end - now) / 1000);
  if (seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
