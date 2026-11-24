import type { InboxMessage, InboxPage } from './whatsapp-inbox.js';

/**
 * The WhatsApp agent routes of the saas (`/api/whatsapp/agent/**`), called with the restricted
 * `ggck_agent_` key. The request shapes are the saas contract; the responses reach the model as the
 * saas sends them, so only the fields the tools describe are named here.
 */

export const AGENT_LIMITS = {
  pendingPage: 50,
  messagesPage: 100,
  replyMaxChars: 4096,
  holdReasonMaxChars: 500,
} as const;

/** A conversation waiting for an answer: not held by the seller, no SAIR, no opt-out. */
export interface AgentPendingConversation {
  contactKey: string;
  name: string | null;
  pendingSince: string;
  lastText: string | null;
  /** Agent replies in this conversation in the last 24 h (the cap is 10). */
  agentRepliesToday: number;
}

export interface AgentPendingPage {
  items: AgentPendingConversation[];
}

/** Who wrote an outgoing message; null on incoming ones and on messages older than the agent. */
export type AgentMessageAuthor = 'agent' | 'seller' | 'auto' | null;

export interface AgentMessage extends InboxMessage {
  by?: AgentMessageAuthor;
}

export type AgentMessagesPage = InboxPage<AgentMessage>;

export interface AgentPendingQuery {
  limit?: number;
}

export interface AgentMessagesQuery {
  limit?: number;
  before?: string;
}

export interface AgentReplyInput {
  text: string;
  /** Deterministic per answered message, so a rerun of the agent never sends the same reply twice. */
  clientMessageId: string;
}

/** A saas answer the tools pass on unchanged (purchases, offers, links, the sent reply). */
export type AgentResponse = Record<string, unknown>;
