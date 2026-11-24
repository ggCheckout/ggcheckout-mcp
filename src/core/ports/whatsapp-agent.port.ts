import type {
  AgentMessagesPage, AgentMessagesQuery, AgentPendingPage, AgentPendingQuery, AgentReplyInput, AgentResponse,
} from '../types/whatsapp-agent.js';

/** The saas routes the `ggck_agent_` key may call. Every purchase route is scoped to the conversation's contact. */
export interface WhatsAppAgentPort {
  listPending(query: AgentPendingQuery): Promise<AgentPendingPage>;
  listMessages(contactKey: string, query: AgentMessagesQuery): Promise<AgentMessagesPage>;
  sendReply(contactKey: string, input: AgentReplyInput): Promise<AgentResponse>;
  hold(contactKey: string, reason: string): Promise<AgentResponse>;
  /** Purchases made with the conversation's phone only. */
  findPurchases(contactKey: string): Promise<AgentResponse>;
  /**
   * Resends the delivery of the paid purchases of `email` to the purchase owner (that e-mail and the
   * purchase's own phone), never to the conversation. The saas answers `{ accepted: true }` whether or not one exists.
   */
  resendDeliveryByEmail(contactKey: string, email: string): Promise<AgentResponse>;
  resendDelivery(contactKey: string, paymentId: string): Promise<AgentResponse>;
  createRecoveryLink(contactKey: string, paymentId: string): Promise<AgentResponse>;
  listOffers(contactKey: string, paymentId: string): Promise<AgentResponse>;
  createOfferLink(contactKey: string, paymentId: string, offerId: string): Promise<AgentResponse>;
}
