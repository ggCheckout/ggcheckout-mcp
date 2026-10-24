import { randomUUID } from 'node:crypto';
import * as logger from '../../shared/logger.js';
import { ApiError, NetworkError } from '../../shared/errors.js';
import { observeVersionHeaders, UPDATE_COMMAND } from '../../shared/update-notice.js';

export const DEFAULT_PAYMENTS_API_URL = 'https://api.ggcheckout.app/v1';
const TIMEOUT_MS = 15_000;
// Creating a charge waits on core's create, which core gives 75s (CHAIN_TIMEOUT_SECS) over a 60s payments
// chain. A shorter client timeout reports a charge that succeeds slowly as "timed out".
const CREATE_TIMEOUT_MS = 90_000;

export interface CreatePixChargeInput {
  wallet: string;
  /** Integer cents, BRL. Minimum 100. */
  amount: number;
  description?: string;
  external_reference?: string;
  metadata?: Record<string, string>;
  buyer: { name: string; email: string; document: string; phone: string };
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
const takenHint = (ref = '…') =>
  ` The charge for this reference already exists: get it with list_payment_intents(external_reference=${ref}). `
  + 'Do not create again with a different reference.';

export class PaymentsApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly version: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    const { protocol, hostname } = new URL(baseUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
    if (protocol !== 'https:' && !(protocol === 'http:' && local)) {
      throw new Error(`GG_PAYMENTS_API_URL must be https (http is only allowed for localhost): ${baseUrl}`);
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  listWallets() {
    return this.request('GET', '/wallets');
  }

  /** `idempotencyKey` is only passed to repeat a call that may have landed; each call gets a fresh one otherwise. */
  createPixCharge(input: CreatePixChargeInput, idempotencyKey: string = randomUUID()) {
    return this.request('POST', '/payment_intents', { body: input, idempotencyKey, timeoutMs: CREATE_TIMEOUT_MS });
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
    opts: { query?: object; body?: object; idempotencyKey?: string; timeoutMs?: number } = {},
  ): Promise<any> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': `ggcheckout-mcp/${this.version}`,
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

    // A repeat of a write that may have landed must reuse the same key, so the errors that leave that
    // open carry it where the model can read it.
    const retryHint = opts.idempotencyKey
      ? ` The charge may have been created: repeat the call with exactly the same arguments and idempotency_key=${opts.idempotencyKey}.`
      : '';
    // The API keys idempotency on path + body, so a repeat that changes any argument is refused. Reading
    // that as a failure and creating again without the key would charge the buyer twice.
    const reusedHint = opts.idempotencyKey
      ? ' The key was already used with different arguments. If the earlier create may have landed, repeat it with exactly '
        + `the original arguments and idempotency_key=${opts.idempotencyKey}, or check list_payment_intents; `
        + 'do not create again without the key.'
      : '';

    logger.info('PAYMENTS_API', `${method} ${path}`);
    let response: Response;
    let text: string;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
      });
      observeVersionHeaders((name) => response.headers.get(name), this.version);
      text = await response.text();
    } catch (err: any) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new NetworkError(
        `Cannot connect to the GG Checkout payments API at ${this.baseUrl}: `
        + (timedOut
          ? 'request timed out'
          // Never `err.message`: a header the fetch refuses (a key with a CR/LF in it) is quoted whole there.
          : `could not reach the API (${err?.cause?.code ?? 'network error'})`)
        + `. Check your network and the GG_PAYMENTS_API_URL setting.${retryHint}`,
        err,
      );
    }

    let body: any;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      const hint = response.status >= 500
        ? retryHint
        : body?.error?.code === 'idempotency_key_reused' ? reusedHint
        // The first request may still hold the lease, and its charge may already exist: wait and repeat.
        : body?.error?.code === 'request_in_progress' ? retryHint
        // Read as "bad reference", it leads to a create with another reference: the double charge it blocks.
        // The API refuses an install below its minimum version; the command must reach the user even if
        // the message the API wrote does not carry it.
        : body?.error?.code === 'mcp_outdated' && !String(body.error.message ?? '').includes(UPDATE_COMMAND)
          ? ` Update ggcheckout-mcp: run \`${UPDATE_COMMAND}\` and restart the MCP client.`
        : body?.error?.code === 'external_reference_taken' ? takenHint((opts.body as { external_reference?: string } | undefined)?.external_reference)
        : '';
      throw this.toError(response, body, hint);
    }
    // Every success of this API has a JSON body. Without one the write may still have landed, so the
    // caller gets the key to repeat it with instead of an empty result.
    if (body === undefined) {
      throw new ApiError(response.status, `The payments API answered ${response.status} with an unreadable body.${retryHint}`);
    }
    return body;
  }

  private toError(response: Response, body: any, hint: string): ApiError {
    const e = body?.error;
    if (!e || typeof e !== 'object') {
      return new ApiError(response.status, `Payments API request failed with status ${response.status}.${hint}`);
    }
    const requestId = e.request_id ?? response.headers.get('request-id');
    const retry = response.headers.get('retry-after');
    const parts = [`${e.type ?? 'error'}/${e.code ?? 'unknown'}: ${e.message ?? 'no message'}`];
    if (e.param) parts.push(`param: ${e.param}`);
    if (requestId) parts.push(`request_id: ${requestId}`);
    if (retry && /^\d+$/.test(retry)) parts.push(`retry after ${retry}s`);
    return new ApiError(response.status, parts.join(' | ') + hint);
  }
}
