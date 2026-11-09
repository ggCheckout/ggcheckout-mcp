// One PIX view for every tool that answers with a PIX: create_pix_charge / get_payment_intent
// (payments API), add_credit / get_credit_topup (billing credit) and pay_invoice. The answer's shape
// says which one it is, and `poll` is the tool call that tells whether it was paid. Pure: no DOM.

const INTENT_STATUS = {
  processing: 'pending',
  requires_action: 'pending',
  succeeded: 'paid',
  expired: 'expired',
  canceled: 'canceled',
  failed: 'failed',
};
const TOPUP_STATUS = { pending: 'pending', paid: 'paid', expired: 'expired' };
const LEGACY_CREDIT_STATUS = { pending: 'pending', confirmed: 'paid', used: 'paid', expired: 'expired' };

export const FINAL_STATUSES = new Set(['paid', 'expired', 'canceled', 'failed']);

/** An <img> src for the QR: only a base64 image, never a URL the sandbox would try to fetch. */
export function qrImageSrc(value) {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('data:')) return /^data:image\/(png|jpeg|gif|svg\+xml|webp);base64,/.test(value) ? value : null;
  return /^[A-Za-z0-9+/=\s]+$/.test(value) ? `data:image/png;base64,${value.replace(/\s/g, '')}` : null;
}

function fromTopup(t, via) {
  const status = TOPUP_STATUS[t.status] ?? 'pending';
  return {
    kind: 'topup',
    title: 'Recarga de créditos',
    id: t.creditId ?? null,
    amountCents: t.amountCents ?? null,
    code: t.pixCode ?? null,
    qrSrc: qrImageSrc(t.pixQrBase64),
    expiresAt: t.expiresAt ?? null,
    status,
    livemode: true,
    poll: via === 'legacy'
      ? { tool: 'list_credits', args: { limit: 50 } }
      : { tool: 'get_credit_topup', args: {} },
  };
}

/** Null when `data` is no PIX answer this view knows. */
export function normalizePix(data, args = {}) {
  if (!data || typeof data !== 'object') return null;

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

  // get_credit_topup: { topup: {...} | null }
  if ('topup' in data) {
    if (!data.topup) return { kind: 'topup', title: 'Recarga de créditos', status: 'none', poll: null };
    return fromTopup(data.topup, 'topup');
  }

  // pay_invoice: { success, qrCode?, qrCodeImage? }. Only a PIX payment carries a code to show.
  if ('success' in data && args.invoiceId) {
    const pix = Boolean(data.qrCode || data.qrCodeImage);
    return {
      kind: 'invoice',
      title: 'Pagamento de fatura',
      id: String(args.invoiceId),
      amountCents: null,
      code: data.qrCode ?? null,
      qrSrc: qrImageSrc(data.qrCodeImage),
      expiresAt: null,
      status: pix ? 'pending' : 'requested',
      method: args.method ?? null,
      livemode: true,
      poll: pix ? { tool: 'get_invoice', args: { invoiceId: String(args.invoiceId) } } : null,
    };
  }

  return null;
}

/** The status a poll answer reports for `charge`, or null when it does not mention it. */
export function polledStatus(charge, data) {
  if (!data) return null;
  switch (charge.poll?.tool) {
    case 'get_payment_intent':
      return data.id === charge.id ? (INTENT_STATUS[data.status] ?? null) : null;
    case 'get_credit_topup':
      return data.topup?.creditId === charge.id ? (TOPUP_STATUS[data.topup.status] ?? null) : null;
    case 'list_credits': {
      const credit = (data.credits ?? []).find((c) => c.id === charge.id);
      return credit ? (LEGACY_CREDIT_STATUS[credit.status] ?? null) : null;
    }
    case 'get_invoice':
      return data.invoice?.id === charge.id && data.invoice.status === 'paid' ? 'paid' : null;
    default:
      return null;
  }
}

/** "14:59" for the time left, null once past. */
export function formatRemaining(expiresAt, now = Date.now()) {
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return null;
  const seconds = Math.floor((end - now) / 1000);
  if (seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
