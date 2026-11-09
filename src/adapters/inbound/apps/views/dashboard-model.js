// Turns a get_dashboard_charts answer (saas `GET /api/dashboard/charts`) into what the sales panel
// draws. Pure: no DOM, so the unit tests import it directly.

export const DASHBOARD_RANGES = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: '30 dias' },
  { value: 'year', label: '12 meses' },
  { value: 'all', label: 'Tudo' },
];

const METHOD_LABELS = { pix: 'PIX', card: 'Cartão', boleto: 'Boleto' };

const dayMonth = (date) => {
  const parts = String(date ?? '').split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : null;
};
/**
 * As the dashboard maps products and order bumps (dashboardChartsMapping `toProductShares`): each
 * item's share of the approved sales, most sold first. The view shows five until "Ver mais".
 */
function productShares(items) {
  const rows = (Array.isArray(items) ? items : [])
    .map((p) => ({ name: String(p.name ?? 'Produto'), count: count(p.count) }))
    .filter((p) => p.count > 0);
  const total = rows.reduce((sum, p) => sum + p.count, 0);
  return rows
    .map((p) => ({ ...p, percentage: total > 0 ? (p.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

const count = (n) => (Number.isFinite(n) ? n : 0);
const ratio = (part, whole) => (whole > 0 ? part / whole : null);

export const DASHBOARD_FOCUSES = ['revenue', 'approval', 'products', 'states', 'refunds'];

/**
 * Null when the answer is not a charts payload (an error body, another tool's result). A focused
 * answer (`focus`) carries only its own part; the rest summarizes as empty and is not drawn.
 */
export function summarizeDashboard(data) {
  if (!data || typeof data !== 'object') return null;
  const focus = DASHBOARD_FOCUSES.includes(data.focus) ? data.focus : null;
  if (!focus && !Array.isArray(data.chartData)) return null;

  // SalesChart labels the x axis DD/MM from the date (dashboard/index.tsx), whatever the granularity.
  const series = (data.chartData ?? []).map((p) => ({
    label: dayMonth(p.date) ?? String(p.label ?? p.date ?? ''),
    date: String(p.date ?? ''),
    sales: count(p.sales),
    revenue: count(p.revenue),
  }));
  const revenue = series.reduce((sum, p) => sum + p.revenue, 0);
  const sales = series.reduce((sum, p) => sum + p.sales, 0);

  const ticket = data.averageTicket ?? {};
  const averageTicket = count(ticket.count) > 0
    ? Math.round(count(ticket.sum) / ticket.count)
    : (sales > 0 ? Math.round(revenue / sales) : 0);

  const conversion = ratio(count(data.conversion?.paymentsCompleted), count(data.conversion?.ordersGenerated));

  // Per gateway, each method's attempts, as ApprovalRate breaks a method down (gatewaySummary only
  // splits pix and card).
  const gateways = Array.isArray(data.gatewaySummary) ? data.gatewaySummary : [];
  const approval = Object.entries(METHOD_LABELS)
    .map(([key, label]) => {
      const a = data.approvalRate?.[key] ?? {};
      const byGateway = gateways
        .map((g) => ({ gateway: String(g.gateway ?? ''), approved: count(g[key]?.approved), total: count(g[key]?.total) }))
        .filter((g) => g.gateway && g.total > 0)
        .map((g) => ({ ...g, rate: ratio(g.approved, g.total) }))
        .sort((x, y) => y.total - x.total || y.approved - x.approved);
      return { key, label, approved: count(a.approved), total: count(a.total), rate: ratio(count(a.approved), count(a.total)), byGateway };
    })
    .filter((m) => m.total > 0);

  // As the dashboard maps it (components/dashboard/index.tsx): every product, its share of the
  // approved sales, most sold first. The view shows the first five until "Ver mais".
  const products = productShares(data.byProduct);
  const orderBumps = productShares(data.byOrderBump);

  // SalesByState ranks by sales count, not revenue.
  const states = (data.byState ?? [])
    .map((s) => ({ state: String(s.state ?? '').toUpperCase(), count: count(s.count), revenue: count(s.revenue) }))
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
    granularity: data.chartGranularity ?? 'daily',
    series,
    revenue,
    sales,
    averageTicket,
    conversion,
    approval,
    products,
    orderBumps,
    states,
    refunds,
    refundsTotal: refunds.refund + refunds.chargeback + refunds.med,
  };
}

/**
 * The y axis of SalesChart: the max rounded up at its leading digit, in four equal steps. Scale-free,
 * so it works on cents as it does on reais.
 */
export function chartTicks(max) {
  if (!(max > 0)) return [0];
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / magnitude) * magnitude;
  const step = top / 4;
  return [0, step, step * 2, step * 3, top];
}

/** SalesChart's tick label, from cents: "2k", "1.5k", or the whole reais. */
export function chartTickLabel(cents) {
  const reais = cents / 100;
  if (reais >= 1000) {
    const k = reais / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(Math.round(reais));
}

/** `calcPercentChange` of saas lib/utils: percent points, 100 from nothing, 0 from nothing to nothing. */
export function percentChange(current, previous) {
  if (previous > 0) return ((current - previous) / previous) * 100;
  return current > 0 ? 100 : 0;
}

/** StatsCards' second line for sales and revenue, by period. */
export const COMPARISON_LABELS = {
  all: 'total', today: 'vs. ontem', yesterday: 'vs. dia anterior', week: 'vs. semana anterior',
  month: 'vs. mês anterior', year: 'vs. ano anterior', custom: 'vs. período anterior',
};

/** StatsCards' second line for expired sales, by period. */
export const PERIOD_LABELS = {
  all: 'total', today: 'hoje', yesterday: 'ontem', week: 'na última semana',
  month: 'no último mês', year: 'no último ano', custom: 'no período',
};

/** A get_dashboard_stats answer (`GET /api/dashboard/stats`); null for anything else. */
export function summarizeStats(data) {
  if (!data || typeof data !== 'object' || !('totalSales' in data) || !('totalRevenue' in data)) return null;
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
