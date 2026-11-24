import type { WhatsAppAgentPort } from '../../core/ports/whatsapp-agent.port.js';
import type {
  AgentMessagesPage, AgentMessagesQuery, AgentPendingPage, AgentPendingQuery, AgentReplyInput, AgentResponse,
} from '../../core/types/whatsapp-agent.js';
import { AppError, AuthenticationError, WhatsAppAgentRefusalError, type AgentRefusalCode } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';
import { guarded } from './whatsapp-guard.js';

const seg = encodeURIComponent;
const BASE = '/api/whatsapp/agent';

const conversation = (contactKey: string) => `${BASE}/conversations/${seg(contactKey)}`;
const purchase = (contactKey: string, paymentId: string) => `${conversation(contactKey)}/purchases/${seg(paymentId)}`;

const REFUSAL_CODES: AgentRefusalCode[] = ['AGENT_HELD', 'AGENT_CONTACT_EXITED', 'AGENT_REPLY_CAP', 'AGENT_ALREADY_OFFERED'];

function translate(error: unknown): unknown {
  // 401 here is the agent key itself: revoked, or the seller turned the assistant off.
  if (error instanceof AuthenticationError) return new WhatsAppAgentRefusalError('AGENT_KEY_REFUSED', 401, error);
  if (error instanceof AppError) {
    // The HTTP client appends the API's `code` in parentheses: "... (AGENT_HELD)" or "... (AGENT_HELD; detail)".
    const code = REFUSAL_CODES.find((c) => new RegExp(`\\(${c}[;)]`).test(error.message));
    if (code) return new WhatsAppAgentRefusalError(code, error.statusCode, error);
  }
  return error;
}

async function agentCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await guarded(call);
  } catch (error) {
    throw translate(error);
  }
}

/**
 * The saas routes of the WhatsApp agent (`/api/whatsapp/agent`), accepted only with a `ggck_agent_`
 * key. A route this deployment does not have reads as "not available yet"; the deliberate refusals
 * (seller took over, SAIR, reply cap, second offer, key revoked) become a typed error whose message
 * tells the model to stop.
 */
export class WhatsAppAgentApiAdapter implements WhatsAppAgentPort {
  constructor(private readonly http: HttpClient) {}

  listPending({ limit }: AgentPendingQuery): Promise<AgentPendingPage> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    return agentCall(() => this.http.get<AgentPendingPage>(`${BASE}/conversations`, params));
  }

  listMessages(contactKey: string, { limit, before }: AgentMessagesQuery): Promise<AgentMessagesPage> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    if (before) params.before = before;
    return agentCall(() => this.http.get<AgentMessagesPage>(`${conversation(contactKey)}/messages`, params));
  }

  sendReply(contactKey: string, { text, clientMessageId }: AgentReplyInput): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${conversation(contactKey)}/reply`, { text, clientMessageId }));
  }

  hold(contactKey: string, reason: string): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${conversation(contactKey)}/hold`, { reason }));
  }

  findPurchases(contactKey: string, email?: string): Promise<AgentResponse> {
    return agentCall(() => this.http.get<AgentResponse>(`${conversation(contactKey)}/purchases`, email ? { email } : undefined));
  }

  resendDelivery(contactKey: string, paymentId: string): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${purchase(contactKey, paymentId)}/resend`));
  }

  createRecoveryLink(contactKey: string, paymentId: string): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${purchase(contactKey, paymentId)}/recovery-link`));
  }

  listOffers(contactKey: string, paymentId: string): Promise<AgentResponse> {
    return agentCall(() => this.http.get<AgentResponse>(`${purchase(contactKey, paymentId)}/offers`));
  }

  createOfferLink(contactKey: string, paymentId: string, offerId: string): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${purchase(contactKey, paymentId)}/offer-link`, { offerId }));
  }
}
