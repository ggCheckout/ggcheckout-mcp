// Turns list_checkout_wallets and get_gateway_fallback_stats into what the gateways view draws,
// following the dashboard's charge order (saas components/settings/Gateways/routes) and its
// stability ranking (components/settings/GatewayStats). Rates are 0-100. Pure.

import { count, isPayload, type Payload } from '../lib/payload';

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

/** lib/gateways/ranking.ts: below this many attempts a rate is not trusted yet. */
export const LOW_SAMPLE = 50;
/** HIGH_ERROR_RELIABILITY_THRESHOLD: "Instável" below it, with enough attempts. */
const UNSTABLE_BELOW = 90;

export interface WalletEntry {
  credentialId: string;
  gateway: string;
  label: string | null;
  active: boolean;
  locked: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  auto: boolean;
  metric: 'reliability' | 'conversion';
  pix: WalletEntry[];
  card: WalletEntry[];
  checkoutCount: number;
  storeCount: number;
}

function entry(e: Payload): WalletEntry {
  return {
    credentialId: String(e.credentialId ?? ''),
    gateway: String(e.gateway ?? ''),
    label: text(e.label),
    active: e.active !== false,
    // The legacy `favorite` is read as `locked`, as the panel does.
    locked: e.locked === true || e.favorite === true,
  };
}

/** list_checkout_wallets; null for anything else. */
export function summarizeWallets(data: unknown): Wallet[] | null {
  if (!isPayload(data) || !Array.isArray(data.wallets)) return null;
  return data.wallets.filter(isPayload).map((w) => ({
    id: String(w.id ?? ''),
    name: text(w.name) ?? 'Ordem de cobrança',
    auto: w.mode === 'auto',
    metric: w.metric === 'conversion' ? 'conversion' : 'reliability',
    pix: (Array.isArray(w.pix) ? w.pix : []).filter(isPayload).map(entry),
    card: (Array.isArray(w.card) ? w.card : []).filter(isPayload).map(entry),
    checkoutCount: count(w.checkoutCount),
    storeCount: count(w.storeCount),
  }));
}

/** RouteOverview's status line: "em 3 checkouts e 2 lojas". */
export function usageLine(w: Pick<Wallet, 'checkoutCount' | 'storeCount'>): string {
  const parts = [
    w.checkoutCount ? `${w.checkoutCount} ${w.checkoutCount === 1 ? 'checkout' : 'checkouts'}` : null,
    w.storeCount ? `${w.storeCount} ${w.storeCount === 1 ? 'loja' : 'lojas'}` : null,
  ].filter(Boolean);
  return parts.length ? `em ${parts.join(' e ')}` : 'nenhum checkout ou loja';
}

/** pillCover: how far the PIX chain reaches. */
export function coverLine(w: Pick<Wallet, 'pix' | 'card'>): string {
  const pix = w.pix.filter((e) => e.active).length;
  if (!w.pix.length && !w.card.length) return 'Sem plataforma';
  if (!w.pix.length) return 'Só cartão';
  if (!pix) return 'PIX não cobra';
  const reserves = pix - 1;
  return reserves ? `+ ${reserves} ${reserves === 1 ? 'reserva' : 'reservas'}` : 'Só a principal';
}

export interface RankRow {
  gateway: string;
  rate: number;
  sample: number;
}

export interface GatewayStats {
  ranking: { reliability: RankRow[]; conversion: RankRow[]; card: RankRow[]; pix: RankRow[] | null } | null;
  /** Attempts per gateway, for the "Instável" warning. */
  totals: Record<string, number>;
  hours: number | null;
  cachedAt: number | null;
}

function rows(list: unknown): RankRow[] {
  return (Array.isArray(list) ? list : []).filter(isPayload).map((r) => ({
    gateway: String(r.gateway ?? ''),
    rate: typeof r.rate === 'number' ? r.rate : 0,
    sample: count(r.sample),
  }));
}

/** get_gateway_fallback_stats; null for anything else. */
export function summarizeStats(data: unknown): GatewayStats | null {
  if (!isPayload(data) || !isPayload(data.stats) || !('ranking' in data)) return null;
  const r = isPayload(data.ranking) ? data.ranking : null;
  return {
    ranking: r ? { reliability: rows(r.reliability), conversion: rows(r.conversion), card: rows(r.card), pix: Array.isArray(r.pix) ? rows(r.pix) : null } : null,
    totals: Object.fromEntries(Object.entries(data.stats).filter(([, v]) => isPayload(v)).map(([k, v]) => [k, count((v as Payload).total)])),
    hours: isPayload(data.window) && typeof data.window.hours === 'number' ? data.window.hours : null,
    cachedAt: typeof data.cachedAt === 'number' ? data.cachedAt : null,
  };
}

export type Metric = 'reliability' | 'conversion';

/** The ranking a list follows: PIX by the wallet's metric (`pix ?? reliability` for stability), card by approval. */
export function rankingFor(stats: GatewayStats, method: 'pix' | 'card', metric: Metric): RankRow[] {
  if (!stats.ranking) return [];
  if (method === 'card') return stats.ranking.card;
  return metric === 'conversion' ? stats.ranking.conversion : (stats.ranking.pix ?? stats.ranking.reliability);
}

/** The score column's unit, as the panel words it. */
export function unitLabel(method: 'pix' | 'card', metric: Metric): string {
  if (method === 'card') return 'aprovação';
  return metric === 'conversion' ? 'pagos' : 'estabilidade';
}

export function isUnstable(gateway: string, rate: number, stats: GatewayStats): boolean {
  return (stats.totals[gateway] ?? 0) >= LOW_SAMPLE && rate < UNSTABLE_BELOW;
}

/** formatPercent: one decimal, pt-BR. */
export function formatRate(rate: number): string {
  return rate.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const STOPS: [number, [number, number, number]][] = [
  [0, [229, 35, 42]], [65, [249, 115, 22]], [90, [234, 179, 8]], [100, [18, 183, 106]],
];

/** seasonScaleColor, with a conversion rate first moved onto the reliability scale (50→80, 70→95). */
export function rateColor(rate: number, metric: Metric = 'reliability'): string {
  let v = rate;
  if (metric === 'conversion') v = v <= 50 ? (v / 50) * 80 : v <= 70 ? 80 + ((v - 50) / 20) * 15 : 95 + ((v - 70) / 30) * 5;
  v = Math.max(0, Math.min(100, v));
  const i = STOPS.findIndex(([at]) => v <= at);
  if (i <= 0) return `rgb(${STOPS[0][1].join(', ')})`;
  const [a, ca] = STOPS[i - 1];
  const [b, cb] = STOPS[i];
  const t = (v - a) / (b - a);
  return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(', ')})`;
}
