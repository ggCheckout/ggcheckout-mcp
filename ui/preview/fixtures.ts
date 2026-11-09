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
