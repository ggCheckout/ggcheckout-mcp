export type PaymentStatus =
  | 'paid'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'chargeback'
  | 'refounded';

export type FulfillmentStatus =
  | 'pending'
  | 'separating'
  | 'ready'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_attempt'
  | 'returned'
  | 'cancelled';

export interface Payment {
  [key: string]: unknown;
  id: string;
  titleOffer: string;
  delivery: string[];
  productId: string;
  businessId: string;
  ownerId?: string;
  name: string;
  email: string;
  emailFormatted?: string;
  phone?: string | null;
  cpf?: string | null;
  customerIp?: string;
  value: number;
  finalValueInCents?: number;
  currency?: 'BRL' | 'USD';
  productCurrency?: 'BRL' | 'USD';
  originalTotalInCents?: number;
  valueBrl?: number;
  paymentMethod?: string;
  status: PaymentStatus;
  gatewayName?: string;
  isUpsell?: boolean;
  isDownsell?: boolean;
  originalPaymentId?: string;
  orderBumps?: any[];
  couponsCodesApplied?: string[];
  discountsApplied?: Array<{ code: string; value: number; id?: string }>;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  } | null;
  shippingInfo?: {
    option?: 'free' | 'paid';
    label?: string;
    deliveryDays?: string;
    value?: number;
  } | null;
  renewalCount?: number;
  renewedAt?: string;
  previousTxIds?: string[];
  currentTxId?: string;
  expiresAt?: string;
  upsellJourney?: {
    currentIndex: number;
    totalUpsells: number;
    status: 'pending' | 'in_progress' | 'completed';
    startedAt?: string;
    completedAt?: string;
  };
  upsellHistory?: Array<{
    upsellId: string;
    upsellProductId: string;
    action: 'purchased' | 'declined' | 'skipped';
    paymentId?: string;
    amount?: number;
    timestamp: string;
  }>;
  upsellsAccepted?: string[];
  upsellsDeclined?: string[];
  totalUpsellRevenue?: number;
  platformFeeInCents?: number;
  splitTransactionFee?: number;
  billingTransactionFee?: number;
  fixedFee?: number;
  mainProductCents?: number;
  emailedAt?: string;
  emailStatus?: 'sent' | 'queued' | 'failed' | 'error';
  whatsappNotifications?: Record<string, { sent: boolean; sentAt: string }>;
  whatsappDeliveries?: {
    items: Array<{
      id: string;
      type: string;
      status: string;
      sessionId: string;
      recipientPhone: string;
      messageId?: string;
      error?: string;
      retryCount: number;
      sentAt?: string;
      deliveredAt?: string;
      createdAt: string;
      updatedAt: string;
    }>;
    summary: {
      total: number;
      pending: number;
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      canResend: boolean;
    };
  };
  trackProps?: any;
  utmify?: any;
  emailProvider?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface PaymentsListResponse {
  [key: string]: unknown;
  payments: Payment[];
}

export interface PaymentsPaginatedResponse {
  [key: string]: unknown;
  payments: Payment[];
  /** The count, or 0 when the route was told to skip counting. Not a collection total. */
  total: number;
  /** True when the count stopped at its cap: `total` is then a floor (the dashboard shows `N+`). */
  totalCapped?: boolean;
  /** Cursor for the next page, `null` on the last one. Pass it back as `lastCreatedAt`. */
  nextCursor: string | null;
  /**
   * Only ever true on a text search: the scan hit its read cap, so matches may exist beyond what
   * was returned. Never set on an unfiltered page.
   */
  coverageCapped?: boolean;
}

/** Page size of `list_payments` when the caller gives none. */
export const LIST_PAYMENTS_DEFAULT_PAGE_SIZE = 50;
/** The API's hard cap on `pageSize`; an `all` walk reads full pages. */
export const PAYMENTS_MAX_PAGE_SIZE = 100;
/** Pages one `all` call reads before it stops and hands back a cursor (500 payments, about 10 s of waits). */
export const LIST_ALL_MAX_PAGES = 5;
/** Wait between pages of an `all` walk: 24 requests a minute at most, under the API key limit of 30. */
export const LIST_ALL_PAGE_DELAY_MS = 2500;

export interface PaginationOptions {
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  lastCreatedAt?: string;
  status?: string;
  searchTerm?: string;
  countOnly?: boolean;
}

export interface TrackingInfo {
  code: string;
  url?: string;
  carrier: string;
  shippedAt?: string;
  estimatedDelivery?: string;
}

export interface FulfillmentStatusHistory {
  status: FulfillmentStatus;
  timestamp: string;
  note?: string;
  updatedBy?: string;
}

export interface FulfillmentData {
  status: FulfillmentStatus;
  separatedItems?: string[];
  statusHistory: FulfillmentStatusHistory[];
  tracking?: TrackingInfo;
  updatedAt: string;
}

export interface FulfillmentResponse {
  fulfillment: FulfillmentData | null;
  shippingInfo?: {
    option: 'free' | 'paid';
    label: string;
    deliveryDays: string;
    value: number;
  } | null;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  } | null;
}

export interface UpdateFulfillmentInput {
  status: FulfillmentStatus;
  note?: string;
  tracking?: TrackingInfo;
  separatedItems?: string[];
}

export interface PaymentStatusCheckResponse {
  data: {
    status: string;
    error?: string;
    [key: string]: unknown;
  };
}

/** The columns a sale can be grouped by: the UTMs and the two click-source keys of the checkout link. */
export const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'] as const;
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export const ATTRIBUTION_MAX_DAYS = 90;
export const ATTRIBUTION_DEFAULT_DAYS = 7;
export const DEFAULT_ATTRIBUTION_GROUP_BY: AttributionKey[] = ['utm_source', 'utm_campaign', 'utm_content'];

export interface AttributionQuery {
  from?: string;
  to?: string;
  groupBy?: AttributionKey[];
}

/** Aggregated counts and cents, no buyer data. */
export interface AttributionTotals {
  paidCount: number;
  paidGrossCents: number;
  refundedCount: number;
  refundedCents: number;
}

export interface AttributionRow extends AttributionTotals {
  /** One entry per `groupBy` key; `null` is the sales that came without that parameter. */
  keys: Record<string, string | null>;
}

export interface AttributionResponse {
  from: string;
  to: string;
  groupBy: AttributionKey[];
  rows: AttributionRow[];
  totals: AttributionTotals;
  /** The route cut the rows to its limit: narrow the period or group by fewer keys. */
  truncated: boolean;
}

/** What `list_payments` answers for `all: true`: the pages gathered, joined. */
export interface PaymentsListAllResponse {
  payments: Payment[];
  /** The count reported by the first page read. */
  total: number;
  /** Continue with `list_payments` `all: true` and `lastCreatedAt` = this; null once the last page is in. */
  nextCursor: string | null;
  complete: boolean;
  /** Set when the walk stopped early because the API rate-limited it. */
  stoppedBy?: 'rate_limit';
}
