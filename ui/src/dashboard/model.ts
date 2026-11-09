// Turns get_dashboard_stats and get_dashboard_charts answers (saas `GET /api/dashboard/stats` and
// `/charts`) into what the sales view draws, the way the seller dashboard maps them. Pure.

import { count, isPayload, type Payload } from '../lib/payload';

export type DashboardRange = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all';

export const DASHBOARD_RANGES: { value: DashboardRange; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: '30 dias' },
  { value: 'year', label: '12 meses' },
  { value: 'all', label: 'Tudo' },
];

export const DASHBOARD_FOCUSES = ['revenue', 'approval', 'products', 'states', 'refunds'] as const;
export type DashboardFocus = (typeof DASHBOARD_FOCUSES)[number];

const METHOD_LABELS = { pix: 'PIX', card: 'Cartão', boleto: 'Boleto' } as const;
export type MethodKey = keyof typeof METHOD_LABELS;

export interface GatewayApproval { gateway: string; approved: number; total: number; rate: number | null }
export interface MethodApproval {
  key: MethodKey;
  label: string;
  approved: number;
  total: number;
  rate: number | null;
  byGateway: GatewayApproval[];
}
export interface ProductShare { name: string; count: number; percentage: number }
export interface StateSales { state: string; count: number; revenue: number }
export interface SeriesPoint { label: string; date: string; sales: number; revenue: number }

export interface ChartsSummary {
  focus: DashboardFocus | null;
  period: string | null;
  series: SeriesPoint[];
  revenue: number;
  sales: number;
  averageTicket: number;
  conversion: number | null;
  approval: MethodApproval[];
  products: ProductShare[];
  orderBumps: ProductShare[];
  states: StateSales[];
  refunds: { refund: number; chargeback: number; med: number };
  refundsTotal: number;
}

export interface StatsSummary {
  period: string | null;
  sales: number;
  revenue: number;
  pending: number;
  expired: number;
  salesChange: number;
  revenueChange: number;
  pendingChange: number;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/** SalesChart labels the x axis DD/MM from the date (dashboard/index.tsx), whatever the granularity. */
const dayMonth = (date: unknown) => {
  const parts = String(date ?? '').split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : null;
};

/** Products or order bumps as the dashboard maps them (`toProductShares`): share of the approved sales. */
function productShares(items: unknown): ProductShare[] {
  const rows = (Array.isArray(items) ? items : [])
    .map((p: Payload) => ({ name: String(p.name ?? 'Produto'), count: count(p.count) }))
    .filter((p) => p.count > 0);
  const total = rows.reduce((sum, p) => sum + p.count, 0);
  return rows
    .map((p) => ({ ...p, percentage: total > 0 ? (p.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Null when the answer is not a charts payload (an error body, another tool's result). A focused
 * answer (`focus`) carries only its own part; the rest summarizes as empty and is not drawn.
 */
export function summarizeCharts(data: unknown): ChartsSummary | null {
  if (!isPayload(data)) return null;
  const focus = (DASHBOARD_FOCUSES as readonly string[]).includes(data.focus) ? (data.focus as DashboardFocus) : null;
  if (!focus && !Array.isArray(data.chartData)) return null;

  const series: SeriesPoint[] = (Array.isArray(data.chartData) ? data.chartData : []).map((p: Payload) => ({
    label: dayMonth(p.date) ?? String(p.label ?? p.date ?? ''),
    date: String(p.date ?? ''),
    sales: count(p.sales),
    revenue: count(p.revenue),
  }));
  const revenue = series.reduce((sum, p) => sum + p.revenue, 0);
  const sales = series.reduce((sum, p) => sum + p.sales, 0);

  const ticket: Payload = data.averageTicket ?? {};
  const averageTicket = count(ticket.count) > 0
    ? Math.round(count(ticket.sum) / count(ticket.count))
    : sales > 0 ? Math.round(revenue / sales) : 0;

  // Per gateway, each method's attempts, as ApprovalRate breaks a method down (gatewaySummary only
  // splits pix and card).
  const gateways: Payload[] = Array.isArray(data.gatewaySummary) ? data.gatewaySummary : [];
  const approval = (Object.entries(METHOD_LABELS) as [MethodKey, string][])
    .map(([key, label]) => {
      const a: Payload = data.approvalRate?.[key] ?? {};
      const byGateway = gateways
        .map((g) => ({ gateway: String(g.gateway ?? ''), approved: count(g[key]?.approved), total: count(g[key]?.total) }))
        .filter((g) => g.gateway && g.total > 0)
        .map((g) => ({ ...g, rate: ratio(g.approved, g.total) }))
        .sort((x, y) => y.total - x.total || y.approved - x.approved);
      return { key, label, approved: count(a.approved), total: count(a.total), rate: ratio(count(a.approved), count(a.total)), byGateway };
    })
    .filter((m) => m.total > 0);

  // SalesByState ranks by sales count, not revenue.
  const states = (Array.isArray(data.byState) ? data.byState : [])
    .map((s: Payload) => ({ state: String(s.state ?? '').toUpperCase(), count: count(s.count), revenue: count(s.revenue) }))
    .filter((s) => s.state && (s.count > 0 || s.revenue > 0))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

  const refunds = {
    refund: count(data.refunds?.refund),
    chargeback: count(data.refunds?.chargeback),
    med: count(data.refunds?.med),
  };

  return {
    focus,
    period: data.period ?? null,
    series,
    revenue,
    sales,
    averageTicket,
    conversion: ratio(count(data.conversion?.paymentsCompleted), count(data.conversion?.ordersGenerated)),
    approval,
    products: productShares(data.byProduct),
    orderBumps: productShares(data.byOrderBump),
    states,
    refunds,
    refundsTotal: refunds.refund + refunds.chargeback + refunds.med,
  };
}

/** `calcPercentChange` of saas lib/utils: percent points, 100 from nothing, 0 from nothing to nothing. */
export function percentChange(current: number, previous: number): number {
  if (previous > 0) return ((current - previous) / previous) * 100;
  return current > 0 ? 100 : 0;
}

/** A get_dashboard_stats answer; null for anything else. */
export function summarizeStats(data: unknown): StatsSummary | null {
  if (!isPayload(data) || !('totalSales' in data) || !('totalRevenue' in data)) return null;
  return {
    period: data.period ?? null,
    sales: count(data.totalSales),
    revenue: count(data.totalRevenue),
    pending: count(data.pendingCount),
    expired: count(data.expiredCount),
    salesChange: percentChange(count(data.totalSales), count(data.previousTotalSales)),
    revenueChange: percentChange(count(data.totalRevenue), count(data.previousTotalRevenue)),
    pendingChange: percentChange(count(data.pendingCount), count(data.previousPendingCount)),
  };
}

/** The y axis of SalesChart: the max rounded up at its leading digit, in four equal steps. */
export function chartTicks(max: number): number[] {
  if (!(max > 0)) return [0];
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / magnitude) * magnitude;
  const step = top / 4;
  return [0, step, step * 2, step * 3, top];
}

/** SalesChart's tick label, from cents: "2k", "1.5k", or the whole reais. */
export function chartTickLabel(cents: number): string {
  const reais = cents / 100;
  if (reais >= 1000) {
    const k = reais / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(Math.round(reais));
}

/** StatsCards' second line for sales and revenue, by period. */
export const COMPARISON_LABELS: Record<string, string> = {
  all: 'total', today: 'vs. ontem', yesterday: 'vs. dia anterior', week: 'vs. semana anterior',
  month: 'vs. mês anterior', year: 'vs. ano anterior', custom: 'vs. período anterior',
};

/** StatsCards' second line for expired sales, by period. */
export const PERIOD_LABELS: Record<string, string> = {
  all: 'total', today: 'hoje', yesterday: 'ontem', week: 'na última semana',
  month: 'no último mês', year: 'no último ano', custom: 'no período',
};
