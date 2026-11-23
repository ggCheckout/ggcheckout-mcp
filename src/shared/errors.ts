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
  constructor(cause?: Error) {
    super(
      'Ainda não disponível nesta conta: o funil e a caixa de entrada do WhatsApp não existem neste ambiente. (FEATURE_UNAVAILABLE)',
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
