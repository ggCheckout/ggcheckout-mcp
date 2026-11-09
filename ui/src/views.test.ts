import { describe, expect, it } from 'vitest';
import { pickView } from './views';

describe('pickView', () => {
  it('follows the tool name when the host gives it', () => {
    expect(pickView('get_dashboard_stats', {}, {})).toBe('sales');
    expect(pickView('create_pix_charge', {}, {})).toBe('pix');
  });

  it('falls back to the payload shape', () => {
    expect(pickView(undefined, { totalSales: 1, totalRevenue: 100 }, {})).toBe('sales');
    expect(pickView(undefined, { focus: 'states', byState: [] }, {})).toBe('sales');
    expect(pickView(undefined, { stats: { visitors: 1, interactionRate: 0 } }, {})).toBe('funnel');
    expect(pickView(undefined, { steps: [], totalVisitors: 0, overallConversionRate: 0 }, {})).toBe('funnel');
    expect(pickView(undefined, { object: 'payment_intent', id: 'pi_1', status: 'processing' }, {})).toBe('pix');
    expect(pickView(undefined, { anything: true }, {})).toBeNull();
  });
});
