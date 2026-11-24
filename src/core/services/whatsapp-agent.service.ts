import type { WhatsAppAgentPort } from '../ports/whatsapp-agent.port.js';
import type { AgentMessagesQuery, AgentPendingQuery, AgentReplyInput } from '../types/whatsapp-agent.js';

/**
 * What the agent may do in the seller's inbox. The rules (cap, hold, one offer, contact scope) are
 * enforced by the saas and the core; this service only routes the calls.
 */
export class WhatsAppAgentService {
  constructor(private readonly port: WhatsAppAgentPort) {}

  async listPending(query: AgentPendingQuery) { return this.port.listPending(query); }
  async readConversation(contactKey: string, query: AgentMessagesQuery) { return this.port.listMessages(contactKey, query); }
  async sendReply(contactKey: string, input: AgentReplyInput) { return this.port.sendReply(contactKey, input); }
  async hold(contactKey: string, reason: string) { return this.port.hold(contactKey, reason); }
  async findPurchases(contactKey: string) { return this.port.findPurchases(contactKey); }
  async resendDeliveryByEmail(contactKey: string, email: string) { return this.port.resendDeliveryByEmail(contactKey, email); }
  async resendDelivery(contactKey: string, paymentId: string) { return this.port.resendDelivery(contactKey, paymentId); }
  async createRecoveryLink(contactKey: string, paymentId: string) { return this.port.createRecoveryLink(contactKey, paymentId); }
  async listOffers(contactKey: string, paymentId: string) { return this.port.listOffers(contactKey, paymentId); }
  async createOfferLink(contactKey: string, paymentId: string, offerId: string) {
    return this.port.createOfferLink(contactKey, paymentId, offerId);
  }
}
