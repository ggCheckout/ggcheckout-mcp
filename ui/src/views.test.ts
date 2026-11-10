import { describe, expect, it } from 'vitest';
import { pickView } from './views';

describe('pickView', () => {
  it('follows the tool name when the host gives it', () => {
    expect(pickView('get_dashboard_stats', {})).toBe('sales');
    expect(pickView('create_pix_charge', {})).toBe('pix');
  });

  it('falls back to the payload shape', () => {
    expect(pickView(undefined, { totalSales: 1, totalRevenue: 100 })).toBe('sales');
    expect(pickView(undefined, { focus: 'states', byState: [] })).toBe('sales');
    expect(pickView(undefined, { stats: { visitors: 1, interactionRate: 0 } })).toBe('funnel');
    expect(pickView(undefined, { steps: [], totalVisitors: 0, overallConversionRate: 0 })).toBe('funnel');
    expect(pickView(undefined, { payments: [], total: 0 })).toBe('payments');
    expect(pickView(undefined, { payment: { id: 'p1', status: 'paid' } })).toBe('payments');
    expect(pickView(undefined, { status: 'active', isDelinquent: false, netBalanceCents: -5 })).toBe('billing');
    expect(pickView(undefined, { netBalanceCents: -5, limitWithToleranceCents: 11500, level: 6 })).toBe('billing');
    expect(pickView(undefined, { invoices: [], total: 0 })).toBe('billing');
    expect(pickView(undefined, { invoice: { id: 'i1', periodStart: '2026-11-01', status: 'paid' } })).toBe('billing');
    expect(pickView(undefined, { credits: [], total: 0, ledger: { entries: [], nextBefore: null } })).toBe('billing');
    expect(pickView(undefined, { object: 'payment_intent', id: 'pi_1', status: 'processing' })).toBe('pix');
    expect(pickView(undefined, { invoiceId: 'inv_1', amountCents: 100, status: 'overdue', pixCode: 'x', pixQrBase64: null })).toBe('pix');
    expect(pickView(undefined, { domains: [], total: 0, limit: 5 })).toBe('domains');
    expect(pickView(undefined, { domain: { id: 'd1', domain: 'pay.loja.com', status: 'pending' } })).toBe('domains');
    expect(pickView(undefined, { success: true, status: 'pending', checks: {} })).toBe('domains');
    expect(pickView(undefined, { deliveries: [], summary: { total: 0 }, paymentId: 'p1' })).toBe('deliveries');
    expect(pickView(undefined, { success: true, message: 'ok', remaining: { user: 1, payment: 1 } })).toBe('deliveries');
    expect(pickView(undefined, { anything: true })).toBeNull();
  });
});
