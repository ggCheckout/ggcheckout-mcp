import axios, { AxiosInstance, AxiosError } from 'axios';
import * as logger from '../../shared/logger.js';
import { observeVersionHeaders } from '../../shared/update-notice.js';
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  TemporarilyUnavailableError,
} from '../../shared/errors.js';

/**
 * A 404 or 405 that carries no API error body is a route this deployment does not have, not a
 * refusal: the API's own 404s say what is missing ("Upsell não encontrado", `not_found`). Without
 * this the two read the same, and a caller hunts for an offer that exists.
 */
export function explainMissingRoute(error: unknown, requirement: string): unknown {
  const routeMissing = error instanceof ApiError
    && (error.statusCode === 404 || error.statusCode === 405)
    && error.message.includes('Request failed with status');
  return routeMissing
    ? new ApiError(error.statusCode ?? 404, `This GG Checkout API has no such route yet: ${requirement}`, error)
    : error;
}

export class HttpClient {
  private client: AxiosInstance;

  /**
   * `version` is the package version; it goes out as `User-Agent: ggcheckout-mcp/<version>` on
   * every call so the API can tell which release is calling. Do not drop or reshape this header:
   * the API's minimum-version check reads it.
   */
  constructor(baseURL: string, apiKey: string, version: string) {
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `ggcheckout-mcp/${version}`,
        // The API answers with X-GG-MCP-Update only when it sees this header.
        'X-GG-MCP-Version': version,
      },
    });

    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${apiKey}`;
      return config;
    });

    const observe = (headers: any) => observeVersionHeaders((name) => headers?.[name], version);

    this.client.interceptors.response.use(
      (response) => {
        observe(response.headers);
        return response;
      },
      (error: AxiosError) => {
        observe(error.response?.headers);
        // No response means the request never reached the API (DNS failure,
        // connection refused, wrong base URL, or timeout). Surface a clear,
        // actionable message instead of failing silently / opaquely.
        if (!error.response) {
          // A timeout is not a refusal: the API may still finish a write it already received.
          const reason = error.code === 'ECONNABORTED'
            ? 'request timed out, and a write may still have been applied, so check before repeating it'
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
        // being down — a down backend surfaces as 502. Neither means the request was rejected on
        // its merits, but only the 503 is known to have changed nothing.
        if (status === 503) {
          throw new TemporarilyUnavailableError(
            503,
            withRetry(
              `${safeMessage} The API is refusing requests while its rate-limit backend is degraded; `
              + 'nothing was changed',
            ),
            error,
          );
        }
        // 502 and 504: the service behind the API failed or did not answer in time. A write may
        // have landed anyway, so the wait the API suggests only applies once the result is checked.
        if (status === 502 || status === 504) {
          const wait = retrySeconds ? ` If it did not, wait ${retrySeconds} seconds before retrying.` : '';
          throw new TemporarilyUnavailableError(
            status,
            `${safeMessage} The API could not get an answer from the service behind it; a write may `
            + `or may not have been applied, so check its result before repeating it.${wait}`,
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

  /**
   * Multipart POST. `postForm` sets the multipart content type: with the instance's JSON default,
   * axios would serialize the form into JSON and the file would never arrive. The bytes pass through
   * the API, which processes images before storing them, so the wait is longer than a JSON call's.
   */
  async postForm<T>(url: string, form: FormData): Promise<T> {
    logger.info('HTTP', `POST ${url} (multipart)`);
    const response = await this.client.postForm<T>(url, form, { timeout: 120_000 });
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
