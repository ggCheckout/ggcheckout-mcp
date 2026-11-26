/**
 * Who messages a buyer at each moment (`GET /api/whatsapp/buyer-messaging`, the "Visão geral" of
 * Recuperar vendas). The saas publishes the shape as `buyer-messaging/overview/v1`
 * (`contracts/upstream/saas-checkout/`); the limits below are its `x-limits`, and a test compares them.
 */
export const BUYER_MESSAGING_LIMITS = {
  dailyCapMin: 1,
  dailyCapMax: 3,
  ownerIdMaxLength: 128,
  ownerNameMaxCodePoints: 80,
  rowCount: 9,
} as const;

/** The rows, always in this order: the two notices, the six recovery moments, the conversation. */
export const NOTICE_MOMENTS = ['pending', 'approved'] as const;
export const RECOVERY_MOMENTS = ['pix_unpaid', 'pix_expired', 'card_refused', 'card_cancelled', 'abandoned_cart', 'purchase_approved'] as const;

export interface NoticeRow {
  lane: 'notices';
  moment: typeof NOTICE_MOMENTS[number];
  /** An enabled template of the notice exists. */
  on: boolean;
}

export interface RecoveryRow {
  lane: 'recovery';
  moment: typeof RECOVERY_MOMENTS[number];
  /** The enabled funnel of this trigger; null: nobody sends a message at this moment. */
  owner: { journeyId: string; name: string } | null;
  /** The owner has an assistant block and the assistant is off: the block is skipped. */
  assistantSkipped: boolean;
}

export interface ConversationRow {
  lane: 'conversation';
  moment: 'buyer_replied';
  owner: 'assistant' | 'team';
}

export interface BuyerMessagingOverview {
  /** The screen to open. */
  url: string;
  /** Recovery or sale messages per person per day; null while the core keeps no limit per person. */
  dailyCap: number | null;
  rows: [NoticeRow, NoticeRow, RecoveryRow, RecoveryRow, RecoveryRow, RecoveryRow, RecoveryRow, RecoveryRow, ConversationRow];
}
