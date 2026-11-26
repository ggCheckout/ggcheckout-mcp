import type { InboxMessage, InboxPage } from './whatsapp-inbox.js';

/**
 * The WhatsApp agent routes of the saas (`/api/whatsapp/agent/**`), called with the restricted
 * `ggck_agent_` key. The saas passes the core's bodies on unchanged where the core's
 * `whatsapp-agent/v2` contract has them (the thread, the reply, the escalation, the state); the
 * limits below are that contract's (`contracts/upstream/ggcheckout-core/whatsapp-agent/v2`), and a
 * test compares them with its `x-limits`.
 */
export const AGENT_LIMITS = {
  bubblesMin: 1,
  bubblesMax: 3,
  bubbleMaxChars: 4096,
  privateNoteMaxChars: 300,
  escalationSummaryMaxChars: 500,
} as const;

/**
 * The categories the model declares on a turn. `recovery` and `access` are never declared: the saas
 * proves them by the link it minted or the tool used, and the core refuses them as declared.
 */
export const AGENT_DECLARED_CATEGORIES = ['support', 'retention', 'free', 'sale'] as const;
export type AgentDeclaredCategory = typeof AGENT_DECLARED_CATEGORIES[number];

/** Continue kind first (the assistant keeps answering), then silence kind (an explicit hold). */
export const AGENT_ESCALATION_CODES = [
  'refund', 'double_charge', 'unsolved', 'off_topic', 'unreadable_media', 'legal', 'human_requested',
] as const;
export type AgentEscalationCode = typeof AGENT_ESCALATION_CODES[number];

/** Who wrote an outgoing message; null on incoming ones and on messages older than the agent. */
export type AgentMessageAuthor = 'agent' | 'seller' | 'auto' | null;

export interface AgentMessage extends InboxMessage {
  by?: AgentMessageAuthor;
}

export type AgentMessagesPage = InboxPage<AgentMessage>;

export interface AgentMessagesQuery {
  limit?: number;
  before?: string;
}

/** One turn of the assistant in a conversation. */
export interface AgentReplyInput {
  bubbles: string[];
  /** Deterministic per answered message, so a rerun of the agent never sends the same reply twice. */
  clientMessageId: string;
  category: AgentDeclaredCategory;
  /** One line for the seller, never sent to the contact. */
  privateNote: string | null;
}

/** The message of a scheduled task: its category comes from the task kind, not from the model. */
export type AgentTaskReplyInput = Omit<AgentReplyInput, 'category'>;

export interface AgentEscalationInput {
  code: AgentEscalationCode;
  summary: string;
}

/** A saas answer the tools pass on unchanged (purchases, offers, links, the sent reply). */
export type AgentResponse = Record<string, unknown>;
