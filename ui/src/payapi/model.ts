// The payments API cards: requests per minute (get_payments_api_limits), wallets (list_wallets) and
// payment intents (list_payment_intents). Pure: reads each answer into what the view draws.

import { count, finite, isPayload, text, type Payload } from '../lib/payload';
import { formatDateTime } from '../lib/format';

export interface LimitBucket {
  id: string;
  label: string;
  used: number;
  limit: number;
  windowSeconds: number | null;
  resetsInSeconds: number | null;
  /** used / limit, capped at 1; 0 when the limit is not positive. */
  ratio: number;
  level: 'ok' | 'high' | 'full';
}

export interface LimitsInfo {
  livemode: boolean;
  buckets: LimitBucket[];
  maxAmountCents: number | null;
}

/** `GET /v1/limits` answered, or the core has no such route yet (the tool says `available: false`). */
export type LimitsResult = { available: true; limits: LimitsInfo } | { available: false };

export interface WalletRow { id: string; name: string; activePix: number }

export interface IntentRow {
  id: string;
  amountCents: number | null;
  status: string;
  statusLabel: string;
  reference: string | null;
  createdAt: string | null;
  buyer: string | null;
  livemode: boolean;
}

export interface IntentsPage { rows: IntentRow[]; hasMore: boolean; nextCursor: string | null }

export type PayApiData =
  | ({ kind: 'limits' } & LimitsResult)
  | { kind: 'wallets'; wallets: WalletRow[] }
  | ({ kind: 'intents' } & IntentsPage);

const BUCKET_LABEL: Record<string, string> = {
  create_per_key: 'Criar cobranças (chave)',
  read_per_key: 'Consultas (chave)',
  cancel_per_key: 'Cancelamentos (chave)',
  create_per_seller: 'Criar cobranças (conta)',
  create_per_seller_per_day: 'Criar cobranças por dia (teste)',
};

const ACTION_LABEL: Record<string, string> = { create: 'Criar cobranças', read: 'Consultas', cancel: 'Cancelamentos' };
const SCOPE_LABEL: Record<string, string> = { key: 'chave', seller: 'conta' };

export const INTENT_STATUS_LABEL: Record<string, string> = {
  processing: 'Processando',
  requires_action: 'Aguardando pagamento',
  succeeded: 'Pago',
  expired: 'Expirado',
  canceled: 'Cancelado',
  failed: 'Falhou',
};

/** 80% and up is "high": the text next to the bar says so, so the level never rides on color alone. */
const HIGH_RATIO = 0.8;

function bucketLabel(b: Payload): string {
  const id = text(b.id);
  if (id && BUCKET_LABEL[id]) return BUCKET_LABEL[id];
  const action = ACTION_LABEL[text(b.action) ?? ''];
  const scope = SCOPE_LABEL[text(b.scope) ?? ''];
  return action ? `${action}${scope ? ` (${scope})` : ''}` : id ?? 'Limite';
}

function summarizeBucket(raw: unknown): LimitBucket | null {
  if (!isPayload(raw)) return null;
  const limit = finite(raw.limit);
  const id = text(raw.id);
  if (limit === null || !id) return null;
  const used = count(raw.used);
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  return {
    id,
    label: bucketLabel(raw),
    used,
    limit,
    windowSeconds: finite(raw.window_seconds),
    resetsInSeconds: finite(raw.resets_in_seconds),
    ratio,
    level: limit > 0 && used >= limit ? 'full' : ratio >= HIGH_RATIO ? 'high' : 'ok',
  };
}

/** `{object:'limits', buckets, max_amount_cents}`, or the tool's `{available:false}` answer. */
export function summarizeLimits(data: unknown): LimitsResult | null {
  if (!isPayload(data)) return null;
  if (data.object === 'limits_unavailable' || data.available === false) return { available: false };
  if (data.object !== 'limits' || !Array.isArray(data.buckets)) return null;
  return {
    available: true,
    limits: {
      livemode: data.livemode !== false,
      buckets: data.buckets.map(summarizeBucket).filter((b): b is LimitBucket => b !== null),
      maxAmountCents: finite(data.max_amount_cents),
    },
  };
}

const WALLET_ID = /^wal_/;
const INTENT_ID = /^pi_/;

function listOf(data: unknown): Payload[] | null {
  return isPayload(data) && Array.isArray(data.data) ? data.data.filter(isPayload) : null;
}

export function summarizeWallets(data: unknown, toolName?: string): WalletRow[] | null {
  const items = listOf(data);
  if (!items) return null;
  if (items.length && !items.every((w) => typeof w.id === 'string' && WALLET_ID.test(w.id))) return null;
  // An empty list has no shape of its own: only the tool name says it is the wallets one.
  if (!items.length && toolName !== 'list_wallets') return null;
  return items.map((w) => ({ id: w.id, name: text(w.name) ?? w.id, activePix: count(w.active_pix_count) }));
}

function createdAt(i: Payload): string | null {
  const iso = text(i.created_at);
  if (iso) return iso;
  const seconds = finite(i.created);
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
}

function summarizeIntent(i: Payload): IntentRow {
  const status = text(i.status) ?? 'processing';
  const buyer = isPayload(i.buyer) ? text(i.buyer.name) ?? text(i.buyer.email) : null;
  return {
    id: i.id,
    amountCents: finite(i.amount),
    status,
    statusLabel: INTENT_STATUS_LABEL[status] ?? status,
    reference: text(i.external_reference),
    createdAt: createdAt(i),
    buyer,
    livemode: i.livemode !== false,
  };
}

export function summarizeIntents(data: unknown, toolName?: string): IntentsPage | null {
  const items = listOf(data);
  if (!items || !isPayload(data)) return null;
  if (items.length && !items.every((i) => typeof i.id === 'string' && INTENT_ID.test(i.id))) return null;
  if (!items.length && toolName !== 'list_payment_intents') return null;
  return {
    rows: items.map(summarizeIntent),
    hasMore: data.has_more === true,
    nextCursor: data.has_more === true ? text(data.next_cursor) : null,
  };
}

/** What a payments API result is, by shape (the tool name only breaks the tie of an empty list). */
export function summarizePayApi(data: unknown, toolName?: string): PayApiData | null {
  const limits = summarizeLimits(data);
  if (limits) return { kind: 'limits', ...limits };
  const wallets = summarizeWallets(data, toolName);
  if (wallets) return { kind: 'wallets', wallets };
  const intents = summarizeIntents(data, toolName);
  if (intents) return { kind: 'intents', ...intents };
  return null;
}

/** "reinicia em 41 s", "em 3 min", "em 2 h"; null when there is nothing to wait for. */
export function formatReset(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 90) return `reinicia em ${Math.ceil(seconds)} s`;
  if (seconds < 5400) return `reinicia em ${Math.round(seconds / 60)} min`;
  return `reinicia em ${Math.round(seconds / 3600)} h`;
}

/** The word that rides next to the bar, so the level is never color alone. */
export function levelText(level: LimitBucket['level']): string | null {
  return level === 'full' ? 'No limite' : level === 'high' ? 'Quase no limite' : null;
}

export const intentDate = (iso: string | null) => formatDateTime(iso, { separator: ' · ' });
