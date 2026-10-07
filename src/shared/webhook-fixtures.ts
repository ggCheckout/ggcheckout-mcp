/**
 * The seller webhook vocabulary, and the sample bodies `test_webhook` sends.
 *
 * # Why the list has to be enforced HERE
 *
 * The registration route takes `events` opaquely: it checks only that the array is non-empty and
 * stores whatever strings arrive. Dispatch then asks `events.includes(<event the code built>)`, so
 * a name outside this vocabulary is accepted with 200, stored, and never fires — no error, no log.
 * The dashboard form has its own enum, but that runs in the browser and never sees an API call.
 * So the MCP is the last place that can refuse a dead name before it is persisted.
 *
 * The previous list here (`payment.created`, `payment.paid`, `payment.refunded`, `payment.expired`,
 * `payment.chargeback`) was exactly that failure: `payment.*` is the internal outbox vocabulary
 * between the payments service and the API, not something a seller webhook can subscribe to, and
 * `*.refunded` / `*.chargeback` are deliberately absent upstream because nothing dispatches them.
 */
export const WEBHOOK_EVENTS = [
  'pix.paid',
  'pix.generated',
  'pix.expired',
  'pix.failed',
  'card.paid',
  'card.generated',
  'card.expired',
  'card.failed',
  'card.pending',
  'quiz.completed',
  'quiz.lead_captured',
  'subscription.canceled',
  'subscription.past_due',
  'subscription.renewed',
  'checkout.abandoned',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Subscribable, but nothing dispatches them today — a sweep of the dispatch sites found no
 * emitter. Registering one is legal and silent, so say so instead of letting a caller wait for
 * a delivery that never comes.
 */
export const WEBHOOK_EVENTS_WITHOUT_EMITTER: readonly WebhookEvent[] = [
  'pix.generated',
  'pix.failed',
  'card.pending',
];

/**
 * The events `test_webhook` can simulate. It is a deliberate subset: these sample bodies are
 * built HERE and sent straight from this server to the endpoint under test, so they stand for the
 * payment-shaped payloads only. They are a plausible shape to exercise an endpoint with, not a
 * byte-for-byte copy of what the platform dispatches.
 */
export const TESTABLE_WEBHOOK_EVENTS = [
  'pix.paid',
  'card.paid',
  'pix.expired',
  'card.expired',
] as const;

export type TestableWebhookEvent = (typeof TESTABLE_WEBHOOK_EVENTS)[number];

export type WebhookPayload = {
  event: TestableWebhookEvent;
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
    expiredAt?: string;
  };
  product: {
    id: string;
    title: string;
  };
};

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

export const webhookFixtures: Record<TestableWebhookEvent, WebhookPayload> = {
  'pix.paid': {
    event: 'pix.paid',
    payment: { ...BASE_PAYMENT, status: 'paid', method: 'pix', paidAt: '2026-04-13T12:05:00.000Z' },
    product: BASE_PAYMENT.product,
  },
  'card.paid': {
    event: 'card.paid',
    payment: { ...BASE_PAYMENT, status: 'paid', method: 'credit_card', paidAt: '2026-04-13T12:05:00.000Z' },
    product: BASE_PAYMENT.product,
  },
  'pix.expired': {
    event: 'pix.expired',
    payment: { ...BASE_PAYMENT, status: 'expired', method: 'pix', expiredAt: '2026-04-13T12:30:00.000Z' },
    product: BASE_PAYMENT.product,
  },
  'card.expired': {
    event: 'card.expired',
    payment: { ...BASE_PAYMENT, status: 'expired', method: 'credit_card', expiredAt: '2026-04-13T12:30:00.000Z' },
    product: BASE_PAYMENT.product,
  },
};
