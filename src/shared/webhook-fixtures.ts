export const WEBHOOK_EVENTS = [
  'payment.created',
  'payment.paid',
  'payment.refunded',
  'payment.expired',
  'payment.chargeback',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookPayload = {
  event: WebhookEvent;
  payment: {
    id: string;
    status: string;
    method: string;
    amount: number;
    customer: {
      name: string;
      email: string;
      document: string;
      phone: string;
    };
    product: {
      id: string;
      title: string;
    };
    createdAt: string;
    paidAt?: string;
    refundedAt?: string;
    expiredAt?: string;
  };
  product: {
    id: string;
    title: string;
  };
}

const BASE_PAYMENT = {
  id: 'pay_test_abc123',
  amount: 9900,
  customer: {
    name: 'João Silva (test)',
    email: 'joao.test@example.com',
    document: '123.456.789-00',
    phone: '5511999999999',
  },
  product: {
    id: 'prod_test_xyz789',
    title: 'Meu Produto (test)',
  },
  createdAt: '2026-04-13T12:00:00.000Z',
};

export const webhookFixtures: Record<WebhookEvent, WebhookPayload> = {
  'payment.created': {
    event: 'payment.created',
    payment: { ...BASE_PAYMENT, status: 'pending', method: 'pix' },
    product: BASE_PAYMENT.product,
  },
  'payment.paid': {
    event: 'payment.paid',
    payment: { ...BASE_PAYMENT, status: 'paid', method: 'pix.paid', paidAt: '2026-04-13T12:05:00.000Z' },
    product: BASE_PAYMENT.product,
  },
  'payment.refunded': {
    event: 'payment.refunded',
    payment: { ...BASE_PAYMENT, status: 'refunded', method: 'pix.paid', paidAt: '2026-04-13T12:05:00.000Z', refundedAt: '2026-04-13T13:00:00.000Z' },
    product: BASE_PAYMENT.product,
  },
  'payment.expired': {
    event: 'payment.expired',
    payment: { ...BASE_PAYMENT, status: 'expired', method: 'pix', expiredAt: '2026-04-13T12:30:00.000Z' },
    product: BASE_PAYMENT.product,
  },
  'payment.chargeback': {
    event: 'payment.chargeback',
    payment: { ...BASE_PAYMENT, status: 'chargeback', method: 'card.paid', paidAt: '2026-04-13T12:05:00.000Z' },
    product: BASE_PAYMENT.product,
  },
};
