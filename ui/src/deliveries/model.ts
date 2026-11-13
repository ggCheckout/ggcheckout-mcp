// Turns get_delivery_status / resend_delivery into what the deliveries view draws, following the
// payment detail's "Dados do WhatsApp" (saas-checkout components/payments/WhatsAppDetails.tsx,
// DeliveryCard.tsx and DeliveryStatusBadge.tsx). Both delivery sources (embedded in the payment and
// the legacy collection) are read. Pure.

import { type Payload, count, isPayload, text } from '../lib/payload';

export interface Delivery {
  id: string;
  /** The message's kind, as DeliveryCard labels it. */
  label: string;
  status: string;
  provider: 'waha' | 'meta';
  /** Masked by the server. */
  phone: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  retryCount: number;
  error: string | null;
  /** A WAHA message the server took but the device has not confirmed yet. */
  unconfirmed: boolean;
}

export interface DeliverySummary {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  pending: number;
  failed: number;
}

export interface Deliveries {
  paymentId: string | null;
  deliveries: Delivery[];
  summary: DeliverySummary;
}

const TYPE_LABELS: Record<string, string> = {
  payment_pending: 'Pagamento Pendente',
  pix: 'PIX pendente',
  payment_confirmed: 'Pagamento Confirmado',
  paid: 'Pagamento Confirmado',
  product_delivery: 'Entrega de Produto',
  product_delivery_file: 'Arquivo do Produto',
  order_bump_file: 'Arquivo Order Bump',
  order_bump_message: 'Order Bump',
  payment_failed: 'Pagamento Falhou',
  file: 'Arquivo',
  text: 'Mensagem',
};

/** messageTypeLabel; an order bump's own file (`order_bump_file_<id>`) reads as its kind, not its id. */
export function typeLabel(kind: string | null): string {
  if (!kind) return 'Mensagem';
  const base = kind.replace(/^(order_bump_(?:file|message))_.+$/, '$1');
  return TYPE_LABELS[base] ?? kind;
}

function toDelivery(d: Payload): Delivery {
  const provider = d.provider === 'meta' ? 'meta' : 'waha';
  const status = String(d.status ?? 'pending');
  return {
    id: String(d.uid ?? d.id ?? ''),
    label: typeLabel(text(d.messageType) ?? text(d.type)),
    status,
    provider,
    phone: text(d.recipientPhone) ?? text(d.customerPhone),
    sentAt: text(d.sentAt),
    deliveredAt: text(d.deliveredAt),
    readAt: text(d.readAt),
    retryCount: count(d.retryCount),
    error: text(d.error),
    unconfirmed: provider === 'waha' && (status === 'sent' || status === 'queued') && !text(d.messageId),
  };
}

/** get_delivery_status; null for anything else. */
export function summarizeDeliveries(data: unknown): Deliveries | null {
  if (!isPayload(data) || !Array.isArray(data.deliveries) || !isPayload(data.summary)) return null;
  const s = data.summary;
  return {
    paymentId: text(data.paymentId),
    deliveries: data.deliveries.filter(isPayload).map(toDelivery),
    summary: {
      total: count(s.total),
      sent: count(s.sent),
      delivered: count(s.delivered),
      read: count(s.read),
      pending: count(s.pending),
      failed: count(s.failed) + count(s.permanentFailure),
    },
  };
}

export interface ResendOutcome {
  /** `unconfirmed`: the answer carried no recognizable `success`, so neither a send nor a failure is known. */
  status: 'confirmed' | 'failed' | 'unconfirmed';
  message: string;
}

/** The shape of a real resend answer (`{ success, message, remaining }`); `success` alone is too generic to route a payload by. */
export function isResendAnswer(data: unknown): boolean {
  return isPayload(data) && isPayload(data.remaining) && typeof data.success === 'boolean';
}

/** resend_delivery (`{ success, message }`, `remaining` is extra): decided by `success` alone. */
export function summarizeResend(data: unknown): ResendOutcome {
  const success = isPayload(data) ? data.success : undefined;
  if (success === true) return { status: 'confirmed', message: 'Mensagem WhatsApp reenviada com sucesso!' };
  if (success === false) return { status: 'failed', message: (isPayload(data) ? text(data.message) : null) ?? 'Não foi possível reenviar a mensagem WhatsApp.' };
  return { status: 'unconfirmed', message: 'Não deu para confirmar o reenvio. Confira o status antes de reenviar de novo.' };
}

export type Tone = 'amber' | 'emerald' | 'sky' | 'red' | 'neutral';

/** DeliveryStatusBadge: the tone, label and tooltip of a status. */
export function statusBadge(d: Pick<Delivery, 'status' | 'provider' | 'unconfirmed'>): { tone: Tone; label: string; hint: string } {
  switch (d.status) {
    case 'pending':
    case 'queued':
      return { tone: 'amber', label: 'Na fila', hint: 'Aguardando processamento' };
    case 'sending':
      return { tone: 'amber', label: 'Enviando', hint: 'Mensagem sendo enviada' };
    case 'sent':
      if (d.provider === 'meta') return { tone: 'emerald', label: 'Enviado', hint: 'Aceito pela API oficial da Meta. A confirmação de entrega chega automaticamente.' };
      return d.unconfirmed
        ? { tone: 'amber', label: 'Enviado', hint: 'Enviado ao servidor. Aguardando confirmação de entrega.' }
        : { tone: 'emerald', label: 'Enviado', hint: 'Mensagem enviada com sucesso ao servidor WhatsApp.' };
    case 'delivered':
      return { tone: 'emerald', label: 'Entregue', hint: 'Mensagem entregue no dispositivo' };
    case 'read':
      return { tone: 'sky', label: 'Lido', hint: 'Mensagem visualizada pelo destinatário' };
    case 'failed':
      return { tone: 'red', label: 'Falhou', hint: 'Erro ao enviar mensagem' };
    case 'permanent_failure':
      return { tone: 'red', label: 'Falha permanente', hint: 'Não será tentado novamente' };
    default:
      return { tone: 'neutral', label: d.status, hint: d.status };
  }
}
