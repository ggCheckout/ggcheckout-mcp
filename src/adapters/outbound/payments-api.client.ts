import { randomUUID } from 'node:crypto';
import * as logger from '../../shared/logger.js';
import { ApiError, NetworkError } from '../../shared/errors.js';
import { observeVersionHeaders } from '../../shared/update-notice.js';

export const DEFAULT_PAYMENTS_API_URL = 'https://api.ggcheckout.app/v1';
const TIMEOUT_MS = 15_000;

export interface CreatePixChargeInput {
  wallet: string;
  /** Integer cents, BRL. Minimum 100. */
  amount: number;
  description?: string;
  external_reference?: string;
  metadata?: Record<string, string>;
  buyer: { name: string; email: string; document: string; phone?: string };
}

export interface ListPaymentIntentsInput {
  status?: string;
  external_reference?: string;
  starting_after?: string;
  limit?: number;
}

/**
 * The public payments API (`/v1`, `ggpk_` keys). It is a different API from the one HttpClient talks
 * to: its own host, its own key, and its errors are `{error: {type, code, message, param, request_id}}`.
 */
export class PaymentsApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly version: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  listWallets() {
    return this.request('GET', '/wallets');
  }

  /** `idempotencyKey` is only passed to repeat a call that may have landed; each call gets a fresh one otherwise. */
  createPixCharge(input: CreatePixChargeInput, idempotencyKey: string = randomUUID()) {
    return this.request('POST', '/payment_intents', { body: input, idempotencyKey });
  }

  getPaymentIntent(id: string) {
    return this.request('GET', `/payment_intents/${encodeURIComponent(id)}`);
  }

  listPaymentIntents(input: ListPaymentIntentsInput = {}) {
    return this.request('GET', '/payment_intents', { query: input });
  }

  cancelPaymentIntent(id: string) {
    return this.request('POST', `/payment_intents/${encodeURIComponent(id)}/cancel`);
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    opts: { query?: object; body?: object; idempotencyKey?: string } = {},
  ): Promise<any> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': `ggcheckout-mcp/${this.version}`,
      'X-GG-MCP-Version': this.version,
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

    logger.info('PAYMENTS_API', `${method} ${path}`);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err: any) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new NetworkError(
        `Cannot connect to the GG Checkout payments API at ${this.baseUrl}: `
        + (timedOut
          ? 'request timed out, and a charge may still have been created, so list payment intents by '
            + 'external_reference before repeating it'
          : `could not reach the API (${err?.cause?.code ?? err?.message})`)
        + '. Check your network and the GG_PAYMENTS_API_URL setting.',
        err,
      );
    }

    observeVersionHeaders((name) => response.headers.get(name), this.version);

    const text = await response.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }

    if (!response.ok) throw this.toError(response, body);
    return body;
  }

  private toError(response: Response, body: any): ApiError {
    const e = body?.error;
    if (!e || typeof e !== 'object') {
      return new ApiError(response.status, `Payments API request failed with status ${response.status}`);
    }
    const requestId = e.request_id ?? response.headers.get('request-id');
    const retry = response.headers.get('retry-after');
    const parts = [`${e.type ?? 'error'}/${e.code ?? 'unknown'}: ${e.message ?? 'no message'}`];
    if (e.param) parts.push(`param: ${e.param}`);
    if (requestId) parts.push(`request_id: ${requestId}`);
    if (retry && /^\d+$/.test(retry)) parts.push(`retry after ${retry}s`);
    return new ApiError(response.status, parts.join(' | '));
  }
}
