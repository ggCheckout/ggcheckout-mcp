/**
 * The seller's WhatsApp inbox as the saas routes `/api/whatsapp/inbox/**` speak it (saas
 * `types/whatsapp-inbox.ts`, `lib/whatsapp/inbox-params.ts`, `lib/whatsapp/inbox-reply.ts`).
 * Everything here that carries a name, a phone or a message text reaches only the MCP Apps widget,
 * never the model.
 */

export const INBOX_LIMITS = {
  conversationsPage: 50,
  messagesPage: 100,
  replyMaxChars: 4096,
} as const;

export type InboxMessageType = 'text' | 'media' | 'other' | 'reaction';

export interface InboxConversation {
  contactKey: string;
  name: string | null;
  chipId: string;
  openedByChipId: string;
  lastText: string | null;
  lastType: InboxMessageType | null;
  lastAt: string;
  unread: number;
  interacted: boolean;
  chipSwitch?: { fromChipId: string; at: string } | null;
  /** The customer wrote SAIR/PARAR: only a mark, the seller decides. */
  exitRequestedAt?: string | null;
  /** The seller stopped the funnels and the sending to this contact. */
  optedOut?: boolean;
}

export interface InboxMessage {
  id: string;
  messageId: string;
  dir: 'in' | 'out';
  chipId: string;
  type: InboxMessageType;
  text: string | null;
  at: string;
  auto: boolean;
}

export interface InboxPage<T> {
  items: T[];
  nextBefore: string | null;
}

export interface InboxConversationsQuery {
  limit?: number;
  before?: string;
  includeAutomatic?: boolean;
}

export interface InboxMessagesQuery {
  limit?: number;
  before?: string;
}

export interface InboxReplyInput {
  text: string;
  /** One per message, made by the caller and reused when the same message is sent again. */
  clientMessageId: string;
  chipId?: string;
}

export interface InboxReplyMessage {
  messageId: string;
  deliveryId: string;
  contactKey: string;
  chipId: string;
  text: string;
  at: string;
  chipSwitch: { fromChipId: string; at: string } | null;
  /** The same `clientMessageId` sent again: this is the delivery already made. */
  duplicate: boolean;
}

/** `GET /inbox/settings`. `apiAccessEnabled` is absent where the core predates the switch. */
export interface InboxSettings {
  autoSwitchChip: boolean;
  overflowWhenFull?: boolean;
  /** "Permitir acesso pelo MCP": off unless the seller turned it on in the panel. */
  apiAccessEnabled?: boolean;
  updatedAt: string | null;
}

export interface InboxOptOutResult {
  optedOut: boolean;
  stoppedRuns: number;
}

export type FunnelRunStatus = 'running' | 'stopped' | 'done';

export interface FunnelRun {
  id: string;
  funnelId: string;
  funnelName: string;
  contactKey: string;
  status: FunnelRunStatus;
  stopReason: string | null;
  origin: 'trigger' | 'manual';
  /** How many steps already became a delivery. */
  currentStep: number;
  totalSteps: number;
  nextAt: string | null;
  startedAt: string;
  endedAt: string | null;
}

export type StartRunResult =
  | { started: true; run: FunnelRun; replacedRunId: string | null }
  | { started: false; reason: 'opted_out' | 'product_without_session' };

/**
 * What `open_whatsapp_inbox` tells the model, and nothing else: counts over the most recent
 * conversations, never a name, a phone or a text.
 */
export interface InboxSummary {
  /** false: the saas of this account does not have the inbox routes yet. */
  available: boolean;
  /** "Permitir acesso pelo MCP" is on for the store. */
  enabled: boolean;
  conversations: number;
  /** Unread messages across those conversations. */
  unread: number;
}

/** Why the summary reads as it does: how the tool words it, never part of what the model gets as data. */
export type InboxState = 'ready' | 'off' | 'unavailable' | 'terms_required';
