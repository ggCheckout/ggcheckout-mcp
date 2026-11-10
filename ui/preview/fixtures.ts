// Invented payloads in the exact shape each tool answers (structuredContent), so every view and
// state can be seen without an API key. Amounts in cents, as the API sends them.

const day = (date: string, label: string, sales: number, revenue: number) => ({ label, date, sales, revenue });

export const charts = {
  chartData: [
    day('2026-09-15', 'Seg', 18, 68490), day('2026-09-16', 'Ter', 25, 118050), day('2026-09-17', 'Qua', 21, 94120),
    day('2026-09-18', 'Qui', 32, 152080), day('2026-09-19', 'Sex', 32, 154830), day('2026-09-20', 'Sáb', 14, 51210),
    day('2026-09-21', 'Dom', 9, 38870),
  ],
  chartGranularity: 'daily',
  approvalRate: { pix: { total: 112, approved: 104 }, card: { total: 68, approved: 47 }, crypto: { total: 0, approved: 0 }, boleto: { total: 0, approved: 0 } },
  byMethod: { pix: 104, card: 47 },
  byProduct: [
    { productId: 'p1', name: 'Método Aurora', count: 48 }, { productId: 'p2', name: 'Clube Norte', count: 31 },
    { productId: 'p3', name: 'Órbita Pro', count: 22 }, { productId: 'p4', name: 'Farol de Vendas', count: 17 },
    { productId: 'p5', name: 'Trilha do Lançamento', count: 12 }, { productId: 'p6', name: 'Mapa de Conteúdo', count: 7 },
  ],
  byOrderBump: [
    { productId: 'ob1', name: 'Planilha de lançamento', count: 16 },
    { productId: 'ob2', name: 'Checklist do anúncio', count: 9 },
  ],
  conversion: { ordersGenerated: 260, paymentsCompleted: 151 },
  refunds: { chargeback: 1, med: 0, refund: 3 },
  byState: [
    { state: 'SP', count: 58, revenue: 271300 }, { state: 'MG', count: 34, revenue: 149800 },
    { state: 'RJ', count: 25, revenue: 118200 }, { state: 'PR', count: 14, revenue: 60300 },
    { state: 'BA', count: 11, revenue: 47900 }, { state: 'RS', count: 9, revenue: 30150 },
  ],
  averageTicket: { sum: 677650, count: 151, average: 4488 },
  gatewaySummary: [
    { gateway: 'efibank', total: 70, approved: 66, revenue: 291200, pix: { total: 70, approved: 66 }, card: { total: 0, approved: 0 } },
    { gateway: 'appmax', total: 42, approved: 38, revenue: 166400, pix: { total: 42, approved: 38 }, card: { total: 0, approved: 0 } },
    { gateway: 'stripe', total: 68, approved: 47, revenue: 220050, pix: { total: 0, approved: 0 }, card: { total: 68, approved: 47 } },
  ],
  period: 'week',
  timezone: 'America/Sao_Paulo',
  fromCache: false,
};

/** Scales the week to another period, so the period buttons visibly change the numbers. */
export function chartsFor(range: string) {
  const k = { today: 0.15, yesterday: 0.14, week: 1, month: 4.2, year: 48, all: 60 }[range] ?? 1;
  return {
    ...charts,
    period: range,
    chartData: charts.chartData.map((p) => ({ ...p, sales: Math.round(p.sales * k), revenue: Math.round(p.revenue * k) })),
  };
}

export function statsFor(range: string) {
  const k = { today: 0.15, yesterday: 0.14, week: 1, month: 4.2, year: 48, all: 60 }[range] ?? 1;
  return {
    totalSales: Math.round(151 * k), totalRevenue: Math.round(677650 * k), pendingCount: 9, failedCount: 6,
    expiredCount: 3, cancelledCount: 1, refundedCount: 3, previousTotalSales: 134, previousTotalRevenue: 623400,
    previousPendingCount: 11, averageTicket: 4488, previousAverageTicket: 4652, period: range, fromCache: false,
  };
}

/** A QR-looking placeholder (not scannable). */
const QR = 'iVBORw0KGgoAAAANSUhEUgAAAQgAAAEICAAAAACGnTUjAAACkklEQVR42u3cQXLDMAgF0Nz/0ulM9xnBB9vp9GmZOhJ63jBA+npbv+uFAAQIECBAgAABAgQIECBAgHgM4hWu7vc/Pf8x0PCc0/kgQIAAAQIEiH2IciLSvFj38+p5abwgQIAAAQIEiOsgqgnRNJBTYleFSOMFAQIECBAgQDwHUS6ALD8PAgQIECBAgPj7EFuNlxQIBAgQIECAAPF9EGkBZdqQ6YJ8TacLBAgQIECAAHFZAtS9+Fbh5rgPCBAgQIAAAWIMUU1EugWT7UTpVJB5NxcIECBAgAABYg4xHfBIGyxbhZu4EAQCBAgQIECAGEPcndCkCdD2/iBAgAABAgSIfYi0YVJN0NIC0OkFtOMEAQIECBAgQIwh0g3TQZD0nCkQCBAgQIAAAeJ6iDTh6V5kOjja3Q8ECBAgQIAAcR/EtJAyHRBJYdYKMyBAgAABAgSIcoNnu6CylvgsJ2IgQIAAAQIEiD2I00XWGirNc9K4yvuDAAECBAgQINYgugnJ9kW6idu48AMCBAgQIECAGENsFWq2CjdXNZRAgAABAgQIEPsQ6UXTQLqDqdXErx0HCBAgQIAAAWINIk2o0gLPKRGrAt3W6QIBAgQIECBArP+j7u7FqonadDD1+DkIECBAgAABYgyx9UOQbmI0HQCZDraAAAECBAgQIJ6DaB8cfq/bMAIBAgQIECBA3A+RHnxVg6bbUGr/HQQIECBAgACxDlEtnFQLKN0GUHcQJX4OBAgQIECAAPEYxDQR2mowxS8KBAgQIECAAPEYRDeAFHgLFgQIECBAgABxPcRWg6ca+HTAJH4xIECAAAECBIg1iOlKYaYNouo9QIAAAQIECBD7EP91gQABAgQIECBAgAABAgQIECBuWz/AMKY/numJnAAAAABJRU5ErkJggg==';

export function paymentIntent(status: 'requires_action' | 'succeeded', livemode = false) {
  return {
    id: 'pi_preview0000000000000001', object: 'payment_intent', livemode, status, amount: 4990,
    description: 'Pedido 1042', pix: { copy_paste: '00020126580014br.gov.bcb.pix0136preview-0000-0000-0000', qr_base64: QR, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() },
  };
}

export const creditTopup = {
  creditId: 'cr_preview', via: 'topup', amountCents: 10000, pixCode: '00020126580014br.gov.bcb.pix0136preview-credit',
  pixQrBase64: QR, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
};

const step = (stepId: string, title: string, visitors: number, exits: number, dropOffRate: number) => ({ stepId, title, visitors, exits, dropOffRate });

export const funnelAnalytics = {
  funnelTitle: 'Quiz do perfil de investidor',
  steps: [
    step('st1', 'Boas-vindas', 320, 64, 20), step('st2', 'Objetivo', 256, 31, 12),
    step('st3', 'Experiência', 225, 81, 36), step('st4', 'Seus dados', 144, 72, 50),
    step('st5', 'Resultado', 72, 0, 0),
  ],
  totalVisitors: 320,
  totalCompleted: 72,
  overallConversionRate: 23,
};

export const funnelStats = { stats: { visitors: 320, leads: 144, interactionRate: 80, qualified: 96, completed: 72 } };

// Payments: invented buyers, masked like the server masks them. 47 of them, newest first.
const BUYERS = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha', 'Elisa Prado', 'Felipe Nunes', 'Gabi Torres', 'Hugo Alves'];
const OFFERS = ['Método Aurora', 'Clube Norte', 'Órbita Pro', 'Farol de Vendas — acesso vitalício com bônus de lançamento'];
const GATEWAYS: [string, string][] = [['efibank', 'pix'], ['mercadopago', 'pix'], ['stripe', 'credit_card'], ['appmax', 'credit_card'], ['zuckpay', 'pix'], ['novogateway', 'bank_slip']];
const STATUSES = ['paid', 'paid', 'pending', 'paid', 'expired', 'refunded', 'paid', 'failed', 'charged_back', 'paid'];

export const payments = Array.from({ length: 47 }, (_, i) => {
  const name = BUYERS[i % BUYERS.length];
  const [gatewayName, paymentMethod] = GATEWAYS[i % GATEWAYS.length];
  const status = STATUSES[i % STATUSES.length];
  const cents = [4990, 19700, 9790, 49700, 2990][i % 5];
  const createdAt = new Date(Date.UTC(2026, 10, 9, 21, 0) - i * 47 * 60_000).toISOString().replace('Z', '123+00:00');
  const local = name.toLowerCase().replace(' ', '.');
  return {
    id: `pay_${(0x9f3a21 + i * 7919).toString(16)}${i}e0c4b7d2`,
    status, paymentMethod, gatewayName, finalValueInCents: cents, value: cents / 100,
    installments: paymentMethod === 'credit_card' ? (i % 3) + 1 : 1,
    name, email: `${local[0]}***${local.at(-1)}@gmail.com`, cpf: '***.456.789-**', phone: '(31) *****-4321',
    titleOffer: OFFERS[i % OFFERS.length], paymentMode: i % 9 === 4 ? 'subscription' : 'production',
    orderBumps: i % 4 === 1 ? [{ title: 'Planilha de lançamento', priceCents: 1990 }, { title: 'Checklist do anúncio', priceCents: 990 }] : [],
    ...(i % 7 === 3 ? { affiliateData: { commissionPercent: 40 } } : {}),
    createdAt, paidAt: status === 'paid' ? createdAt : null,
  };
});

/** get_payments_paginated over the fixture: cursor = createdAt|id of the page's last payment. */
export function paymentsPage(args: Record<string, unknown>) {
  const size = Number(args.pageSize) || 10;
  const term = String(args.searchTerm ?? '').toLowerCase();
  const matches = term ? payments.filter((p) => [p.id, p.email, p.name, p.titleOffer].some((f) => f.toLowerCase().includes(term))) : payments;
  const after = String(args.lastCreatedAt ?? '').split('|')[1];
  const start = after ? matches.findIndex((p) => p.id === after) + 1 : 0;
  const page = matches.slice(start, start + size);
  const last = page.at(-1);
  return {
    payments: page,
    total: matches.length,
    totalCapped: false,
    nextCursor: start + size < matches.length && last ? `${last.createdAt}|${last.id}` : null,
    ...(term ? { coverageCapped: true } : {}),
  };
}

// Billing, in the shapes the billing routes answer for a seller on the new billing (payments).
export const billingStatus = {
  status: 'active', isDelinquent: false, graceStage: null, graceEndsAt: null, hasOverdueInvoice: false, isBlocked: false,
  hasValidCard: false, usesBillingGateway: true, isMigratedToPayments: true, paymentsCreditBalanceCents: 4250,
  paymentsCreditLevel: 3, paymentsCreditTotalPaidCents: 2310, paymentsClosingAt: '2026-11-13T19:02:59.210836+00:00',
  paymentsOpenInvoice: null, paymentsUnbilledFeeCents: 1180, paymentsUnbilledSaleCount: 14,
  paymentsCycleStartedAt: '2026-11-06T19:02:59.210836+00:00', paymentsCreditLimitCents: 2000, paymentsCapExposureCents: -3070,
  billingStatus: 'active', graceStartedAt: null, usagePercent: 0, netBalanceCents: -3070, limitCents: 2000,
};

export const billingStatusOverdue = {
  ...billingStatus, status: 'grace_period', billingStatus: 'grace_period', isDelinquent: true, hasOverdueInvoice: true,
  graceStage: 'T5', graceEndsAt: '2026-12-31T21:00:00.000Z', paymentsCreditBalanceCents: 0, paymentsCreditLevel: 2,
  paymentsCreditLimitCents: 1000, limitCents: 1000, paymentsUnbilledFeeCents: 640,
  paymentsOpenInvoice: { invoiceId: 'inv_overdue', amountCents: 1460, status: 'overdue' }, netBalanceCents: 640,
};

export const billingBalance = {
  currentBalanceCents: 0, creditBalanceCents: 0, netBalanceCents: 820, level: 5, limitCents: 7000, limitWithToleranceCents: 8050,
  usagePercent: 12, usageCents: 820, usageLimitCents: 7000, closingAt: '2026-11-13T19:02:59.210836+00:00', cycleStartAt: '2026-11-06T19:02:59.210836+00:00',
};

const week = (end: string, i: number) => {
  const close = new Date(Date.parse(end) - i * 7 * 86_400_000);
  return { periodStart: new Date(close.getTime() - 7 * 86_400_000).toISOString(), periodEnd: close.toISOString() };
};
const invoice = (i: number, status: string, fee: number, credit: number, sales: number, volume: number) => {
  const { periodStart, periodEnd } = week('2026-11-06T19:02:59.210Z', i);
  return {
    id: `inv_${String(i).padStart(3, '0')}`, businessId: 'biz_preview', status, periodStart, periodEnd, createdAt: periodEnd, dueAt: periodEnd,
    paidAt: status === 'paid' ? periodEnd : null, feeGrossCents: fee, totalFeeCents: fee - credit, creditAppliedCents: credit,
    prepaidAppliedCents: credit, transactionCount: sales, grossVolumeCents: volume, whatsappUsageCents: i === 1 ? 120 : 0,
    whatsappMessageCount: i === 1 ? 24 : 0, sacOverageCents: 0, source: 'payments', track: 'sales', paymentAttempts: [], paymentIds: [],
  };
};
export const invoices = [
  invoice(0, 'overdue', 1460, 0, 18, 287400),
  ...Array.from({ length: 13 }, (_, i) => invoice(i + 1, 'paid', 900 + ((i * 137) % 700), i % 3 === 0 ? 300 : 900 + ((i * 137) % 700), 9 + (i % 7), 120000 + i * 15350)),
];

/** pay_invoice: the PIX of the overdue invoice, with the same QR as the other PIX fixtures. */
export const invoicePix = {
  invoiceId: invoices[0].id, amountCents: invoices[0].feeGrossCents, status: 'overdue',
  pixCode: creditTopup.pixCode, pixQrBase64: creditTopup.pixQrBase64, expiresAt: '2026-12-31T23:59:00.000Z',
};

const entry = (id: string, kind: string, amountCents: number, balanceAfterCents: number, createdAt: string, extra: object = {}) => ({
  id, kind, amountCents, balanceAfterCents, refId: null, description: null, createdAt, invoice: null, pendingInvoice: null, ...extra,
});
const closing = (gross: number, credit: number, trigger: 'cap' | 'time') => ({
  invoice: { invoiceId: 'inv', closedAt: '2026-11-06T19:02:59.210836+00:00', closeTrigger: trigger, grossCents: gross, creditAppliedCents: credit, remainingCents: gross - credit },
});
export const ledgerPages = [
  {
    credits: [], total: 0,
    ledger: {
      entries: [
        entry('l1', 'topup', 4250, 4250, '2026-11-08T14:21:09.112000+00:00'),
        entry('l2', 'cycle_debit', -680, 0, '2026-11-06T19:03:03.183191+00:00', closing(1430, 680, 'time')),
        entry('l3', 'cycle_debit', -2000, 680, '2026-11-01T11:40:12.004000+00:00', closing(2600, 2000, 'cap')),
        entry('l4', 'debt_settled', -600, 2680, '2026-10-28T09:12:44.000000+00:00', {
          invoice: { invoiceId: 'inv_old', closedAt: '2026-10-23T19:02:59.210836+00:00', closeTrigger: null, grossCents: null, creditAppliedCents: null, remainingCents: null },
        }),
        entry('l5', 'topup', 3000, 3280, '2026-10-28T09:12:43.900000+00:00', { pendingInvoice: { invoiceId: 'inv_old', amountCents: 600, shortfallCents: 0 } }),
      ],
      nextBefore: '2026-10-28T09:12:43.900000+00:00|l5',
    },
  },
  {
    credits: [], total: 0,
    ledger: {
      entries: [
        entry('l6', 'topup', 200, 280, '2026-10-20T16:02:10.000000+00:00', { pendingInvoice: { invoiceId: 'inv_x', amountCents: 900, shortfallCents: 700 } }),
        entry('l7', 'opening', 80, 80, '2026-10-01T00:00:00.000000+00:00'),
      ],
      nextBefore: null,
    },
  },
];

// Custom domains, in the shapes the domain routes answer.
const dnsInstructions = (name: string) => ({
  type: 'subdomain',
  txt: { name: '', value: '', type: 'TXT' },
  pointer: { name, value: 'pay.ggcheckout.app', type: 'CNAME' },
  notes: [
    '✅ Configure apenas o registro CNAME abaixo',
    'Se você usa Cloudflare como DNS, deixe com Proxy desligado (DNS only — nuvem cinza)',
    'A validação é automática em até 2 minutos após a propagação do DNS',
    'O SSL será emitido automaticamente pela Cloudflare',
  ],
});
const domain = (id: string, name: string, status: string, createdAt: string) => ({
  id, domain: name, status, type: 'subdomain', provider: 'cloudflare', addedToVercel: false, cfStatus: status === 'verified' ? 'active' : 'pending',
  createdAt, updatedAt: createdAt, deleted: false, dnsInstructions: dnsInstructions(name),
});
export const domains = [
  domain('dom_pay', 'pay.metodoaurora.com.br', 'pending', '2026-11-10T03:41:42.805639+00:00'),
  domain('dom_checkout', 'checkout.clubenorte.com', 'verified', '2026-04-17T19:28:31.359+00:00'),
  domain('dom_old', 'compra.orbitapro.com', 'failed', '2026-09-02T12:10:00.000+00:00'),
];
/** list_custom_domains answers each domain without its instructions. */
export const domainList = { domains: domains.map(({ dnsInstructions: _, ...d }) => d), total: domains.length, limit: 5 };
export const verifyPending = {
  success: true, status: 'pending',
  checks: { txt: { valid: true, expected: '' }, pointer: { valid: false, expected: 'pay.ggcheckout.app', type: 'CNAME' } },
  cloudflare: { hostnameStatus: 'pending', sslStatus: 'pending_validation', hostnameActive: false, sslActive: false },
  message: 'Aguardando propagação DNS e validação automática (até 2 min). Verifique se o CNAME está configurado e o proxy desligado (DNS only).',
};

// WhatsApp deliveries of a payment, embedded in it (the masked phone, as the MCP answers it).
export const deliveries = {
  paymentId: 'pay_preview_1', source: 'embedded',
  deliveries: [
    { id: 'dl1', uid: 'dl1', type: 'payment_confirmed', status: 'read', provider: 'waha', messageId: 'wamid.1', recipientPhone: '*********7766', sentAt: '2026-11-10T12:00:04Z', deliveredAt: '2026-11-10T12:00:06Z', readAt: '2026-11-10T12:03:41Z', retryCount: 0 },
    { id: 'dl2', uid: 'dl2', type: 'product_delivery', status: 'delivered', provider: 'waha', messageId: 'wamid.2', recipientPhone: '*********7766', sentAt: '2026-11-10T12:00:09Z', deliveredAt: '2026-11-10T12:00:12Z', retryCount: 0 },
    { id: 'dl3', uid: 'dl3', type: 'order_bump_file_ob1', status: 'failed', provider: 'waha', recipientPhone: '*********7766', error: 'O arquivo do order bump não pôde ser baixado.', retryCount: 3 },
  ],
  summary: { total: 3, pending: 0, sent: 0, delivered: 1, read: 1, failed: 1, permanentFailure: 0, canResend: true },
};

// Wallets (list_checkout_wallets) and the last day's ranking (get_gateway_fallback_stats).
const walletEntry = (credentialId: string, gateway: string, label: string | null = null, active = true, locked = false) => ({ credentialId, gateway, label, active, locked, favorite: false });
export const wallets = {
  wallets: [
    {
      id: 'w_main', publicId: 'wal_main', name: 'Carteira principal', mode: 'manual', metric: 'reliability',
      pix: [walletEntry('c1', 'efibank', 'Conta PJ', true, true), walletEntry('c2', 'appmax'), walletEntry('c3', 'pushinpay', null, false)],
      card: [walletEntry('c4', 'stripe'), walletEntry('c5', 'pagarme')],
      reorderedAt: null, createdAt: '2026-10-20T14:46:58Z', updatedAt: '2026-10-20T14:56:51Z', checkoutCount: 12, storeCount: 1,
    },
    {
      id: 'w_auto', publicId: 'wal_auto', name: 'Lançamento', mode: 'auto', metric: 'conversion',
      pix: [walletEntry('c6', 'mercadopago', 'Mercado Pago'), walletEntry('c1', 'efibank', 'Conta PJ')],
      card: [], reorderedAt: '2026-11-10T06:00:00Z', createdAt: '2026-10-30T20:22:52Z', updatedAt: '2026-11-10T06:00:00Z', checkoutCount: 3, storeCount: 0,
    },
  ],
};
const rank = (gateway: string, rate: number, sample: number) => ({ gateway, score: rate / 110, sample, rate });
export const gatewayStats = {
  stats: {
    efibank: { success: 412, errors: 6, total: 418, reliability: 98.6 },
    appmax: { success: 61, errors: 19, total: 80, reliability: 76.3 },
    mercadopago: { success: 33, errors: 1, total: 34, reliability: 97.1 },
    stripe: { success: 88, errors: 12, total: 100, reliability: 88 },
  },
  cachedAt: 1794317057192,
  window: { from: '2026-11-09T14:00:00Z', to: '2026-11-10T14:00:00Z', hours: 24 },
  ranking: {
    reliability: [rank('efibank', 98.6, 418), rank('mercadopago', 97.1, 34), rank('appmax', 76.3, 80)],
    conversion: [rank('mercadopago', 74.5, 31), rank('efibank', 68.2, 390)],
    card: [rank('stripe', 88, 100), rank('pagarme', 81.4, 59)],
  },
};

// A product's post-purchase funnel (list_upsells, list_downsells), prices in cents.
export const upsells = {
  upsells: [
    { uid: 'up1', order: 0, status: 'active', chainBehavior: 'continue', title: 'Mentoria em grupo', headline: 'Antes de ir: uma vaga na mentoria', price: 19700, originalPrice: 39700, timerEnabled: true, timerMinutes: 10, upsellProductIds: ['p_m'] },
    { uid: 'up2', order: 1, status: 'active', chainBehavior: 'stop_on_decline', title: 'Kit de templates', headline: null, price: 4700, originalPrice: null, timerEnabled: false, upsellProductIds: ['p_t1', 'p_t2'] },
  ],
};
export const downsells = {
  downsells: [
    { uid: 'dn1', order: 1, status: 'active', chainBehavior: 'stop', title: 'Kit essencial', headline: 'Fica com a versão enxuta', price: 1990, originalPrice: 4700, timerEnabled: true, timerMinutes: 5, downsellProductIds: ['p_t1'] },
  ],
  count: 1,
};

// A members area (get_members_area, list_modules, list_sections, list_lessons). The API's modules are
// the screen's carousels and its sections the screen's modules; durations in seconds.
export const membersArea = {
  area: {
    id: 'ma_aurora', name: 'Método Aurora', enabled: true, productId: 'p_aurora',
    stats: { totalStudents: 1284, activeStudents: 412, avgCompletion: 37.4, totalModules: 3, totalSections: 5, totalLessons: 19 },
  },
};
export const memberCarousels = {
  modules: [
    { id: 'mc1', order: 0, title: 'Comece por aqui', locked: false, dripSettings: null, stats: { totalSections: 2, totalLessons: 7 } },
    { id: 'mc2', order: 1, title: 'Método na prática', locked: false, dripSettings: { enabled: true, daysAfterPurchase: 7, referenceDate: 'purchase' }, stats: { totalSections: 2, totalLessons: 10 } },
    { id: 'mc3', order: 2, title: 'Bônus', locked: true, dripSettings: null, stats: { totalSections: 1, totalLessons: 2 } },
  ],
};
export const memberModules: Record<string, unknown> = {
  mc1: { sections: [
    { id: 'ms1', order: 0, title: 'Boas-vindas', locked: false, dripSettings: null, stats: { totalLessons: 3 } },
    { id: 'ms2', order: 1, title: 'Fundamentos', locked: false, dripSettings: { enabled: true, daysAfterPurchase: 1, referenceDate: 'first_access' }, stats: { totalLessons: 4 } },
  ] },
  mc2: { sections: [
    { id: 'ms3', order: 0, title: 'Rotina da manhã', locked: false, dripSettings: null, stats: { totalLessons: 6 } },
    { id: 'ms4', order: 1, title: 'Revisão semanal', locked: false, dripSettings: null, stats: { totalLessons: 0 } },
  ] },
  mc3: { sections: [{ id: 'ms5', order: 0, title: 'Lives gravadas', locked: true, dripSettings: null, stats: { totalLessons: 2 } }] },
};
export const memberLessons = {
  lessons: [
    { id: 'ml1', order: 0, title: 'Assista antes de tudo', type: 'video', locked: false, duration: 452 },
    { id: 'ml2', order: 1, title: 'Guia de estudos', type: 'pdf', locked: false, duration: 0 },
    { id: 'ml3', order: 2, title: 'Teste rápido de nivelamento', type: 'quiz', locked: true, duration: 0 },
  ],
};

// Telegram flows (list_telegram_flows, get_telegram_flow), shaped as QA's on 2026-11-10: a visual flow
// branching on a buttons menu, and a basic one whose remarketing loops back up the column.
export const telegramFlows = {
  flows: [
    { id: 'tf_visual', botId: 'bot1', mode: 'visual', name: 'Menu de compra', nodeCount: 12, published: true },
    { id: 'tf_basic', botId: 'bot1', mode: 'basic', name: 'PIX ou cartão', nodeCount: 15, published: false },
  ],
};
const node = (id: string, type: string, x: number, y: number, data: Record<string, unknown> = {}) => ({ id, type, position: { x, y }, data });
const edge = (source: string, target: string, sourceHandle = 'default') => ({ id: `${source}-${target}-${sourceHandle}`, source, target, sourceHandle });
export const telegramFlowVisual = {
  flow: {
    id: 'tf_visual', name: 'Menu de compra', mode: 'visual', published: true, hasUnpublishedChanges: true,
    nodes: [
      node('n_start', 'trigger_start', 0, 0, { command: '/start' }),
      node('n_welcome', 'send_text', 0, 130, { text: '<b>Olá!</b> 👋 Que bom te ver por aqui. Escolha como quer seguir:' }),
      node('n_menu', 'ask_buttons', 0, 260, { prompt: 'O que você quer fazer?', options: [{ label: 'Grupo VIP' }, { label: 'Cartão' }, { label: 'PIX' }] }),
      node('n_lead', 'create_lead', -380, 420, { status: 'lead' }),
      node('n_tag', 'tag_user', -380, 550, { tags: ['vip-teste'] }),
      node('n_group', 'deliver_group', -380, 680, { message: '🎟️ Seu convite para o grupo VIP:' }),
      node('n_card', 'card_payment', 0, 420, { checkoutId: '1d27f362-e183-488c-87f3-b507044b9adf' }),
      node('n_email', 'ask_text', 380, 420, { prompt: 'Qual é o seu e-mail?', variableName: 'email' }),
      node('n_pix', 'pix_payment', 380, 550, { checkoutId: '1d27f362-e183-488c-87f3-b507044b9adf' }),
      node('n_ok', 'send_text', 190, 720, { text: '✅ Pagamento aprovado!' }),
      node('n_deliver', 'deliver_product', 190, 850, { message: 'Aqui está o seu produto:' }),
      node('n_expired', 'send_text', 520, 720, { text: '⏳ O pagamento expirou. Mande /start para tentar de novo.' }),
    ],
    edges: [
      edge('n_start', 'n_welcome'), edge('n_welcome', 'n_menu'),
      edge('n_menu', 'n_lead', 'option_0'), edge('n_lead', 'n_tag'), edge('n_tag', 'n_group'),
      edge('n_menu', 'n_card', 'option_1'), edge('n_card', 'n_ok', 'approved'), edge('n_card', 'n_expired', 'expired'),
      edge('n_menu', 'n_email', 'option_2'), edge('n_email', 'n_pix'), edge('n_pix', 'n_ok', 'approved'), edge('n_pix', 'n_expired', 'expired'),
      edge('n_ok', 'n_deliver'),
    ],
  },
};
const pay = { checkoutId: '1d27f362-e183-488c-87f3-b507044b9adf' };
export const telegramFlowBasic = {
  flow: {
    id: 'tf_basic', name: 'PIX ou cartão', mode: 'basic', published: false, hasUnpublishedChanges: false,
    nodes: [
      node('b1', 'trigger_start', 300, 50, { command: '/start' }),
      node('b2', 'send_typing', 300, 170, { duration: 3 }),
      node('b3', 'send_text', 300, 290, { text: '👋 Olá! Bem-vindo(a)!\n\nVou te ajudar a encontrar a solução perfeita para você.' }),
      node('b4', 'ask_buttons', 300, 410, { prompt: 'Como você prefere pagar?', options: [{ label: '💠 PIX' }, { label: '💳 Cartão' }] }),
      node('b5', 'pix_payment', 300, 530, pay),
      node('b6', 'send_text', 300, 650, { text: '✅ Pagamento aprovado! Obrigado pela compra.' }),
      node('b7', 'send_text', 300, 770, { text: '😔 Vi que não foi possível concluir... Preparei uma condição especial só para você:' }),
      node('b8', 'delay', 300, 890, { seconds: 900 }),
      node('b9', 'send_text', 300, 1010, { text: '⏳ Não esqueça! Sua oferta exclusiva ainda está ativa.' }),
      node('b10', 'pix_payment', 300, 1130, pay),
      node('b11', 'delay', 300, 1250, { seconds: 3600 }),
      node('b12', 'send_text', 300, 1370, { text: '🔥 Últimas horas! Depois disso, o preço volta ao normal.' }),
      node('b13', 'pix_payment', 300, 1490, pay),
      node('b14', 'card_payment', 300, 1610, pay),
      node('b15', 'send_text', 300, 1730, { text: '✅ Pagamento aprovado! Obrigado pela compra.' }),
    ],
    edges: [
      edge('b1', 'b2'), edge('b2', 'b3'), edge('b3', 'b4'), edge('b4', 'b5', 'option_0'), edge('b5', 'b6', 'approved'), edge('b5', 'b7', 'expired'),
      edge('b7', 'b8'), edge('b8', 'b9'), edge('b9', 'b10'), edge('b10', 'b6', 'approved'), edge('b10', 'b11', 'expired'),
      edge('b11', 'b12'), edge('b12', 'b13'), edge('b13', 'b6', 'approved'), edge('b13', 'b8', 'expired'),
      edge('b4', 'b14', 'option_1'), edge('b14', 'b15', 'approved'),
    ],
  },
};

// WhatsApp chips (list_whatsapp_numbers, get_whatsapp_number, get_pairing_code), as the server sends
// them: the phone masked and no QR.
export const chips = {
  numbers: [
    { uid: 'chip_suporte', provider: 'waha', displayName: 'Suporte', status: 'authenticated', phoneNumber: '*********4321', isActive: true, groupsCount: 2 },
    { uid: 'chip_vendas', provider: 'waha', displayName: 'Vendas 2', status: 'pending', phoneNumber: '*********8877', isActive: true, groupsCount: 1 },
    { uid: 'chip_oficial', provider: 'meta', displayName: 'Oficial GG', status: 'authenticated', phoneNumber: '*******0000', isActive: true, groupsCount: 0 },
    { uid: 'chip_reserva', provider: 'waha', displayName: 'Reserva', status: 'disconnected', phoneNumber: '*********2222', isActive: true, groupsCount: 0 },
    { uid: 'chip_antigo', provider: 'waha', displayName: '', status: 'banned', phoneNumber: '*********1111', isActive: false, groupsCount: 0 },
  ],
};
export const chipDetail = (id: string, status?: string) => {
  const base = chips.numbers.find((c) => c.uid === id) ?? chips.numbers[1];
  const usedBy = base.uid === 'chip_suporte'
    ? [{ groupId: 'g1', name: 'Método Aurora', role: 'primary' }, { groupId: 'g2', name: 'Mentoria', role: 'fallback' }]
    : base.uid === 'chip_vendas' ? [{ groupId: 'g1', name: 'Método Aurora', role: 'fallback' }] : [];
  const { groupsCount: _count, ...rest } = base;
  return { number: { ...rest, status: status ?? base.status, usedBy } };
};
