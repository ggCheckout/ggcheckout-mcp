import { summarizeInvoice, summarizeInvoices, summarizeLedger, summarizeWallet } from './billing/model';
import { summarizeCharts, summarizeStats } from './dashboard/model';
import { summarizeDomain, summarizeDomainList, summarizeVerify } from './domains/model';
import { isResendAnswer, summarizeDeliveries } from './deliveries/model';
import { summarizeStats as summarizeGatewayStats, summarizeWallets } from './gateways/model';
import { summarizeRedeem, summarizeRewards } from './rewards/model';
import { summarizeDownsells, summarizeUpsells } from './offers/model';
import { summarizeFlow, summarizeFlowList } from './telegram/model';
import { summarizeChip, summarizeChips, summarizePairing } from './chips/model';
import { summarizeArea, summarizeCarousels, summarizeLessons, summarizeModules } from './members/model';
import { summarizeFunnelConversion, summarizeFunnelStats } from './funnel/model';
import { summarizePayment, summarizePaymentsPage } from './payments/model';
import { normalizePix } from './pix/model';
import { summarizePayApi } from './payapi/model';
import { summarizeDiagnosis, summarizeGuide } from './tracking/model';
import { summarizeLink } from './utm/model';

export type ViewName = 'sales' | 'funnel' | 'payments' | 'billing' | 'domains' | 'deliveries' | 'gateways' | 'rewards' | 'offers' | 'members' | 'telegram' | 'chips' | 'pix' | 'payapi' | 'tracking' | 'utm';

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
  list_whatsapp_numbers: 'chips',
  get_whatsapp_number: 'chips',
  get_pairing_code: 'chips',
  create_pix_charge: 'pix',
  get_payment_intent: 'pix',
  add_credit: 'pix',
  get_credit_topup: 'pix',
  pay_invoice: 'pix',
  cancel_payment_intent: 'pix',
  get_payments_api_limits: 'payapi',
  list_wallets: 'payapi',
  list_payment_intents: 'payapi',
  explain_tracking: 'tracking',
  diagnose_tracking: 'tracking',
  build_tracking_link: 'utm',
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
  if (summarizeDeliveries(payload) || isResendAnswer(payload)) return 'deliveries';
  if (summarizeWallets(payload) || summarizeGatewayStats(payload)) return 'gateways';
  if (summarizeRewards(payload) || summarizeRedeem(payload)) return 'rewards';
  if (summarizeUpsells(payload) || summarizeDownsells(payload)) return 'offers';
  // Before members: a guide also has `sections`, which the members tree reads as a section list.
  if (summarizeDiagnosis(payload) || summarizeGuide(payload)) return 'tracking';
  if (summarizeArea(payload) || summarizeCarousels(payload) || summarizeModules(payload) || summarizeLessons(payload)) return 'members';
  if (summarizeFlow(payload) || summarizeFlowList(payload)) return 'telegram';
  if (summarizeChip(payload) || summarizeChips(payload) || summarizePairing(payload)) return 'chips';
  if (summarizePayApi(payload)) return 'payapi';
  if (normalizePix(payload)) return 'pix';
  if (summarizeLink(payload)) return 'utm';
  return null;
}
