import { summarizeInvoice, summarizeInvoices, summarizeLedger, summarizeWallet } from './billing/model';
import { summarizeCharts, summarizeStats } from './dashboard/model';
import { summarizeDomain, summarizeDomainList, summarizeVerify } from './domains/model';
import { summarizeDeliveries, summarizeResend } from './deliveries/model';
import { summarizeStats as summarizeGatewayStats, summarizeWallets } from './gateways/model';
import { summarizeRedeem, summarizeRewards } from './rewards/model';
import { summarizeDownsells, summarizeUpsells } from './offers/model';
import { summarizeFlow, summarizeFlowList } from './telegram/model';
import { summarizeArea, summarizeCarousels, summarizeLessons, summarizeModules } from './members/model';
import { summarizeFunnelConversion, summarizeFunnelStats } from './funnel/model';
import { summarizePayment, summarizePaymentsPage } from './payments/model';
import { normalizePix } from './pix/model';

export type ViewName = 'sales' | 'funnel' | 'payments' | 'billing' | 'domains' | 'deliveries' | 'gateways' | 'rewards' | 'offers' | 'members' | 'telegram' | 'pix';

/** Tools with a view (their `_meta.ui.resourceUri` is ui://ggcheckout/app.html) and the view each draws. */
export const TOOL_VIEWS: Record<string, ViewName> = {
  get_dashboard_stats: 'sales',
  get_dashboard_charts: 'sales',
  get_funnel_lead_stats: 'funnel',
  get_funnel_lead_analytics: 'funnel',
  list_payments: 'payments',
  get_payments_paginated: 'payments',
  get_payment: 'payments',
  get_billing_status: 'billing',
  get_billing_balance: 'billing',
  list_invoices: 'billing',
  get_invoice: 'billing',
  list_credits: 'billing',
  list_custom_domains: 'domains',
  get_custom_domain: 'domains',
  add_custom_domain: 'domains',
  verify_custom_domain: 'domains',
  get_delivery_status: 'deliveries',
  resend_delivery: 'deliveries',
  list_checkout_wallets: 'gateways',
  get_gateway_fallback_stats: 'gateways',
  calculate_rewards: 'rewards',
  redeem_reward: 'rewards',
  list_upsells: 'offers',
  list_downsells: 'offers',
  get_members_area: 'members',
  list_modules: 'members',
  list_sections: 'members',
  list_lessons: 'members',
  list_telegram_flows: 'telegram',
  get_telegram_flow: 'telegram',
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
export function pickView(toolName: string | undefined, payload: unknown): ViewName | null {
  if (toolName && TOOL_VIEWS[toolName]) return TOOL_VIEWS[toolName];
  if (summarizeStats(payload) || summarizeCharts(payload)) return 'sales';
  if (summarizeFunnelStats(payload) || summarizeFunnelConversion(payload)) return 'funnel';
  if (summarizePaymentsPage(payload) || summarizePayment(payload)) return 'payments';
  if (summarizeWallet(payload) || summarizeInvoice(payload) || summarizeInvoices(payload) || summarizeLedger(payload)) return 'billing';
  if (summarizeDomain(payload) || summarizeDomainList(payload) || summarizeVerify(payload)) return 'domains';
  if (summarizeDeliveries(payload) || summarizeResend(payload)) return 'deliveries';
  if (summarizeWallets(payload) || summarizeGatewayStats(payload)) return 'gateways';
  if (summarizeRewards(payload) || summarizeRedeem(payload)) return 'rewards';
  if (summarizeUpsells(payload) || summarizeDownsells(payload)) return 'offers';
  if (summarizeArea(payload) || summarizeCarousels(payload) || summarizeModules(payload) || summarizeLessons(payload)) return 'members';
  if (summarizeFlow(payload) || summarizeFlowList(payload)) return 'telegram';
  if (normalizePix(payload)) return 'pix';
  return null;
}
