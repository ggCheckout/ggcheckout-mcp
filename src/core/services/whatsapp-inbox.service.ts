import type { WhatsAppInboxPort } from '../ports/whatsapp-inbox.port.js';
import {
  INBOX_LIMITS, type InboxConversationsQuery, type InboxMessagesQuery, type InboxReplyInput, type InboxState, type InboxSummary,
} from '../types/whatsapp-inbox.js';
import { FeatureUnavailableError, InboxAccessDisabledError, InboxTermsRequiredError } from '../../shared/errors.js';

/** The counts read at most this many pages of conversations (200): a summary, not an export. */
const SUMMARY_PAGES = 4;

const EMPTY: Omit<InboxSummary, 'available' | 'enabled'> = { conversations: 0, unread: 0 };

export class WhatsAppInboxService {
  constructor(private readonly port: WhatsAppInboxPort) {}

  /**
   * Whether the inbox can be opened and how much is in it, as numbers only: it is all the model is
   * allowed to learn. The settings read says first if the store turned "Permitir acesso pelo MCP"
   * on, so a store that did not never has its conversations asked for.
   */
  async summarize(): Promise<{ summary: InboxSummary; state: InboxState }> {
    try {
      const settings = await this.port.getSettings();
      if (settings.apiAccessEnabled !== true) {
        return { summary: { available: true, enabled: false, ...EMPTY }, state: 'off' };
      }
      let conversations = 0;
      let unread = 0;
      let before: string | undefined;
      for (let page = 0; page < SUMMARY_PAGES; page++) {
        const res = await this.port.listConversations({ limit: INBOX_LIMITS.conversationsPage, ...(before ? { before } : {}) });
        conversations += res.items.length;
        unread += res.items.reduce((sum, c) => sum + (Number.isFinite(c.unread) ? c.unread : 0), 0);
        if (!res.nextBefore) break;
        before = res.nextBefore;
      }
      return { summary: { available: true, enabled: true, conversations, unread }, state: 'ready' };
    } catch (error) {
      if (error instanceof FeatureUnavailableError) {
        return { summary: { available: false, enabled: false, ...EMPTY }, state: 'unavailable' };
      }
      // Turned off between the two reads: the same answer as off.
      if (error instanceof InboxAccessDisabledError) {
        return { summary: { available: true, enabled: false, ...EMPTY }, state: 'off' };
      }
      if (error instanceof InboxTermsRequiredError) {
        return { summary: { available: true, enabled: true, ...EMPTY }, state: 'terms_required' };
      }
      throw error;
    }
  }

  async listConversations(query: InboxConversationsQuery) { return this.port.listConversations(query); }
  async listMessages(contactKey: string, query: InboxMessagesQuery) { return this.port.listMessages(contactKey, query); }
  async sendReply(contactKey: string, input: InboxReplyInput) { return this.port.sendReply(contactKey, input); }
  async markRead(contactKey: string) { await this.port.markRead(contactKey); return { success: true }; }
  async getContactRun(contactKey: string) { return { run: await this.port.getContactRun(contactKey) }; }
  async startRun(contactKey: string, funnelId: string, variables?: Record<string, string>) {
    return this.port.startRun(contactKey, funnelId, variables);
  }
  async stopRun(contactKey: string) { return this.port.stopRun(contactKey); }
  async setOptOut(contactKey: string, optedOut: boolean) { return this.port.setOptOut(contactKey, optedOut); }
}
