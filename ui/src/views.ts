import { summarizeCharts, summarizeStats } from './dashboard/model';
import { normalizePix } from './pix/model';

export type ViewName = 'sales' | 'pix';

/** Tools with a view (their `_meta.ui.resourceUri` is ui://ggcheckout/app.html) and the view each draws. */
export const TOOL_VIEWS: Record<string, ViewName> = {
  get_dashboard_stats: 'sales',
  get_dashboard_charts: 'sales',
  create_pix_charge: 'pix',
  get_payment_intent: 'pix',
  add_credit: 'pix',
  get_credit_topup: 'pix',
  pay_invoice: 'pix',
};

/**
 * The view for a result: by tool name when the host gives it, else by the payload's shape (not every
 * host fills hostContext.toolInfo).
 */
export function pickView(toolName: string | undefined, payload: unknown, args: Record<string, unknown>): ViewName | null {
  if (toolName && TOOL_VIEWS[toolName]) return TOOL_VIEWS[toolName];
  if (summarizeStats(payload) || summarizeCharts(payload)) return 'sales';
  if (normalizePix(payload, args)) return 'pix';
  return null;
}
