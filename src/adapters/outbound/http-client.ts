import axios, { AxiosInstance, AxiosError } from 'axios';
import * as logger from '../../shared/logger.js';
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  TemporarilyUnavailableError,
} from '../../shared/errors.js';

export class HttpClient {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${apiKey}`;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // No response means the request never reached the API (DNS failure,
        // connection refused, wrong base URL, or timeout). Surface a clear,
        // actionable message instead of failing silently / opaquely.
        if (!error.response) {
          const reason = error.code === 'ECONNABORTED'
            ? 'request timed out'
            : `could not reach the API (${error.code || error.message})`;
          throw new NetworkError(
            `Cannot connect to GG Checkout API at ${baseURL}: ${reason}. `
            + 'Check your network and the GGCHECKOUT_API_URL setting.',
            error,
          );
        }

        const status = error.response?.status;
        const body = (error.response?.data ?? {}) as any;
        // The API's convention is `error: string` (already human readable, pt-BR), sometimes with
        // `code` as a discriminator and `message`/`details` beside it. Without the extras the
        // caller only saw "Request failed with status 409" and could not act on it.
        const apiMessage = body?.error || body?.message;
        const extras = [body?.code, body?.message !== apiMessage ? body?.message : undefined]
          .filter((v): v is string => typeof v === 'string' && v.length > 0);
        const detail = extras.length ? ` (${extras.join('; ')})` : '';

        // Use API error message when available; fallback to generic message
        // to avoid leaking internal details (URLs, headers, stack traces)
        const safeMessage = (typeof apiMessage === 'string'
          ? apiMessage
          : `Request failed with status ${status || 'unknown'}`) + detail;

        // Seconds to wait. The header is the standard one; in the body the API spells it
        // `retry_after` (snake_case), and that is the only spelling that crosses the wire —
        // a 429 forwarded from the backend carries the body even when the header is dropped.
        const retryHeader = (error.response?.headers as any)?.['retry-after'];
        const retryRaw = [retryHeader, body?.retry_after].find((v) => v !== undefined && v !== null);
        const retrySeconds = retryRaw !== undefined && /^\d+$/.test(String(retryRaw))
          ? Number(retryRaw)
          : undefined;
        const withRetry = (msg: string) => {
          const base = msg.endsWith('.') ? msg.slice(0, -1) : msg;
          return retrySeconds ? `${base}. Retry after ${retrySeconds} seconds.` : `${base}.`;
        };

        if (status === 401) throw new AuthenticationError(safeMessage, error);
        if (status === 429) throw new RateLimitError(withRetry(safeMessage), error);
        // 503 is the rate-limiter failing closed (its backing store is degraded), not the API
        // being down — a down backend surfaces as 502. Both are worth retrying, and neither
        // means the request was rejected on its merits.
        if (status === 503) {
          throw new TemporarilyUnavailableError(
            503,
            withRetry(
              `${safeMessage} The API is refusing requests while its rate-limit backend is degraded; `
              + 'nothing was changed',
            ),
            retrySeconds,
            error,
          );
        }
        if (status === 502) {
          throw new TemporarilyUnavailableError(
            502,
            withRetry(
              `${safeMessage} The API could not reach the service behind it; `
              + 'a write may not have been applied',
            ),
            retrySeconds,
            error,
          );
        }
        throw new ApiError(status || 500, safeMessage, error);
      },
    );
  }

  async get<T>(url: string, params?: Record<string, string>): Promise<T> {
    logger.info('HTTP', `GET ${url}`);
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `POST ${url}`);
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `PATCH ${url}`);
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `PUT ${url}`);
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `DELETE ${url}`);
    const response = await this.client.delete<T>(url, { data });
    return response.data;
  }
}
