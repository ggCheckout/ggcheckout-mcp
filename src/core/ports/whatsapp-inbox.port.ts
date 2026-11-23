import type {
  FunnelRun, InboxConversation, InboxConversationsQuery, InboxMessage, InboxMessagesQuery, InboxOptOutResult, InboxPage,
  InboxReplyInput, InboxReplyMessage, InboxSettings, StartRunResult,
} from '../types/whatsapp-inbox.js';

export interface WhatsAppInboxPort {
  getSettings(): Promise<InboxSettings>;
  listConversations(query: InboxConversationsQuery): Promise<InboxPage<InboxConversation>>;
  listMessages(contactKey: string, query: InboxMessagesQuery): Promise<InboxPage<InboxMessage>>;
  sendReply(contactKey: string, input: InboxReplyInput): Promise<InboxReplyMessage>;
  markRead(contactKey: string): Promise<unknown>;
  /** The contact's funnel run (the running one or the latest); null when there was none. */
  getContactRun(contactKey: string): Promise<FunnelRun | null>;
  startRun(contactKey: string, funnelId: string, variables?: Record<string, string>): Promise<StartRunResult>;
  stopRun(contactKey: string): Promise<{ stoppedRunId: string }>;
  setOptOut(contactKey: string, optedOut: boolean): Promise<InboxOptOutResult>;
}
