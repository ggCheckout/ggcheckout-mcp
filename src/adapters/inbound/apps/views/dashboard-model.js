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

/** Null when the answer is not a charts payload (an error body, another tool's result). */
export function summarizeDashboard(data) {
  if (!data || !Array.isArray(data.chartData)) return null;

  const series = data.chartData.map((p) => ({
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

  const approval = Object.entries(METHOD_LABELS)
    .map(([key, label]) => {
      const a = data.approvalRate?.[key] ?? {};
      return { key, label, approved: count(a.approved), total: count(a.total), rate: ratio(count(a.approved), count(a.total)) };
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
