import type { WhatsAppAgentPort } from '../../core/ports/whatsapp-agent.port.js';
import type {
  AgentEscalationInput, AgentMessagesPage, AgentMessagesQuery, AgentReplyInput, AgentResponse, AgentTaskReplyInput,
} from '../../core/types/whatsapp-agent.js';
import { AGENT_REFUSALS, AppError, AuthenticationError, WhatsAppAgentRefusalError, type AgentRefusalCode } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';
import { guarded } from './whatsapp-guard.js';

const seg = encodeURIComponent;
const BASE = '/api/whatsapp/agent';
const AGENT_ROUTES_MISSING = 'O assistente de WhatsApp não está disponível neste ambiente: as rotas dele não existem aqui. Pare e não tente outras ferramentas. (FEATURE_UNAVAILABLE)';

const conversation = (contactKey: string) => `${BASE}/conversations/${seg(contactKey)}`;
const purchase = (contactKey: string, paymentId: string) => `${conversation(contactKey)}/purchases/${seg(paymentId)}`;

/** The refusals the API answers with a code; AGENT_KEY_REFUSED is the 401 and has none. */
const REFUSAL_CODES = (Object.keys(AGENT_REFUSALS) as AgentRefusalCode[]).filter((code) => code !== 'AGENT_KEY_REFUSED');
/** The saas review of a turn: one answer can name several of them. */
const REVIEW_PREFIX = 'AGENT_REVIEW_';
const REVIEW_CODES = REFUSAL_CODES.filter((code) => code.startsWith(REVIEW_PREFIX));

function translate(error: unknown): unknown {
  // 401 here is the agent key itself: revoked, or the seller turned the assistant off.
  if (error instanceof AuthenticationError) return new WhatsAppAgentRefusalError('AGENT_KEY_REFUSED', 401, error);
  if (error instanceof AppError) {
    // The HTTP client appends the API's `code` in parentheses: "... (AGENT_HELD)" or "... (AGENT_HELD; detail)".
    const code = REFUSAL_CODES.find((c) => new RegExp(`\\(${c}[;)]`).test(error.message));
    if (code?.startsWith(REVIEW_PREFIX)) {
      // The review lists every check that failed (`codes`, appended after the code): all of them go to the model.
      const also = REVIEW_CODES.filter((c) => c !== code && new RegExp(`\\b${c}\\b`).test(error.message));
      return new WhatsAppAgentRefusalError(code, error.statusCode, error, also);
    }
    if (code) return new WhatsAppAgentRefusalError(code, error.statusCode, error);
  }
  return error;
}

async function agentCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await guarded(call, AGENT_ROUTES_MISSING);
  } catch (error) {
    throw translate(error);
  }
}

/**
 * The saas routes of the WhatsApp agent (`/api/whatsapp/agent`), accepted only with a `ggck_agent_`
 * key. A route this deployment does not have reads as "not available yet"; the deliberate refusals
 * (seller took over, SAIR, caps, gates, offer out of order or repeated, review, task over, key revoked) become a
 * typed error whose message tells the model what to do next.
 */
export class WhatsAppAgentApiAdapter implements WhatsAppAgentPort {
  constructor(private readonly http: HttpClient) {}

  listMessages(contactKey: string, { limit, before }: AgentMessagesQuery): Promise<AgentMessagesPage> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    if (before) params.before = before;
    return agentCall(() => this.http.get<AgentMessagesPage>(`${conversation(contactKey)}/messages`, params));
  }

  readState(contactKey: string): Promise<AgentResponse> {
    return agentCall(() => this.http.get<AgentResponse>(`${conversation(contactKey)}/state`));
  }

  sendReply(contactKey: string, { bubbles, clientMessageId, category, privateNote, audio }: AgentReplyInput): Promise<AgentResponse> {
    // A text-only turn sends no `audio` key: the saas body is strict.
    const body = { bubbles, clientMessageId, category, privateNote, ...(audio === undefined ? {} : { audio }) };
    return agentCall(() => this.http.post<AgentResponse>(`${conversation(contactKey)}/reply`, body));
  }

  sendTaskReply(contactKey: string, taskId: string, { bubbles, clientMessageId, privateNote }: AgentTaskReplyInput): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${conversation(contactKey)}/tasks/${seg(taskId)}/messages`, { bubbles, clientMessageId, privateNote }));
  }

  escalate(contactKey: string, { code, summary }: AgentEscalationInput): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${conversation(contactKey)}/escalate`, { code, summary }));
  }

  findPurchases(contactKey: string): Promise<AgentResponse> {
    return agentCall(() => this.http.get<AgentResponse>(`${conversation(contactKey)}/purchases`));
  }

  sendPurchaseAccess(contactKey: string, paymentId: string): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${purchase(contactKey, paymentId)}/access`));
  }

  resendDeliveryByEmail(contactKey: string, email: string): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${conversation(contactKey)}/resend-by-email`, { email }));
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

  listCatalog(contactKey: string): Promise<AgentResponse> {
    return agentCall(() => this.http.get<AgentResponse>(`${conversation(contactKey)}/catalog`));
  }

  createCatalogLink(contactKey: string, productId: string): Promise<AgentResponse> {
    return agentCall(() => this.http.post<AgentResponse>(`${conversation(contactKey)}/catalog/${seg(productId)}/link`));
  }
}
