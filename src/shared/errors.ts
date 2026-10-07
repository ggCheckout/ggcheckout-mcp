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
 * The request was well formed and the caller is allowed, but the API cannot serve it right now:
 * 423 while the seller's account is being moved between storage generations, 503 while the
 * backend is down. Both are worth retrying, which is why they do not come back as a plain
 * ApiError — the message always says how long to wait when the API says so.
 */
export class TemporarilyUnavailableError extends AppError {
  constructor(statusCode: number, message: string, public readonly retryAfterSeconds?: number, cause?: Error) {
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
