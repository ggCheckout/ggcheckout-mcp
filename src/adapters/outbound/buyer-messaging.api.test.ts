import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { BuyerMessagingApiAdapter, buyerMessagingOverview } from './buyer-messaging.api.js';
import type { HttpClient } from './http-client.js';
import { BUYER_MESSAGING_LIMITS, NOTICE_MOMENTS, RECOVERY_MOMENTS } from '../../core/types/buyer-messaging.js';

/** The package the saas publishes, mirrored byte by byte (`src/contracts/upstream-mirror.test.ts` pins it). */
const PACKAGE = fileURLToPath(new URL('../../../contracts/upstream/saas-checkout/buyer-messaging/overview/v1/', import.meta.url));

interface Fixture { def: string; body: unknown }

const fixtures = (kind: 'valid' | 'invalid'): [string, Fixture][] => readdirSync(join(PACKAGE, kind)).sort()
  .map((name): [string, Fixture] => [name, JSON.parse(readFileSync(join(PACKAGE, kind, name), 'utf-8')) as Fixture]);

const schema = JSON.parse(readFileSync(join(PACKAGE, 'schema.json'), 'utf-8'));

const httpAnswering = (body: unknown): HttpClient => ({ get: vi.fn().mockResolvedValue(body) }) as unknown as HttpClient;

describe('buyer messaging overview against the saas contract (buyer-messaging/overview/v1)', () => {
  it.each(fixtures('valid'))('parses the valid fixture %s', (_name, fixture) => {
    expect(fixture.def).toBe('BuyerMessagingOverview');
    expect(buyerMessagingOverview.safeParse(fixture.body).success).toBe(true);
  });

  it.each(fixtures('invalid'))('refuses the invalid fixture %s', (_name, fixture) => {
    expect(buyerMessagingOverview.safeParse(fixture.body).success).toBe(false);
  });

  it('keeps the contract\'s limits and row order', () => {
    expect(BUYER_MESSAGING_LIMITS).toEqual(schema['x-limits']);
    const order = (schema.$defs.BuyerMessagingOverview.properties.rows.prefixItems as { properties?: { moment: { const: string } } }[])
      .slice(0, -1).map((row): string | undefined => row.properties?.moment.const);
    expect(order).toEqual([...NOTICE_MOMENTS, ...RECOVERY_MOMENTS]);
  });
});

describe('BuyerMessagingApiAdapter', () => {
  it('reads GET /api/whatsapp/buyer-messaging and returns the parsed answer', async () => {
    const [, fixture] = fixtures('valid')[0]!;
    const http = httpAnswering(fixture.body);
    await expect(new BuyerMessagingApiAdapter(http).getOverview()).resolves.toEqual(fixture.body);
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/buyer-messaging');
  });

  it('refuses an answer in a shape it does not know, instead of reading it as "nobody messages here"', async () => {
    const [, fixture] = fixtures('invalid').find(([name]) => name === 'overview-without-conversation.json')!;
    await expect(new BuyerMessagingApiAdapter(httpAnswering(fixture.body)).getOverview())
      .rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });
});
