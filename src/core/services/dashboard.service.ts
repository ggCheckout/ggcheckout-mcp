import type { DashboardPort } from '../ports/dashboard.port.js';
import type { DashboardFocus, DashboardRange } from '../types/dashboard.js';

/** The fields of `GET /api/dashboard/charts` each focus keeps, besides the period ones. */
const FOCUS_FIELDS: Record<DashboardFocus, string[]> = {
  revenue: ['chartData', 'averageTicket', 'conversion'],
  approval: ['approvalRate', 'byMethod', 'gatewaySummary'],
  products: ['byProduct', 'byOrderBump'],
  states: ['byState'],
  refunds: ['refunds'],
};
const PERIOD_FIELDS = ['chartGranularity', 'period', 'timezone', 'fromCache'];

/**
 * Keeps only what the question asked about: the model reads less, and the inline view draws that
 * part alone. `focus` is echoed back so the view knows which part it got.
 */
export function pickChartsFocus(data: Record<string, unknown>, focus?: DashboardFocus) {
  if (!focus) return data;
  const keep = [...PERIOD_FIELDS, ...FOCUS_FIELDS[focus]];
  return { focus, ...Object.fromEntries(keep.filter((k) => k in data).map((k) => [k, data[k]])) };
}

export class DashboardService {
  constructor(private readonly port: DashboardPort) {}
  async getStats(range?: DashboardRange) { return this.port.getStats(range); }
  async getCharts(range?: DashboardRange, tz?: string, focus?: DashboardFocus) {
    return pickChartsFocus(await this.port.getCharts(range, tz), focus);
  }
  async invalidateCache() { return this.port.invalidateCache(); }
}
