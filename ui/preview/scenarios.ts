import {
  billingBalance, billingStatus, downsells, upsells, gatewayStats, wallets, deliveries, domainList, domains, verifyPending, billingStatusOverdue, invoicePix, charts, chartsFor, creditTopup, invoices, ledgerPages, funnelAnalytics, funnelStats, paymentIntent, payments, paymentsPage, statsFor,
} from './fixtures';

export interface Scenario {
  id: string;
  /** What the seller asked, as the model would turn it into this call. */
  question: string;
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

const focus = (name: string) => ({ ...charts, focus: name });

export const SCENARIOS: Scenario[] = [
  { id: 'stats', question: 'Quanto vendi essa semana?', tool: 'get_dashboard_stats', args: { range: 'week' }, result: statsFor('week') },
  { id: 'revenue', question: 'Como foi o faturamento por dia?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'revenue' }, result: focus('revenue') },
  { id: 'approval', question: 'Qual a aprovação por gateway?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'approval' }, result: focus('approval') },
  { id: 'products', question: 'Quais produtos mais venderam?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'products' }, result: focus('products') },
  { id: 'states', question: 'De quais estados vêm as vendas?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'states' }, result: focus('states') },
  { id: 'refunds', question: 'Quantos reembolsos tive?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'refunds' }, result: focus('refunds') },
  { id: 'panel', question: 'Me mostra o painel completo', tool: 'get_dashboard_charts', args: { range: 'week' }, result: charts },
  { id: 'funnel-stats', question: 'Como estão os leads do meu quiz?', tool: 'get_funnel_lead_stats', args: { funnelId: 'fn_preview' }, result: funnelStats },
  { id: 'funnel', question: 'Onde as pessoas desistem do quiz?', tool: 'get_funnel_lead_analytics', args: { funnelId: 'fn_preview' }, result: funnelAnalytics },
  { id: 'payments', question: 'Quais foram os últimos pagamentos?', tool: 'get_payments_paginated', args: { businessId: 'biz_preview' }, result: paymentsPage({}) },
  { id: 'payments-empty', question: 'Teve pagamento ontem?', tool: 'get_payments_paginated', args: { businessId: 'biz_preview', dateFrom: '2026-11-08T03:00:00Z', dateTo: '2026-11-09T02:59:59Z' }, result: { payments: [], total: 0, totalCapped: false, nextCursor: null } },
  { id: 'payments-all', question: 'Lista todos os meus pagamentos', tool: 'list_payments', args: { businessId: 'biz_preview' }, result: { payments } },
  { id: 'payment', question: 'Me mostra o pagamento do Bruno', tool: 'get_payment', args: { businessId: 'biz_preview', paymentId: payments[1].id }, result: { payment: payments[1] } },
  { id: 'wallet', question: 'Quanto tenho de saldo na GG?', tool: 'get_billing_status', args: {}, result: billingStatus },
  { id: 'wallet-overdue', question: 'Minha conta está em dia?', tool: 'get_billing_status', args: {}, result: billingStatusOverdue },
  { id: 'wallet-balance', question: 'Qual meu limite de crédito?', tool: 'get_billing_balance', args: {}, result: billingBalance },
  { id: 'invoices', question: 'Me mostra minhas faturas', tool: 'list_invoices', args: {}, result: { invoices, total: invoices.length } },
  { id: 'invoice', question: 'Abre a fatura em aberto', tool: 'get_invoice', args: { invoiceId: invoices[0].id }, result: { invoice: invoices[0] } },
  { id: 'ledger', question: 'Me mostra o extrato de crédito', tool: 'list_credits', args: {}, result: ledgerPages[0] },
  { id: 'domains', question: 'Quais domínios eu tenho?', tool: 'list_custom_domains', args: {}, result: domainList },
  { id: 'domain', question: 'Como configuro o DNS do pay.metodoaurora.com.br?', tool: 'get_custom_domain', args: { domainId: domains[0].id }, result: { domain: domains[0] } },
  { id: 'domain-add', question: 'Adiciona o domínio pay.metodoaurora.com.br', tool: 'add_custom_domain', args: { domain: domains[0].domain }, result: { success: true, domain: { id: domains[0].id, domain: domains[0].domain, status: 'pending', dnsInstructions: domains[0].dnsInstructions, createdAt: domains[0].createdAt } } },
  { id: 'domain-verify', question: 'Verifica o DNS do meu domínio', tool: 'verify_custom_domain', args: { domainId: domains[0].id }, result: verifyPending },
  { id: 'deliveries', question: 'O cliente recebeu o produto pelo WhatsApp?', tool: 'get_delivery_status', args: { paymentId: deliveries.paymentId }, result: deliveries },
  { id: 'deliveries-empty', question: 'Saiu WhatsApp desse pagamento?', tool: 'get_delivery_status', args: { paymentId: 'pay_preview_2' }, result: { paymentId: 'pay_preview_2', source: 'legacy', deliveries: [], summary: { total: 0, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0, permanentFailure: 0, canResend: false } } },
  { id: 'resend', question: 'Reenvia o WhatsApp do pagamento', tool: 'resend_delivery', args: { paymentId: deliveries.paymentId }, result: { success: true, message: 'Entregável reenviado via WhatsApp com sucesso', remaining: { user: 49, payment: 19 } } },
  { id: 'wallets', question: 'Qual a ordem de cobrança das minhas carteiras?', tool: 'list_checkout_wallets', args: {}, result: wallets },
  { id: 'gateway-ranking', question: 'Qual gateway está mais estável hoje?', tool: 'get_gateway_fallback_stats', args: {}, result: gatewayStats },
  { id: 'gateway-ranking-empty', question: 'Algum gateway falhando?', tool: 'get_gateway_fallback_stats', args: {}, result: { stats: {}, cachedAt: 1794317057192, window: { from: 'a', to: 'b', hours: 24 }, ranking: { reliability: [], conversion: [], card: [], pix: [] } } },
  { id: 'rewards', question: 'Quanto falta pra próxima placa?', tool: 'calculate_rewards', args: {}, result: { completedGoals: 4, currentRevenue: 190587.39, currentRevenueCents: 19058739, fromCache: false, milestones: [5000, 10000, 50000, 100000, 500000, 1000000], totalGoals: 6 } },
  { id: 'rewards-start', question: 'Quais recompensas eu posso ganhar?', tool: 'calculate_rewards', args: {}, result: { completedGoals: 1, currentRevenue: 7310.5, currentRevenueCents: 731050, fromCache: true, milestones: [5000, 10000, 50000, 100000, 500000, 1000000], totalGoals: 6 } },
  { id: 'upsells', question: 'Como está o funil pós-compra do Método Aurora?', tool: 'list_upsells', args: { productId: 'p_aurora' }, result: upsells },
  { id: 'downsells-orphan', question: 'Quais downsells eu tenho?', tool: 'list_downsells', args: { productId: 'p_orfao' }, result: downsells },
  { id: 'pix', question: 'Gera um PIX de R$ 49,90 (teste)', tool: 'create_pix_charge', args: { amount: 4990 }, result: paymentIntent('requires_action') },
  { id: 'topup', question: 'Coloca R$ 100 de crédito', tool: 'add_credit', args: { amountCents: 10000 }, result: creditTopup },
  { id: 'invoice-pix', question: 'Gera o PIX da fatura em aberto', tool: 'pay_invoice', args: { invoiceId: invoices[0].id }, result: invoicePix },
];

/** Answers the app's tools/call like the server would, from the same fixtures. */
export function answerTool(name: string, args: Record<string, unknown>, polls: { count: number }): unknown {
  const range = String(args.range ?? 'week');
  switch (name) {
    case 'get_dashboard_stats': return statsFor(range);
    case 'get_dashboard_charts': return args.focus ? { ...chartsFor(range), focus: args.focus } : chartsFor(range);
    // The charge is paid on the third poll, so the preview shows the switch to "confirmed".
    case 'get_payments_paginated': return paymentsPage(args);
    case 'get_payment_intent': return paymentIntent(++polls.count >= 3 ? 'succeeded' : 'requires_action');
    case 'get_invoice': return { invoice: { ...invoices[0], status: ++polls.count >= 3 ? 'paid' : 'overdue' } };
    case 'get_custom_domain': return { domain: domains.find((d) => d.id === args.domainId) ?? domains[0] };
    case 'verify_custom_domain': return verifyPending;
    case 'get_delivery_status': return deliveries;
    case 'resend_delivery': return { success: true, message: 'Entregável reenviado via WhatsApp com sucesso', remaining: { user: 48, payment: 18 } };
    case 'get_gateway_fallback_stats': return gatewayStats;
    case 'redeem_reward': return { success: true, redeemType: 'whatsapp_group', redirectUrl: 'https://chat.whatsapp.com/preview', redeemCount: 1, maxRedeems: 1 };
    case 'list_downsells': return downsells;
    case 'list_upsells': return args.productId === 'p_orfao' ? { upsells: [] } : upsells;
    case 'list_credits': return args.before ? ledgerPages[1] : ledgerPages[0];
    case 'get_credit_topup': return { topup: { ...creditTopup, status: 'pending' } };
    default: throw new Error(`no fixture for ${name}`);
  }
}
