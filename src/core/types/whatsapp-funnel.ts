/**
 * The WhatsApp funnel as the saas routes `/api/whatsapp/funnels/**` speak it (saas
 * `lib/whatsapp/funnels-schema.ts`): up to 5 messages with a wait between them, sent to one contact,
 * by a trigger (the abandoned cart, an unpaid PIX, a refused card) or by hand from the inbox.
 */

export const FUNNEL_TRIGGERS = ['abandoned_cart', 'pix_unpaid', 'pix_expired', 'card_refused', 'card_cancelled', 'manual'] as const;
export type FunnelTrigger = (typeof FUNNEL_TRIGGERS)[number];

/** Caps of the saas schema; text is counted in code points, as the core does. */
export const FUNNEL_LIMITS = {
  maxSteps: 5,
  minWaitMinutes: 15,
  maxWaitMinutes: 2 * 24 * 60,
  maxText: 4096,
  maxName: 80,
  maxSignature: 60,
  maxCoupon: 30,
  listMax: 50,
  importBatch: 500,
  maxImportName: 1024,
  maxVariables: 32,
  maxVariableValue: 1024,
  layoutEntries: 16,
  layoutBound: 10_000,
} as const;

export interface FunnelSendWindow {
  start: number;
  end: number;
}

export interface FunnelStep {
  waitMinutes: number;
  text: string;
  markSeen: boolean;
  showTyping: boolean;
}

export type FunnelLayout = Record<string, { x: number; y: number }>;

/** The body of a create or a replace: the whole funnel. */
export interface FunnelInput {
  name: string;
  trigger: FunnelTrigger;
  /** Only the manual funnel has a session; an automatic one sends by the session of each product. */
  sessionGroupId?: string;
  stopOnReply: boolean;
  sendWindow: FunnelSendWindow | null;
  signature: string;
  coupon: string;
  useEmoji: boolean;
  steps: FunnelStep[];
  layout?: FunnelLayout | null;
}

export interface WhatsAppFunnel extends Omit<FunnelInput, 'sessionGroupId'> {
  id: string;
  isEnabled: boolean;
  sessionGroupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppFunnelSummary {
  id: string;
  name: string;
  trigger: FunnelTrigger;
  isEnabled: boolean;
  sessionGroupId?: string | null;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppFunnelList {
  items: WhatsAppFunnelSummary[];
  nextAfter: string | null;
}

export interface FunnelListQuery {
  limit?: number;
  after?: string;
}

export interface FunnelImportContact {
  /** Digits only, country code included, no `+`. */
  phone: string;
  name?: string;
}

export interface FunnelImportResult {
  started: number;
  skippedOptOut: number;
  skippedInvalid: number;
  skippedActive: number;
}
