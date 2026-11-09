import { describe, it, expect, vi } from 'vitest';
import { DashboardService, pickChartsFocus } from './dashboard.service.js';
import type { DashboardPort } from '../ports/dashboard.port.js';

const charts = {
  chartData: [{ label: '01/11', date: '2026-11-01', sales: 1, revenue: 4990 }],
  approvalRate: { pix: { total: 1, approved: 1 } },
  byMethod: { pix: 1 },
  byProduct: [{ productId: 'a', name: 'A', count: 1 }],
  byOrderBump: [],
  conversion: { ordersGenerated: 2, paymentsCompleted: 1 },
  refunds: { chargeback: 0, med: 0, refund: 1 },
  byState: [{ state: 'MG', count: 1, revenue: 4990 }],
  averageTicket: { sum: 4990, count: 1, average: 4990 },
  gatewaySummary: [],
  chartGranularity: 'daily',
  period: 'week',
  timezone: 'America/Sao_Paulo',
  fromCache: true,
};

describe('pickChartsFocus', () => {
  it('returns the whole payload without a focus', () => {
    expect(pickChartsFocus(charts)).toBe(charts);
  });

  it('keeps the asked part and the period, and says which part it is', () => {
    expect(pickChartsFocus(charts, 'states')).toEqual({
      focus: 'states',
      byState: charts.byState,
      chartGranularity: 'daily',
      period: 'week',
      timezone: 'America/Sao_Paulo',
      fromCache: true,
    });
    expect(Object.keys(pickChartsFocus(charts, 'revenue'))).toEqual(
      expect.arrayContaining(['chartData', 'averageTicket', 'conversion']),
    );
    expect(pickChartsFocus(charts, 'revenue')).not.toHaveProperty('byProduct');
  });
});

describe('DashboardService.getCharts', () => {
  it('passes range and tz through and applies the focus', async () => {
    const port = { getCharts: vi.fn().mockResolvedValue(charts) } as unknown as DashboardPort;
    const result = await new DashboardService(port).getCharts('month', 'UTC', 'refunds');
    expect(port.getCharts).toHaveBeenCalledWith('month', 'UTC');
    expect(result).toMatchObject({ focus: 'refunds', refunds: charts.refunds });
  });
});
