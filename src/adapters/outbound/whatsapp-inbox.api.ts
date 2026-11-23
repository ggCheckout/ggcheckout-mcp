import type { WhatsAppInboxPort } from '../../core/ports/whatsapp-inbox.port.js';
import type {
  FunnelRun, InboxConversation, InboxConversationsQuery, InboxMessage, InboxMessagesQuery, InboxOptOutResult, InboxPage,
  InboxReplyInput, InboxReplyMessage, InboxSettings, StartRunResult,
} from '../../core/types/whatsapp-inbox.js';
import type { HttpClient } from './http-client.js';
import { guarded } from './whatsapp-guard.js';

const seg = encodeURIComponent;
const BASE = '/api/whatsapp/inbox';

const conversation = (contactKey: string) => `${BASE}/conversations/${seg(contactKey)}`;

/**
 * The seller's WhatsApp inbox (`/api/whatsapp/inbox`). With an API key every route but the settings
 * read needs the store's "Permitir acesso pelo MCP" (403 INBOX_API_ACCESS_DISABLED while it is off,
 * 403 INBOX_TERMS_REQUIRED without the accepted term). The settings `PUT`, the terms and the test
 * message stay session-only, so none of them is here.
 */
export class WhatsAppInboxApiAdapter implements WhatsAppInboxPort {
  constructor(private readonly http: HttpClient) {}

  getSettings(): Promise<InboxSettings> {
    return guarded(() => this.http.get<InboxSettings>(`${BASE}/settings`));
  }

  listConversations({ limit, before, includeAutomatic }: InboxConversationsQuery): Promise<InboxPage<InboxConversation>> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    if (before) params.before = before;
    if (includeAutomatic !== undefined) params.includeAutomatic = String(includeAutomatic);
    return guarded(() => this.http.get<InboxPage<InboxConversation>>(`${BASE}/conversations`, params));
  }

  listMessages(contactKey: string, { limit, before }: InboxMessagesQuery): Promise<InboxPage<InboxMessage>> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    if (before) params.before = before;
    return guarded(() => this.http.get<InboxPage<InboxMessage>>(`${conversation(contactKey)}/messages`, params));
  }

  async sendReply(contactKey: string, { text, clientMessageId, chipId }: InboxReplyInput): Promise<InboxReplyMessage> {
    const res = await guarded(() => this.http.post<{ message: InboxReplyMessage }>(
      `${conversation(contactKey)}/messages`,
      { text, clientMessageId, ...(chipId ? { chipId } : {}) },
    ));
    return res.message;
  }

  markRead(contactKey: string): Promise<unknown> {
    return guarded(() => this.http.post(`${conversation(contactKey)}/read`));
  }

  async getContactRun(contactKey: string): Promise<FunnelRun | null> {
    const res = await guarded(() => this.http.get<{ run: FunnelRun | null }>(`${conversation(contactKey)}/funnel`));
    return res.run;
  }

  startRun(contactKey: string, funnelId: string, variables?: Record<string, string>): Promise<StartRunResult> {
    return guarded(() => this.http.post<StartRunResult>(
      `${conversation(contactKey)}/funnel`,
      { funnelId, ...(variables ? { variables } : {}) },
    ));
  }

  stopRun(contactKey: string): Promise<{ stoppedRunId: string }> {
    return guarded(() => this.http.delete<{ stoppedRunId: string }>(`${conversation(contactKey)}/funnel`));
  }

  setOptOut(contactKey: string, optedOut: boolean): Promise<InboxOptOutResult> {
    const url = `${conversation(contactKey)}/opt-out`;
    return guarded(() => (optedOut ? this.http.post<InboxOptOutResult>(url) : this.http.delete<InboxOptOutResult>(url)));
  }
}
