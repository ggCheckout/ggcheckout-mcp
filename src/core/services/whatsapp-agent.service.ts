import type { WhatsAppAgentPort } from '../ports/whatsapp-agent.port.js';
import type {
  AgentEscalationInput, AgentMessagesPage, AgentMessagesQuery, AgentReplyInput, AgentResponse, AgentTaskReplyInput, AgentTaskSkipReason,
} from '../types/whatsapp-agent.js';

/** What the model reads before it acts: the thread, and the state and store it must follow. */
export interface AgentConversation {
  messages: AgentMessagesPage;
  state: AgentResponse;
}

/**
 * What the agent may do in the seller's inbox. The rules (caps, gates, holds, one offer, contact
 * scope) are enforced by the saas and the core; this service only routes the calls.
 */
export class WhatsAppAgentService {
  constructor(private readonly port: WhatsAppAgentPort) {}

  async readConversation(contactKey: string, query: AgentMessagesQuery): Promise<AgentConversation> {
    const [messages, state] = await Promise.all([this.port.listMessages(contactKey, query), this.port.readState(contactKey)]);
    return { messages, state };
  }

  async sendReply(contactKey: string, input: AgentReplyInput): Promise<AgentResponse> { return await this.port.sendReply(contactKey, input); }
  async sendTaskReply(contactKey: string, taskId: string, input: AgentTaskReplyInput): Promise<AgentResponse> {
    return await this.port.sendTaskReply(contactKey, taskId, input);
  }
  async skipTask(contactKey: string, taskId: string, reason: AgentTaskSkipReason): Promise<AgentResponse> {
    return await this.port.skipTask(contactKey, taskId, reason);
  }
  async escalate(contactKey: string, input: AgentEscalationInput): Promise<AgentResponse> { return await this.port.escalate(contactKey, input); }
  async findPurchases(contactKey: string): Promise<AgentResponse> { return await this.port.findPurchases(contactKey); }
  async sendPurchaseAccess(contactKey: string, paymentId: string): Promise<AgentResponse> {
    return await this.port.sendPurchaseAccess(contactKey, paymentId);
  }
  async resendDeliveryByEmail(contactKey: string, email: string): Promise<AgentResponse> {
    return await this.port.resendDeliveryByEmail(contactKey, email);
  }
  async resendDelivery(contactKey: string, paymentId: string): Promise<AgentResponse> { return await this.port.resendDelivery(contactKey, paymentId); }
  async createRecoveryLink(contactKey: string, paymentId: string): Promise<AgentResponse> {
    return await this.port.createRecoveryLink(contactKey, paymentId);
  }
  async listOffers(contactKey: string, paymentId: string): Promise<AgentResponse> { return await this.port.listOffers(contactKey, paymentId); }
  async createOfferLink(contactKey: string, paymentId: string, offerId: string): Promise<AgentResponse> {
    return await this.port.createOfferLink(contactKey, paymentId, offerId);
  }
  async listCatalog(contactKey: string): Promise<AgentResponse> { return await this.port.listCatalog(contactKey); }
  async createCatalogLink(contactKey: string, productId: string): Promise<AgentResponse> {
    return await this.port.createCatalogLink(contactKey, productId);
  }
}
