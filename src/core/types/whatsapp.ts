export type WhatsAppNumberStatus = 'starting' | 'pending' | 'qr_code' | 'authenticated' | 'disconnected' | 'banned' | 'error';
export type WhatsAppDeliveryStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'permanent_failure';
export const PAYMENT_EVENT_TYPES = [
  'paid', 'product_delivery', 'pending', 'expired', 'cancelled', 'refunded', 'failed',
  'recovery_pix_unpaid', 'recovery_pix_expired', 'recovery_abandoned_cart', 'recovery_card_refused', 'recovery_card_cancelled',
  'upsell_paid', 'upsell_pending', 'upsell_failed', 'upsell_product_delivery',
  'downsell_paid', 'downsell_pending', 'downsell_failed', 'downsell_product_delivery',
] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];
export type TemplateSendType = 'text_only' | 'text_with_file' | 'text_with_image';
export type TemplatePaymentMethod = 'pix' | 'credit_card';
export type RecoveryTrigger = 'pix_unpaid' | 'pix_expired';

/**
 * A chip: one connected WhatsApp number. `waha` connects by QR code or pairing code; `meta` is the
 * official Cloud API, connected with the seller's own credentials (in the dashboard only).
 */
export interface WhatsAppNumber {
  uid: string;
  provider: 'waha' | 'meta';
  displayName?: string;
  status: WhatsAppNumberStatus;
  /** Masked by the server. */
  phoneNumber?: string | null;
  isActive: boolean;
  /** The public side of a Meta chip; its token and secret never leave the server. */
  meta?: { wabaId?: string; phoneNumberId?: string; businessVerified?: boolean; qualityRating?: string; messagingTier?: string };
  /** How many sessions use the chip (list only). */
  groupsCount?: number;
  /** The sessions that use the chip and its role in each (get only). */
  usedBy?: Array<{ groupId: string; name: string; role: 'primary' | 'fallback' }>;
  connectedAt?: string;
  disconnectedAt?: string;
  bannedAt?: string;
  lastHealthCheck?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A session as the dashboard calls it (`whatsappSessionGroups`): the chips that send for a set of
 * products. The primary chip sends first; up to two fallbacks take over, in order. Its `uid` is the
 * id templates keep in `sessionIds`.
 */
export interface WhatsAppSessionGroup {
  uid: string;
  name: string;
  primaryNumberId: string;
  fallbackNumberIds: string[];
  assignedProducts: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppDelivery {
  uid: string;
  productDeliveryId: string;
  paymentId: string;
  recipientPhone: string;
  recipientName?: string;
  sessionId: string;
  sessionName?: string;
  messageId?: string;
  status: WhatsAppDeliveryStatus;
  message?: string;
  messageType?: string;
  deliverableType: string;
  deliverableUrl?: string;
  deliverableFileName?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppDeliverySummary {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  permanentFailure: number;
  canResend: boolean;
}

export interface WhatsAppMessageTemplate {
  uid: string;
  userId: string;
  /** The sessions (group ids) it sends for. */
  sessionIds: string[];
  eventType: PaymentEventType;
  isEnabled: boolean;
  messageText: string;
  sendType: TemplateSendType;
  attachedProducts: string[];
  customFileUrl?: string;
  customImageUrl?: string;
  delayMinutes?: number;
  sendToCustomer: boolean;
  sendToAdmin: boolean;
  adminPhone?: string;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface CreateTemplateInput {
  /** The sessions (group ids) the template sends for; empty leaves it unlinked, and it never fires. */
  sessionIds: string[];
  eventType: PaymentEventType;
  messageText: string;
  sendType: TemplateSendType;
  attachedProducts?: string[];
  customFileUrl?: string;
  customImageUrl?: string;
  delayMinutes?: number;
  /** Sending window, in Brasília hours (0 to 23). */
  allowedHoursStart?: number;
  allowedHoursEnd?: number;
  sendToCustomer?: boolean;
  sendToAdmin?: boolean;
  adminPhone?: string;
  /** Only for these payment methods; absent or empty means all. */
  paymentMethods?: TemplatePaymentMethod[];
}

export type UpdateTemplateInput = Partial<CreateTemplateInput> & { isEnabled?: boolean };

export interface WhatsAppRecoveryConfig {
  uid: string;
  userId: string;
  sessionId: string;
  sessionName: string;
  trigger: RecoveryTrigger;
  isEnabled: boolean;
  steps: Array<{
    id: string;
    order: number;
    delayMinutes: number;
    messageText: string;
    isEnabled: boolean;
  }>;
  allowedHoursStart: number;
  allowedHoursEnd: number;
  maxMessagesPerLead: number;
  createdAt: string;
  updatedAt: string;
}
