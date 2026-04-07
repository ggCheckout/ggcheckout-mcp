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
  total: number;
  lastCreatedAt: string | null;
}

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
