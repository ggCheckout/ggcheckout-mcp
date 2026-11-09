import { describe, it, expect } from 'vitest';
// @ts-expect-error -- browser modules in plain JS, inlined into the views; no type declarations
import { summarizeDashboard, summarizeStats, chartTicks, chartTickLabel, percentChange } from './views/dashboard-model.js';
// @ts-expect-error -- see above
import { normalizePix, polledStatus, qrImageSrc, formatRemaining } from './views/pix-model.js';

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

describe('summarizeDashboard', () => {
  it('totals the series in cents and ranks products and states', () => {
    const s = summarizeDashboard(charts);
    expect(s.revenue).toBe(14970);
    expect(s.sales).toBe(3);
    expect(s.averageTicket).toBe(4990);
    expect(s.conversion).toBe(0.5);
    expect(s.products.map((p: any) => [p.name, Math.round(p.percentage)])).toEqual([['Curso B', 67], ['Curso A', 33]]);
    expect(s.orderBumps).toEqual([{ name: 'Planilha', count: 4, percentage: 100 }]);
    expect(s.states[0]).toEqual({ state: 'MG', count: 2, revenue: 9980 });
    expect(s.series.map((p: any) => p.label)).toEqual(['01/11', '02/11', '03/11']);
    expect(s.refundsTotal).toBe(3);
  });

  it('breaks each method down by gateway, most attempts first', () => {
    const s = summarizeDashboard({
      ...charts,
      gatewaySummary: [
        { gateway: 'mercadopago', total: 4, approved: 4, revenue: 550, pix: { total: 4, approved: 4 }, card: { total: 0, approved: 0 } },
        { gateway: 'appmax', total: 12, approved: 4, revenue: 200, pix: { total: 12, approved: 4 }, card: { total: 0, approved: 0 } },
      ],
    });
    const pix = s.approval.find((m: any) => m.key === 'pix');
    expect(pix.byGateway.map((g: any) => [g.gateway, g.approved, g.total])).toEqual([['appmax', 4, 12], ['mercadopago', 4, 4]]);
    expect(pix.byGateway[1].rate).toBe(1);
    // No card attempt at any gateway: nothing to open.
    expect(s.approval.find((m: any) => m.key === 'boleto').byGateway).toEqual([]);
  });

  it('leaves out a method with no attempts instead of showing 0%', () => {
    const s = summarizeDashboard(charts);
    expect(s.approval.map((m: any) => m.key)).toEqual(['pix', 'boleto']);
    expect(s.approval[0].rate).toBe(0.75);
  });

  it('has no conversion to show when no order was generated', () => {
    expect(summarizeDashboard({ ...charts, conversion: { ordersGenerated: 0, paymentsCompleted: 0 } }).conversion).toBeNull();
  });

  it('reads a focused answer, which has no series', () => {
    const s = summarizeDashboard({ focus: 'states', byState: charts.byState, period: 'week' });
    expect(s.focus).toBe('states');
    expect(s.states).toHaveLength(2);
    expect(s.series).toEqual([]);
    expect(summarizeDashboard({ focus: 'other' })).toBeNull();
  });

  it('refuses an answer that is not a charts payload', () => {
    expect(summarizeDashboard({ error: 'Não autorizado' })).toBeNull();
    expect(summarizeDashboard(null)).toBeNull();
  });
});

describe('summarizeStats', () => {
  it('compares with the previous period as StatsCards does (percent points, 100 from nothing)', () => {
    const s = summarizeStats({
      totalSales: 132, totalRevenue: 1284872, previousTotalSales: 120, previousTotalRevenue: 0,
      pendingCount: 14, previousPendingCount: 20, expiredCount: 31, period: 'week',
    });
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

describe('normalizePix', () => {
  const intent = {
    _notice: 'data', id: 'pi_123456789012345678901234', object: 'payment_intent', livemode: false, status: 'requires_action',
    amount: 4990, description: 'Pedido 1', pix: { copy_paste: '000201...', qr_base64: 'iVBORw0K', expires_at: '2026-11-09T20:00:00Z' },
  };

  it('reads a payment intent and polls it by id', () => {
    const c = normalizePix(intent);
    expect(c).toMatchObject({ kind: 'intent', amountCents: 4990, code: '000201...', status: 'pending', livemode: false });
    expect(c.qrSrc).toBe('data:image/png;base64,iVBORw0K');
    expect(c.poll).toEqual({ tool: 'get_payment_intent', args: { id: intent.id } });
    expect(polledStatus(c, { ...intent, status: 'succeeded' })).toBe('paid');
    expect(polledStatus(c, { ...intent, id: 'pi_other', status: 'succeeded' })).toBeNull();
  });

  it('polls a legacy top-up through list_credits and a new one through get_credit_topup', () => {
    const base = { creditId: 'cr_1', amountCents: 1000, pixCode: 'pix', pixQrBase64: 'AAAA', expiresAt: null };
    const legacy = normalizePix({ ...base, via: 'legacy' });
    expect(legacy.poll.tool).toBe('list_credits');
    expect(polledStatus(legacy, { credits: [{ id: 'cr_1', status: 'confirmed' }], ledger: { entries: [] } })).toBe('paid');

    const topup = normalizePix({ ...base, via: 'topup' });
    expect(topup.poll.tool).toBe('get_credit_topup');
    expect(polledStatus(topup, { topup: { creditId: 'cr_1', status: 'expired' } })).toBe('expired');
    expect(polledStatus(topup, { topup: null })).toBeNull();
  });

  it('shows "no top-up" for an empty get_credit_topup', () => {
    expect(normalizePix({ topup: null })).toMatchObject({ status: 'none', poll: null });
  });

  it('takes the invoice id from the tool input, and has no PIX for a card payment', () => {
    const pix = normalizePix({ success: true, qrCode: 'pix', qrCodeImage: 'data:image/png;base64,AAAA' }, { invoiceId: 'inv_1', method: 'pix' });
    expect(pix).toMatchObject({ kind: 'invoice', id: 'inv_1', status: 'pending', qrSrc: 'data:image/png;base64,AAAA' });
    expect(polledStatus(pix, { invoice: { id: 'inv_1', status: 'paid' } })).toBe('paid');

    const card = normalizePix({ success: true }, { invoiceId: 'inv_1', method: 'card' });
    expect(card).toMatchObject({ status: 'requested', poll: null });
  });

  it('is null for an answer with no PIX', () => {
    expect(normalizePix({ invoices: [] })).toBeNull();
  });
});

describe('qrImageSrc', () => {
  it('accepts only an inline image, never a URL to fetch', () => {
    expect(qrImageSrc('https://example.com/qr.png')).toBeNull();
    expect(qrImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(qrImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });
});

describe('formatRemaining', () => {
  it('counts down and stops at the deadline', () => {
    const now = Date.parse('2026-11-09T20:00:00Z');
    expect(formatRemaining('2026-11-09T20:14:05Z', now)).toBe('14:05');
    expect(formatRemaining('2026-11-09T21:00:00Z', now)).toBe('1:00:00');
    expect(formatRemaining('2026-11-09T19:59:59Z', now)).toBeNull();
  });
});
