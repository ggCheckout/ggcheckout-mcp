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

  const series = (data.chartData ?? []).map((p) => ({
    label: String(p.label ?? p.date ?? ''),
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

  const topProducts = (data.byProduct ?? [])
    .map((p) => ({ name: String(p.name ?? 'Produto'), count: count(p.count) }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topStates = (data.byState ?? [])
    .map((s) => ({ state: String(s.state ?? '').toUpperCase() || '–', count: count(s.count), revenue: count(s.revenue) }))
    .filter((s) => s.revenue > 0 || s.count > 0)
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
    .slice(0, 5);

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
    topProducts,
    topStates,
    refunds,
    refundsTotal: refunds.refund + refunds.chargeback + refunds.med,
  };
}

/** "Nice" upper bound and ticks for a y axis that starts at zero. */
export function niceScale(max, tickCount = 3) {
  if (!(max > 0)) return { max: 1, ticks: [0] };
  const rough = max / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough);
  const top = step * Math.ceil(max / step);
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { max: top, ticks };
}

/** Change against the previous period as a ratio; null when there is nothing to compare with. */
export function change(current, previous) {
  return previous > 0 ? (current - previous) / previous : null;
}

/** A get_dashboard_stats answer (`GET /api/dashboard/stats`); null for anything else. */
export function summarizeStats(data) {
  if (!data || typeof data !== 'object' || !('totalSales' in data) || !('totalRevenue' in data)) return null;
  return {
    period: data.period ?? null,
    revenue: count(data.totalRevenue),
    sales: count(data.totalSales),
    averageTicket: count(data.averageTicket),
    revenueChange: change(count(data.totalRevenue), count(data.previousTotalRevenue)),
    salesChange: change(count(data.totalSales), count(data.previousTotalSales)),
    ticketChange: change(count(data.averageTicket), count(data.previousAverageTicket)),
    statuses: [
      { key: 'pending', label: 'Pendentes', count: count(data.pendingCount) },
      { key: 'failed', label: 'Recusadas', count: count(data.failedCount) },
      { key: 'expired', label: 'Expiradas', count: count(data.expiredCount) },
      { key: 'cancelled', label: 'Canceladas', count: count(data.cancelledCount) },
      { key: 'refunded', label: 'Reembolsadas', count: count(data.refundedCount) },
    ],
  };
}
