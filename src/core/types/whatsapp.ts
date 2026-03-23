export type WhatsAppSessionStatus = 'starting' | 'pending' | 'qr_code' | 'authenticated' | 'disconnected' | 'error';
export type WhatsAppDeliveryStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'permanent_failure';
export type PaymentEventType = 'paid' | 'product_delivery' | 'pending' | 'expired' | 'cancelled' | 'refunded' | 'failed' | 'recovery_pix_unpaid' | 'recovery_pix_expired';
export type TemplateSendType = 'text_only' | 'text_with_file' | 'text_with_image';
export type RecoveryTrigger = 'pix_unpaid' | 'pix_expired';

export interface WhatsAppSession {
  uid: string;
  userId: string;
  sessionName: string;
  sessionId: string;
  qrCode?: string;
  status: WhatsAppSessionStatus;
  phoneNumber?: string;
  isActive: boolean;
  assignedProducts?: string[];
  workerUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck?: string;
  errorMessage?: string;
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
  sessionId: string;
  sessionName: string;
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
  sessionId: string;
  eventType: PaymentEventType;
  messageText: string;
  sendType: TemplateSendType;
  attachedProducts?: string[];
  customFileUrl?: string;
  customImageUrl?: string;
  delayMinutes?: number;
  sendToCustomer?: boolean;
  sendToAdmin?: boolean;
  adminPhone?: string;
}

export interface SendMessageInput {
  sessionId: string;
  phone: string;
  message: string;
  type?: 'text' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

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
