import type {
  AgentEscalationInput, AgentMessagesPage, AgentMessagesQuery, AgentReplyInput, AgentResponse, AgentTaskReplyInput,
} from '../types/whatsapp-agent.js';

/** The saas routes the `ggck_agent_` key may call. Every purchase route is scoped to the conversation's contact. */
export interface WhatsAppAgentPort {
  listMessages(contactKey: string, query: AgentMessagesQuery): Promise<AgentMessagesPage>;
  /** The conversation's state (counters, escalation, holds) and the store's persona and policies. */
  readState(contactKey: string): Promise<AgentResponse>;
  sendReply(contactKey: string, input: AgentReplyInput): Promise<AgentResponse>;
  /** The message of a scheduled task; the task belongs to the run's contact. */
  sendTaskReply(contactKey: string, taskId: string, input: AgentTaskReplyInput): Promise<AgentResponse>;
  escalate(contactKey: string, input: AgentEscalationInput): Promise<AgentResponse>;
  /** Purchases made with the conversation's phone only. */
  findPurchases(contactKey: string): Promise<AgentResponse>;
  /** The access of each paid product of a purchase found by the conversation's phone, to send in this chat. */
  sendPurchaseAccess(contactKey: string, paymentId: string): Promise<AgentResponse>;
  /**
   * Resends the delivery of the paid purchases of `email` to the purchase owner (that e-mail and the
   * purchase's own phone), never to the conversation. The saas answers `{ accepted: true }` whether or not one exists.
   */
  resendDeliveryByEmail(contactKey: string, email: string): Promise<AgentResponse>;
  resendDelivery(contactKey: string, paymentId: string): Promise<AgentResponse>;
  createRecoveryLink(contactKey: string, paymentId: string): Promise<AgentResponse>;
  listOffers(contactKey: string, paymentId: string): Promise<AgentResponse>;
  createOfferLink(contactKey: string, paymentId: string, offerId: string): Promise<AgentResponse>;
  /** The store's catalog for this contact, without what the contact already bought. */
  listCatalog(contactKey: string): Promise<AgentResponse>;
  createCatalogLink(contactKey: string, productId: string): Promise<AgentResponse>;
}
