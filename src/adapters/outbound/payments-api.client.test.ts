import { describe, it, expect, vi, afterEach } from 'vitest';
import { PaymentsApiClient } from './payments-api.client.js';
import { ApiError, NetworkError } from '../../shared/errors.js';
import { getUpdateNotice, resetUpdateNotice } from '../../shared/update-notice.js';

vi.mock('../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status, headers }));

const client = (fetchMock: unknown, base = 'https://api.test/v1/') =>
  new PaymentsApiClient(base, 'ggpk_test_abc', '0.5.0', fetchMock as typeof fetch);

const charge = {
  wallet: 'wal_1',
  amount: 4990,
  buyer: { name: 'Maria', email: 'm@e.com', document: '123', phone: '11987654321' },
};

afterEach(() => resetUpdateNotice());

describe('PaymentsApiClient', () => {
  it('sends the key, User-Agent and version header; strips the trailing slash from the base', async () => {
    const f = reply(200, { object: 'list', data: [] });
    await client(f).listWallets();
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://api.test/v1/wallets');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer ggpk_test_abc');
    expect(init.headers['User-Agent']).toBe('ggcheckout-mcp/0.5.0');
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });

  it('creates a charge with a fresh UUID Idempotency-Key per call', async () => {
    const f = reply(201, { id: 'pi_1', livemode: false });
    const c = client(f);
    expect(await c.createPixCharge(charge)).toEqual({ id: 'pi_1', livemode: false });
    await c.createPixCharge(charge);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://api.test/v1/payment_intents');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(charge);
    const k1 = init.headers['Idempotency-Key'];
    expect(k1).toMatch(/^[0-9a-f-]{36}$/);
    expect(f.mock.calls[1][1].headers['Idempotency-Key']).not.toBe(k1);
  });

  it('reuses a caller-provided Idempotency-Key', async () => {
    const f = reply(200, {});
    await client(f).createPixCharge(charge, 'order-1');
    expect(f.mock.calls[0][1].headers['Idempotency-Key']).toBe('order-1');
  });

  it('builds the list query without empty values', async () => {
    const f = reply(200, {});
    await client(f).listPaymentIntents({ status: 'succeeded', starting_after: 'c1', limit: 5, external_reference: '' });
    expect(String(f.mock.calls[0][0])).toBe('https://api.test/v1/payment_intents?status=succeeded&starting_after=c1&limit=5');
  });

  it('gets and cancels by id', async () => {
    const f = reply(200, {});
    await client(f).getPaymentIntent('pi_1');
    await client(f).cancelPaymentIntent('pi_1');
    expect(String(f.mock.calls[0][0])).toBe('https://api.test/v1/payment_intents/pi_1');
    expect(String(f.mock.calls[1][0])).toBe('https://api.test/v1/payment_intents/pi_1/cancel');
    expect(f.mock.calls[1][1].method).toBe('POST');
  });

  it('surfaces error code, message, param and request_id', async () => {
    const f = reply(400, {
      error: { type: 'invalid_request', code: 'invalid_buyer_document', message: 'bad doc', param: 'buyer.document', request_id: 'req_9' },
    });
    const err = await client(f).createPixCharge(charge).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('invalid_request/invalid_buyer_document: bad doc');
    expect(err.message).toContain('param: buyer.document');
    expect(err.message).toContain('request_id: req_9');
  });

  it('puts the idempotency key in a network error and in a 5xx so the model can repeat safely', async () => {
    const net = await client(vi.fn().mockRejectedValue(new TypeError('fetch failed'))).createPixCharge(charge, 'k-1').catch((e) => e);
    expect(net.message).toContain('idempotency_key=k-1');
    expect(net.message).toContain('The charge may have been created');
    const f = reply(502, { error: { type: 'gateway', code: 'gateway_unavailable', message: 'down' } });
    const err = await client(f).createPixCharge(charge, 'k-2').catch((e) => e);
    expect(err.message).toContain('gateway/gateway_unavailable');
    expect(err.message).toContain('idempotency_key=k-2');
    const generated = await client(reply(500, {})).createPixCharge(charge).catch((e) => e);
    expect(generated.message).toMatch(/idempotency_key=[0-9a-f-]{36}/);
  });

  it('turns a 2xx with an empty or truncated body into an error that carries the key', async () => {
    for (const text of ['', '{"id":"pi_1",']) {
      const f = vi.fn().mockImplementation(async () => new Response(text, { status: 201 }));
      const err = await client(f).createPixCharge(charge, 'k-5').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toContain('unreadable body');
      expect(err.message).toContain('idempotency_key=k-5');
    }
    const read = await client(vi.fn().mockImplementation(async () => new Response('', { status: 200 }))).listWallets().catch((e) => e);
    expect(read).toBeInstanceOf(ApiError);
    expect(read.message).not.toContain('idempotency_key');
  });

  it('does not put a key in a 4xx or in a read', async () => {
    const bad = await client(reply(409, { error: { type: 'invalid_request', code: 'external_reference_taken', message: 'x' } }))
      .createPixCharge(charge, 'k-3').catch((e) => e);
    expect(bad.message).not.toContain('idempotency_key');
    const read = await client(reply(500, {})).getPaymentIntent('pi_1').catch((e) => e);
    expect(read.message).not.toContain('idempotency_key');
  });

  it('turns a timeout while reading the body into the NetworkError that warns about a charge', async () => {
    const res = { ok: true, status: 200, headers: new Headers(), text: () => Promise.reject(new DOMException('t', 'TimeoutError')) };
    const err = await client(vi.fn().mockResolvedValue(res)).createPixCharge(charge, 'k-4').catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toContain('request timed out');
    expect(err.message).toContain('The charge may have been created');
    expect(err.message).toContain('idempotency_key=k-4');
  });

  it('refuses a non-https base URL, except http on localhost', () => {
    expect(() => client(vi.fn(), 'http://api.example.com/v1')).toThrow(/must be https/);
    expect(() => client(vi.fn(), 'ftp://x')).toThrow(/must be https/);
    expect(() => client(vi.fn(), 'http://localhost:8080/v1')).not.toThrow();
    expect(() => client(vi.fn(), 'http://127.0.0.1:8080/v1')).not.toThrow();
    expect(() => client(vi.fn(), 'https://stg.example.com/v1')).not.toThrow();
  });

  it('adds Retry-After to a 429 and falls back to the Request-Id header', async () => {
    const f = reply(429, { error: { type: 'rate_limit', code: 'rate_limit_exceeded', message: 'slow down' } },
      { 'Retry-After': '7', 'Request-Id': 'req_h' });
    const err = await client(f).listWallets().catch((e) => e);
    expect(err.message).toContain('retry after 7s');
    expect(err.message).toContain('request_id: req_h');
  });

  it('reports a body without the error envelope by status', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    const err = await client(f).listWallets().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toContain('status 502');
  });

  it('maps a network failure and warns that a timed-out write may have landed', async () => {
    const timeout = new DOMException('timeout', 'TimeoutError');
    const err = await client(vi.fn().mockRejectedValue(timeout)).createPixCharge(charge).catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toContain('request timed out');
    expect(err.message).toContain('The charge may have been created');
    const dns = await client(vi.fn().mockRejectedValue(new TypeError('fetch failed'))).listWallets().catch((e) => e);
    expect(dns).toBeInstanceOf(NetworkError);
  });

  it('keeps the update warning from the version headers on a success and on an error', async () => {
    const h = { 'X-GG-MCP-Latest': '0.6.0', 'X-GG-MCP-Update': 'npx -y ggcheckout-mcp@latest' };
    await client(reply(200, {}, h)).listWallets();
    expect(getUpdateNotice()).toContain('0.6.0 is available (running 0.5.0)');
    resetUpdateNotice();
    await client(reply(404, { error: { type: 'invalid_request', code: 'intent_not_found', message: 'x' } }, h))
      .getPaymentIntent('pi_x').catch(() => undefined);
    expect(getUpdateNotice()).toContain('`npx -y ggcheckout-mcp@latest`');
  });

  it('gives no warning when the API only sends X-GG-MCP-Latest', async () => {
    await client(reply(200, {}, { 'X-GG-MCP-Latest': '0.5.0' })).listWallets();
    expect(getUpdateNotice()).toBeUndefined();
  });
});
