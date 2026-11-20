import {
  billingBalance, billingStatus, membersArea, chips, chipDetail, telegramFlows, telegramFlowVisual, telegramFlowBasic, memberCarousels, memberModules, memberLessons, downsells, upsells, gatewayStats, wallets, deliveries, domainList, domains, verifyPending, billingStatusOverdue, invoicePix, charts, chartsFor, creditTopup, invoices, ledgerPages, funnelAnalytics, funnelStats, paymentIntent, payments, paymentsPage, statsFor,
  payApiLimits, payApiLimitsUnavailable, payApiWallets, payApiIntents, trackingGuide, trackingDiagnosis, utmMeta, utmManual,
  inboxOpen, inboxOff, inboxUnavailable, inboxConversations, inboxMessages, inboxFunnels, inboxRun,
  operations, products, waFunnelDetail,
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
  { id: 'payments-all', question: 'Lista todos os meus pagamentos', tool: 'list_payments', args: { businessId: 'biz_preview' }, result: paymentsPage({}) },
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
  { id: 'members', question: 'Como está a área de membros do Método Aurora?', tool: 'get_members_area', args: { areaId: 'ma_aurora' }, result: membersArea },
  { id: 'members-carousels', question: 'Quais carrosséis tem no curso?', tool: 'list_modules', args: { areaId: 'ma_aurora' }, result: memberCarousels },
  { id: 'members-lessons', question: 'Quais aulas tem em Boas-vindas?', tool: 'list_lessons', args: { areaId: 'ma_aurora', moduleId: 'mc1', sectionId: 'ms1' }, result: memberLessons },
  { id: 'telegram-flow', question: 'Me mostra o fluxo do meu bot', tool: 'get_telegram_flow', args: { flowId: 'tf_visual' }, result: telegramFlowVisual },
  { id: 'telegram-flows', question: 'Quais flows meu bot tem?', tool: 'list_telegram_flows', args: { botId: 'bot1' }, result: telegramFlows },
  { id: 'chips', question: 'Quais chips do WhatsApp estão conectados?', tool: 'list_whatsapp_numbers', args: {}, result: chips },
  { id: 'chip-connect', question: 'Conecta meu chip Vendas 2', tool: 'get_whatsapp_number', args: { numberId: 'chip_vendas' }, result: chipDetail('chip_vendas') },
  { id: 'chip-dropped', question: 'Por que o chip Reserva não envia?', tool: 'get_whatsapp_number', args: { numberId: 'chip_reserva' }, result: chipDetail('chip_reserva') },
  { id: 'operations', question: 'Como estão minhas operações do WhatsApp?', tool: 'list_whatsapp_sessions', args: {}, result: operations },
  { id: 'operation', question: 'Abre a operação Método Aurora', tool: 'get_whatsapp_session', args: { sessionId: 'g1' }, result: { session: operations.sessions[0] } },
  { id: 'wa-funnels', question: 'Quais funis de WhatsApp eu tenho?', tool: 'list_whatsapp_funnels', args: {}, result: inboxFunnels },
  { id: 'wa-funnel', question: 'Me mostra o funil de carrinho abandonado', tool: 'get_whatsapp_funnel', args: { funnelId: inboxFunnels.items[1].id }, result: waFunnelDetail(inboxFunnels.items[1].id) },
  { id: 'chip-code', question: 'Gera o código pra conectar o chip Vendas 2', tool: 'get_pairing_code', args: { numberId: 'chip_vendas', phoneNumber: '5531998778877' }, result: { success: true, code: 'K7QW2MZP' } },
  { id: 'pix', question: 'Gera um PIX de R$ 49,90 (teste)', tool: 'create_pix_charge', args: { amount: 4990 }, result: paymentIntent('requires_action') },
  { id: 'pix-canceled', question: 'Cancela a cobrança pi_preview…', tool: 'cancel_payment_intent', args: { id: 'pi_preview0000000000000001' }, result: { ...paymentIntent('requires_action'), status: 'canceled' } },
  { id: 'payapi-limits', question: 'Quais são os limites da API de pagamentos?', tool: 'get_payments_api_limits', args: {}, result: payApiLimits },
  { id: 'payapi-limits-unavailable', question: 'Quais são os limites da API de pagamentos?', tool: 'get_payments_api_limits', args: {}, result: payApiLimitsUnavailable },
  { id: 'payapi-wallets', question: 'Quais carteiras a chave pode cobrar?', tool: 'list_wallets', args: {}, result: payApiWallets },
  { id: 'payapi-intents', question: 'Lista as últimas cobranças PIX', tool: 'list_payment_intents', args: {}, result: payApiIntents },
  { id: 'tracking-guide', question: 'Como as métricas das minhas vendas chegam na Meta e no TikTok?', tool: 'explain_tracking', args: {}, result: trackingGuide },
  { id: 'tracking-diagnosis', question: 'Por que a venda do curso não aparece no TikTok?', tool: 'diagnose_tracking', args: { checkoutId: 'ck_preview', paymentId: 'pay_preview' }, result: trackingDiagnosis },
  { id: 'utm-meta', question: 'Gera o link do meu checkout pra anunciar no Meta', tool: 'build_tracking_link', args: { checkoutId: 'ck_aurora', platform: 'meta' }, result: utmMeta },
  { id: 'utm-manual', question: 'Faz um link do quiz pra colocar na bio do Instagram', tool: 'build_tracking_link', args: { funnelId: 'fn_aurora', platform: 'manual', utm_source: 'instagram', utm_medium: 'bio', utm_campaign: 'Lançamento Aurora', sck: 'story1' }, result: utmManual },
  { id: 'inbox', question: 'Abre minha caixa de entrada do WhatsApp', tool: 'open_whatsapp_inbox', args: {}, result: inboxOpen },
  { id: 'inbox-off', question: 'Abre minha caixa de entrada do WhatsApp', tool: 'open_whatsapp_inbox', args: {}, result: inboxOff },
  { id: 'inbox-unavailable', question: 'Abre minha caixa de entrada do WhatsApp', tool: 'open_whatsapp_inbox', args: {}, result: inboxUnavailable },
  { id: 'topup', question: 'Coloca R$ 100 de crédito', tool: 'add_credit', args: { amountCents: 10000 }, result: creditTopup },
  { id: 'invoice-pix', question: 'Gera o PIX da fatura em aberto', tool: 'pay_invoice', args: { invoiceId: invoices[0].id }, result: invoicePix },
];

type PreviewOperation = (typeof operations.sessions)[number];
/** The operations as the preview's writes leave them, so a second write builds on the first. */
const operationStore = new Map<string, PreviewOperation>(
  operations.sessions.map((s) => [s.uid, { ...s, fallbackNumberIds: [...s.fallbackNumberIds], assignedProducts: [...s.assignedProducts] }]),
);
const operationOf = (id: unknown): PreviewOperation => operationStore.get(String(id)) ?? operationStore.get('g1')!;

/** Funnels the preview turned on or off, and the ones it deleted, so the list shows the writes. */
const funnelEnabled = new Map<string, boolean>();
const funnelDeleted = new Set<string>();
const funnelPage = () => ({
  ...inboxFunnels,
  items: inboxFunnels.items.filter((f) => !funnelDeleted.has(f.id)).map((f) => ({ ...f, isEnabled: funnelEnabled.get(f.id) ?? f.isEnabled })),
});

/** remove_whatsapp_session_number: the primary's removal promotes the first fallback. */
function removeChip(op: PreviewOperation, numberId: string): PreviewOperation {
  if (op.primaryNumberId === numberId) {
    const [next, ...rest] = op.fallbackNumberIds;
    if (!next) throw new Error('A operação precisa de pelo menos o chip principal');
    return Object.assign(op, { primaryNumberId: next, fallbackNumberIds: rest });
  }
  return Object.assign(op, { fallbackNumberIds: op.fallbackNumberIds.filter((id) => id !== numberId) });
}

/** Answers the app's tools/call like the server would, from the same fixtures. */
export function answerTool(name: string, args: Record<string, unknown>, polls: { count: number }): unknown {
  const range = String(args.range ?? 'week');
  switch (name) {
    case 'get_dashboard_stats': return statsFor(range);
    case 'get_dashboard_charts': return args.focus ? { ...chartsFor(range), focus: args.focus } : chartsFor(range);
    // The charge is paid on the third poll, so the preview shows the switch to "confirmed".
    case 'get_payments_paginated': return paymentsPage(args);
    case 'get_payment_intent': {
      // The row opened from the payapi list keeps its id; any other id is the preview charge.
      const intent = paymentIntent(++polls.count >= 3 ? 'succeeded' : 'requires_action');
      return typeof args.id === 'string' ? { ...intent, id: args.id } : intent;
    }
    case 'get_payments_api_limits': return payApiLimits;
    case 'list_payment_intents': return { ...payApiIntents, has_more: false, next_cursor: null };
    case 'list_wallets': return payApiWallets;
    case 'build_tracking_link': return args.platform === 'meta' ? utmMeta : utmManual;
    case 'get_invoice': return { invoice: { ...invoices[0], status: ++polls.count >= 3 ? 'paid' : 'overdue' } };
    case 'get_custom_domain': return { domain: domains.find((d) => d.id === args.domainId) ?? domains[0] };
    case 'verify_custom_domain': return verifyPending;
    case 'get_delivery_status': return deliveries;
    case 'resend_delivery': return { success: true, message: 'Entregável reenviado via WhatsApp com sucesso', remaining: { user: 48, payment: 18 } };
    case 'get_gateway_fallback_stats': return gatewayStats;
    case 'redeem_reward': return { success: true, redeemType: 'whatsapp_group', redirectUrl: 'https://chat.whatsapp.com/preview', redeemCount: 1, maxRedeems: 1 };
    case 'list_downsells': return downsells;
    case 'list_upsells': return args.productId === 'p_orfao' ? { upsells: [] } : upsells;
    case 'list_modules': return memberCarousels;
    case 'list_sections': return memberModules[String(args.moduleId)] ?? { sections: [] };
    case 'list_lessons': return memberLessons;
    case 'get_telegram_flow': return args.flowId === 'tf_basic' ? telegramFlowBasic : telegramFlowVisual;
    // The chip connects on the third read, so the preview shows the switch to "Conectado".
    case 'get_whatsapp_number': return chipDetail(String(args.numberId), args.numberId === 'chip_vendas' && ++polls.count >= 3 ? 'authenticated' : undefined);
    case 'get_billing_status': return billingStatus;
    case 'check_whatsapp_numbers': return { summary: { total: 5, connected: 2, disconnected: 1, divergent: 1, synced: 1 }, numbers: [{ numberId: 'chip_reserva', displayName: 'Reserva', firebaseStatus: 'authenticated', firebaseIsActive: true, realStatus: 'disconnected', diverged: true }] };
    case 'list_whatsapp_numbers': return chips;
    case 'list_whatsapp_sessions': return { sessions: [...operationStore.values()] };
    case 'get_whatsapp_session': return { session: operationOf(args.sessionId) };
    case 'update_whatsapp_session': {
      const op = operationOf(args.sessionId);
      if (typeof args.primaryNumberId === 'string') Object.assign(op, { primaryNumberId: args.primaryNumberId, fallbackNumberIds: args.fallbackNumberIds as string[] });
      return { success: true, session: op };
    }
    case 'add_whatsapp_session_number': {
      const op = operationOf(args.sessionId);
      op.fallbackNumberIds = [...op.fallbackNumberIds, String(args.numberId)];
      return { success: true, session: op };
    }
    case 'remove_whatsapp_session_number': return { success: true, session: removeChip(operationOf(args.sessionId), String(args.numberId)) };
    case 'set_whatsapp_session_products': {
      const op = operationOf(args.sessionId);
      op.assignedProducts = [...(args.productIds as string[])];
      return { success: true, session: op };
    }
    case 'list_products': return products;
    case 'get_pairing_code': return { success: true, code: 'K7QW2MZP' };
    case 'update_whatsapp_number': return { success: true, ...chipDetail(String(args.numberId)), number: { ...chipDetail(String(args.numberId)).number, isActive: args.isActive } };
    case 'restart_whatsapp_number': return { message: 'Chip reiniciado', numberId: args.numberId };
    case 'list_credits': return args.before ? ledgerPages[1] : ledgerPages[0];
    case 'get_credit_topup': return { topup: { ...creditTopup, status: 'pending' } };
    case 'list_whatsapp_conversations': return inboxConversations;
    case 'list_whatsapp_messages': return inboxMessages(String(args.contactKey));
    case 'list_whatsapp_funnels': return funnelPage();
    case 'get_whatsapp_funnel': return waFunnelDetail(String(args.funnelId), funnelEnabled.get(String(args.funnelId)));
    case 'toggle_whatsapp_funnel': {
      const id = String(args.funnelId);
      const row = funnelPage().items.find((f) => f.id === id);
      // The API refuses a second funnel on for the same automatic trigger.
      if (args.enabled === true && row && row.trigger !== 'manual' && funnelPage().items.some((f) => f.id !== id && f.trigger === row.trigger && f.isEnabled)) {
        throw new Error('API Error (409): Já existe um funil ligado para este gatilho.');
      }
      funnelEnabled.set(id, args.enabled === true);
      return { success: true, ...waFunnelDetail(id, args.enabled === true) };
    }
    case 'delete_whatsapp_funnel': funnelDeleted.add(String(args.funnelId)); return { success: true, message: `Funnel ${args.funnelId} deleted` };
    case 'get_whatsapp_conversation_funnel': return inboxRun(String(args.contactKey));
    case 'mark_whatsapp_conversation_read': return { success: true };
    case 'send_whatsapp_reply': return { message: { messageId: 'w_new', deliveryId: 'a1b2c3d4-0000-4000-8000-000000000002', contactKey: args.contactKey, chipId: 'chip_vendas', text: args.text, at: new Date().toISOString(), chipSwitch: null, duplicate: false } };
    case 'start_whatsapp_conversation_funnel': return { started: true, run: { ...inboxRun('553198765001').run, contactKey: args.contactKey, currentStep: 0 }, replacedRunId: null };
    case 'stop_whatsapp_conversation_funnel': return { stoppedRunId: 'a1b2c3d4-0000-4000-8000-000000000001' };
    case 'set_whatsapp_conversation_opt_out': return { optedOut: args.optedOut === true, stoppedRuns: args.optedOut === true ? 1 : 0 };
    default: throw new Error(`no fixture for ${name}`);
  }
}
