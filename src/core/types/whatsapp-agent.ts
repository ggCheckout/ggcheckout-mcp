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
  /** The core stores bubble i under <id>-b<i> and the voice under <id>-audio, inside a 64-char delivery id. */
  turnClientMessageIdMaxChars: 56,
} as const;

/**
 * The voice of a turn, checked by the saas review before it synthesizes the note (spec section 3.2):
 * the model writes text, the saas turns it into the VoiceNote of the core contract. A turn with voice
 * carries at most 2 bubbles.
 */
export const AGENT_VOICE_LIMITS = {
  textMaxChars: 450,
  bubblesMaxWithVoice: 2,
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
  /** What the voice note says, synthesized by the saas and sent before the bubbles; absent for a text-only turn. */
  audio?: string;
}

/** The message of a scheduled task: its category comes from the task kind, not from the model. */
export type AgentTaskReplyInput = Omit<AgentReplyInput, 'category' | 'audio'>;

export interface AgentEscalationInput {
  code: AgentEscalationCode;
  summary: string;
}

/** A saas answer the tools pass on unchanged (purchases, offers, links, the sent reply). */
export type AgentResponse = Record<string, unknown>;
