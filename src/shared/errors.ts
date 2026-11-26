export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string, hint?: string) {
    super(`${resource} ${id} not found${hint ? `. ${hint}` : ''}`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', cause?: Error) {
    super(message, 'AUTH_ERROR', 401, cause);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', cause?: Error) {
    super(message, 'RATE_LIMIT', 429, cause);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR', 503, cause);
    this.name = 'NetworkError';
  }
}

/**
 * The request was well formed and the caller is allowed, but the API cannot serve it right now.
 * 503: the rate limiter is failing closed while its backend is degraded, and nothing was changed,
 * so a retry is safe. 502: the service behind the API did not answer, and a write may or may not
 * have landed, so it is checked before being repeated. The message carries the wait whenever the
 * API sends one.
 */
export class TemporarilyUnavailableError extends AppError {
  constructor(statusCode: number, message: string, cause?: Error) {
    super(message, 'TEMPORARILY_UNAVAILABLE', statusCode, cause);
    this.name = 'TemporarilyUnavailableError';
  }
}

export class ApiError extends AppError {
  constructor(statusCode: number, message: string, cause?: Error) {
    super(`API Error (${statusCode}): ${message}`, 'API_ERROR', statusCode, cause);
    this.name = 'ApiError';
  }
}

/**
 * A 403 whose body is not the API's JSON (HTML or empty): the request was stopped at the network
 * edge (Cloudflare WAF) before it reached the API, so it says nothing about the caller's permissions.
 * It is usually transient, which is why the message says to wait and retry before contacting support.
 */
export class EdgeBlockedError extends AppError {
  constructor(cause?: Error) {
    super(
      'Blocked at the network edge (HTTP 403 from the firewall in front of the API, not from the API): this is '
      + 'not a permissions problem and nothing was changed. Wait about 1 minute and retry; if it keeps '
      + 'happening, contact GG Checkout support.',
      'EDGE_BLOCKED',
      403,
      cause,
    );
    this.name = 'EdgeBlockedError';
  }
}

/**
 * The three errors below end with their code in parentheses, like the API's own refusals: the inbox
 * view tells them apart by it (it only sees the tool's text) and shows its own words for each.
 */

/**
 * The route is not in this deployment (a 404 or 405 with no API error body): the feature was not
 * released there yet. Not a refusal and not a crash: the caller says it is unavailable.
 */
export class FeatureUnavailableError extends AppError {
  constructor(cause?: Error, message = 'Ainda não disponível nesta conta: o funil e a caixa de entrada do WhatsApp não existem neste ambiente. (FEATURE_UNAVAILABLE)') {
    super(
      message,
      'FEATURE_UNAVAILABLE',
      404,
      cause,
    );
    this.name = 'FeatureUnavailableError';
  }
}

/**
 * 403 INBOX_API_ACCESS_DISABLED: the store did not turn on "Permitir acesso pelo MCP" in its inbox
 * settings. Only a panel session can turn it on; a key never can.
 */
export class InboxAccessDisabledError extends AppError {
  constructor(cause?: Error) {
    super(
      'O acesso do MCP à caixa de entrada está desligado. Peça ao lojista para ligar "Permitir acesso pelo MCP" '
      + 'nas configurações da caixa de entrada, no painel. (INBOX_API_ACCESS_DISABLED)',
      'INBOX_API_ACCESS_DISABLED',
      403,
      cause,
    );
    this.name = 'InboxAccessDisabledError';
  }
}

/** 403 INBOX_TERMS_REQUIRED: the store has not accepted the inbox term. The MCP never accepts it. */
export class InboxTermsRequiredError extends AppError {
  constructor(cause?: Error) {
    super(
      'A caixa de entrada ainda não tem o termo aceito. O lojista precisa aceitar o termo no painel: '
      + 'o MCP nunca aceita o termo pela loja. (INBOX_TERMS_REQUIRED)',
      'INBOX_TERMS_REQUIRED',
      403,
      cause,
    );
    this.name = 'InboxTermsRequiredError';
  }
}

/**
 * What the agent routes refuse on purpose, read by the model that runs the agent. Each message says
 * what to do next, so a refusal stops the agent instead of making it retry.
 */
export const AGENT_REFUSALS = {
  AGENT_HELD: 'The seller is handling this conversation (took it over, is answering it, or you handed it over): do not write to this contact again and do not call any other tool for it. Stop here.',
  AGENT_CONTACT_EXITED: 'The contact asked to stop receiving messages (SAIR): do not reply and do not call any other tool for this conversation.',
  AGENT_OPTED_OUT: 'The contact opted out of messages from this store: do not reply and do not call any other tool for this conversation.',
  AGENT_CONVERSATION_NOT_FOUND: 'This conversation no longer exists in the inbox (it expired or was removed): do not reply and do not call any other tool for it.',
  AGENT_GLOBAL_CAP: 'This conversation reached the most replies of the day and was handed to the seller: do not reply again.',
  AGENT_CATEGORY_CAP: 'The store\'s limit of the day for the category of this turn is reached: send nothing more of that kind today, keep helping in the others.',
  AGENT_ALREADY_OFFERED: 'This offer kind was already made in this conversation (the upsell, or the downsell after it): never offer again here, keep to support.',
  AGENT_UPSELL_NOT_OFFERED: 'A downsell comes only after the upsell was offered and refused in this conversation: do not offer again here, keep to support.',
  AGENT_ALREADY_ESCALATED: 'This subject is already with the seller, or the seller handed it back less than 24 hours ago: do not escalate it again and do not repeat that someone will answer; keep helping with anything else, without selling.',
  AGENT_OPEN_PROBLEM: 'A problem of this contact is still open with the seller: no selling until it is solved; keep to support.',
  AGENT_RETENTION_GATE: 'A refund goes to the seller only after your retention replies were sent: ask what happened and try to solve it first, then escalate if the contact asks again.',
  AGENT_ASK_EMAIL_FIRST: 'No purchase was found by this phone and you did not ask for the e-mail yet: ask for the e-mail used at checkout before escalating.',
  AGENT_CATALOG_NOT_FOUND: 'This product is not in the catalog the store gave you: send no link for it and offer only what list_catalog lists.',
  AGENT_CATALOG_UNAVAILABLE: 'This product cannot be bought right now (its checkout is not published): do not offer it and do not promise a link.',
  AGENT_TASK_NOT_FOUND:'This scheduled task no longer exists: send nothing.',
  AGENT_TASK_EXPIRED: 'This scheduled task is past its deadline: send nothing.',
  AGENT_DAILY_PROACTIVE_CAP: 'This contact already got a message started by the store today: send nothing for this task.',
  AGENT_REVIEW_FALSE_URGENCY: 'Refused: false urgency ("só hoje", "última chance", "últimas vagas", "hoje" next to a price). Rewrite without it and send again with the same clientMessageId.',
  AGENT_REVIEW_PRICE_ANCHOR: 'Refused: a "de R$ X por R$ Y" or crossed-out price. Never compare prices; rewrite and send again with the same clientMessageId.',
  AGENT_REVIEW_FOREIGN_LINK: 'Refused: a link no tool gave you in this conversation. Use only links from the tools; rewrite and send again with the same clientMessageId.',
  AGENT_REVIEW_REFUND_MENTION: 'Refused: you brought up refund, chargeback, guarantee or giving up to someone who bought. Only the contact brings it up; rewrite and send again with the same clientMessageId.',
  AGENT_REVIEW_SHAPE: 'Refused: the turn is not in the expected shape (at most 3 bubbles, or 2 with audio; audio with no link, at most 450 characters). Rewrite and send again with the same clientMessageId.',
  AGENT_UNAVAILABLE: 'The assistant is not available in this environment (it runs only on the QA environment for now): stop now and do not try any other tool.',
  AGENT_KEY_REFUSED: 'The agent key was refused: the seller turned the assistant off or revoked the key. Stop now and call no other tool.',
} as const;

export type AgentRefusalCode = keyof typeof AGENT_REFUSALS;

export class WhatsAppAgentRefusalError extends AppError {
  /**
   * `also`: the other refusals of the same answer (the saas review names every check that failed),
   * each with its own instruction, so the model fixes them all in one rewrite.
   */
  constructor(code: AgentRefusalCode, statusCode: number | undefined, cause?: Error, also: AgentRefusalCode[] = []) {
    const codes = [code, ...also.filter((other) => other !== code)];
    super(codes.map((each) => `${AGENT_REFUSALS[each]} (${each})`).join(' '), code, statusCode, cause);
    this.name = 'WhatsAppAgentRefusalError';
  }
}
