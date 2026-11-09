import { describe, expect, it } from 'vitest';
import { chartTickLabel, chartTicks, percentChange, summarizeCharts, summarizeStats } from './model';

const charts = {
  chartData: [
    { label: '01/11', date: '2026-11-01', sales: 2, revenue: 9980 },
    { label: '02/11', date: '2026-11-02', sales: 0, revenue: 0 },
    { label: '03/11', date: '2026-11-03', sales: 1, revenue: 4990 },
  ],
  approvalRate: { pix: { total: 4, approved: 3 }, card: { total: 0, approved: 0 }, boleto: { total: 1, approved: 0 } },
  byMethod: { pix: 3 },
  byProduct: [{ productId: 'a', name: 'Curso A', count: 1 }, { productId: 'b', name: 'Curso B', count: 2 }],
  byOrderBump: [{ productId: 'ob', name: 'Planilha', count: 4 }],
  conversion: { ordersGenerated: 6, paymentsCompleted: 3 },
  refunds: { chargeback: 1, med: 0, refund: 2 },
  byState: [{ state: 'mg', count: 2, revenue: 9980 }, { state: 'sp', count: 1, revenue: 4990 }],
  averageTicket: { sum: 14970, count: 3, average: 4990 },
  gatewaySummary: [],
  chartGranularity: 'daily',
  period: 'week',
  timezone: 'America/Sao_Paulo',
  fromCache: true,
};

describe('summarizeCharts', () => {
  it('totals the series in cents and ranks products and states', () => {
    const s = summarizeCharts(charts)!;
    expect(s.revenue).toBe(14970);
    expect(s.sales).toBe(3);
    expect(s.averageTicket).toBe(4990);
    expect(s.conversion).toBe(0.5);
    expect(s.products.map((p) => [p.name, Math.round(p.percentage)])).toEqual([['Curso B', 67], ['Curso A', 33]]);
    expect(s.orderBumps).toEqual([{ name: 'Planilha', count: 4, percentage: 100 }]);
    expect(s.states[0]).toEqual({ state: 'MG', count: 2, revenue: 9980 });
    expect(s.series.map((p) => p.label)).toEqual(['01/11', '02/11', '03/11']);
    expect(s.refundsTotal).toBe(3);
  });

  it('breaks each method down by gateway, most attempts first', () => {
    const s = summarizeCharts({
      ...charts,
      gatewaySummary: [
        { gateway: 'mercadopago', total: 4, approved: 4, revenue: 550, pix: { total: 4, approved: 4 }, card: { total: 0, approved: 0 } },
        { gateway: 'appmax', total: 12, approved: 4, revenue: 200, pix: { total: 12, approved: 4 }, card: { total: 0, approved: 0 } },
      ],
    })!;
    const pix = s.approval.find((m) => m.key === 'pix')!;
    expect(pix.byGateway.map((g) => [g.gateway, g.approved, g.total])).toEqual([['appmax', 4, 12], ['mercadopago', 4, 4]]);
    expect(pix.byGateway[1].rate).toBe(1);
    // No card attempt at any gateway: nothing to open.
    expect(s.approval.find((m) => m.key === 'boleto')!.byGateway).toEqual([]);
  });

  it('leaves out a method with no attempts instead of showing 0%', () => {
    const s = summarizeCharts(charts)!;
    expect(s.approval.map((m) => m.key)).toEqual(['pix', 'boleto']);
    expect(s.approval[0].rate).toBe(0.75);
  });

  it('has no conversion to show when no order was generated', () => {
    expect(summarizeCharts({ ...charts, conversion: { ordersGenerated: 0, paymentsCompleted: 0 } })!.conversion).toBeNull();
  });

  it('reads a focused answer, which has no series', () => {
    const s = summarizeCharts({ focus: 'states', byState: charts.byState, period: 'week' })!;
    expect(s.focus).toBe('states');
    expect(s.states).toHaveLength(2);
    expect(s.series).toEqual([]);
    expect(summarizeCharts({ focus: 'other' })).toBeNull();
  });

  it('refuses an answer that is not a charts payload', () => {
    expect(summarizeCharts({ error: 'Não autorizado' })).toBeNull();
    expect(summarizeCharts(null)).toBeNull();
  });
});

describe('summarizeStats', () => {
  it('compares with the previous period as StatsCards does (percent points, 100 from nothing)', () => {
    const s = summarizeStats({
      totalSales: 132, totalRevenue: 1284872, previousTotalSales: 120, previousTotalRevenue: 0,
      pendingCount: 14, previousPendingCount: 20, expiredCount: 31, period: 'week',
    })!;
    expect(s).toMatchObject({ sales: 132, revenue: 1284872, pending: 14, expired: 31 });
    expect(s.salesChange).toBeCloseTo(10);
    expect(s.revenueChange).toBe(100);
    expect(s.pendingChange).toBeCloseTo(-30);
    expect(percentChange(0, 0)).toBe(0);
  });

  it('is null for a charts answer', () => {
    expect(summarizeStats(charts)).toBeNull();
  });
});

describe('chart axis', () => {
  it('rounds the top up at its leading digit and splits it in four, as SalesChart', () => {
    expect(chartTicks(9980)).toEqual([0, 2500, 5000, 7500, 10000]);
    expect(chartTicks(152080)).toEqual([0, 50000, 100000, 150000, 200000]);
    expect(chartTicks(0)).toEqual([0]);
  });

  it('labels ticks in reais with k above a thousand', () => {
    expect(chartTickLabel(200000)).toBe('2k');
    expect(chartTickLabel(150000)).toBe('1.5k');
    expect(chartTickLabel(75000)).toBe('750');
  });
});
