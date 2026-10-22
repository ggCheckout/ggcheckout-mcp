import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPaymentsApiTools, registerPaymentsApiToolsFromEnv } from './payments-api.tools.js';
import type { PaymentsApiClient } from '../../outbound/payments-api.client.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const NAMES = ['list_wallets', 'create_pix_charge', 'get_payment_intent', 'list_payment_intents', 'cancel_payment_intent'];

function registered(server: McpServer): Record<string, any> {
  return (server as any)._registeredTools;
}

describe('registerPaymentsApiTools', () => {
  it('registers the five payments API tools', () => {
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, {} as PaymentsApiClient, 'test');
    expect(Object.keys(registered(server)).sort()).toEqual([...NAMES].sort());
  });

  it('says which key mode is active in the create_pix_charge description', () => {
    const desc = (mode: 'live' | 'test') => {
      const server = new McpServer({ name: 't', version: '0' });
      registerPaymentsApiTools(server, {} as PaymentsApiClient, mode);
      return registered(server).create_pix_charge.description as string;
    };
    expect(desc('live')).toMatch(/^THE KEY IN USE IS LIVE/);
    expect(desc('test')).toMatch(/^The key in use is a TEST key/);
  });

  it('steers the model to external_reference and a reused idempotency_key against double charges', () => {
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, {} as PaymentsApiClient, 'test');
    const d: string = registered(server).create_pix_charge.description;
    expect(d).toContain('Always set `external_reference`');
    expect(d).toContain('external_reference_taken');
    expect(d).toContain('reuse the same `idempotency_key`');
  });

  it('only accepts well-formed ids, so an argument cannot pick another route', () => {
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, {} as PaymentsApiClient, 'test');
    const tools = registered(server);
    const id = (tool: string, v: string) => z.object(tools[tool].inputSchema.shape ?? tools[tool].inputSchema).safeParse({ id: v }).success;
    for (const tool of ['get_payment_intent', 'cancel_payment_intent']) {
      expect(id(tool, 'pi_' + 'a'.repeat(24))).toBe(true);
      for (const bad of ['..', 'pi_1', 'pi_' + 'a'.repeat(23), 'pi_' + 'a'.repeat(25), 'pi_../cancel', 'x'.repeat(27)]) {
        expect(id(tool, bad)).toBe(false);
      }
    }
    const wallet = (v: string) =>
      z.object(tools.create_pix_charge.inputSchema.shape ?? tools.create_pix_charge.inputSchema).shape.wallet.safeParse(v).success;
    expect(wallet('wal_8f3kQ2mN7xR4tY9pL6aBcD')).toBe(true);
    expect(wallet('..')).toBe(false);
    expect(wallet('wal_8f3kQ2')).toBe(false);
    expect(wallet('wal_8f3kQ2mN7xR4tY9pL6a/b')).toBe(false);
  });

  it('asks for confirmation before cancel_payment_intent', () => {
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, {} as PaymentsApiClient, 'test');
    expect(registered(server).cancel_payment_intent.description).toContain('Confirm with the user');
  });

  it('describes list_wallets with the fields the API returns', () => {
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, {} as PaymentsApiClient, 'test');
    const d: string = registered(server).list_wallets.description;
    expect(d).toContain('public_id');
    expect(d).toContain('active_pix_count');
  });

  it('maps the flat buyer_* arguments into the API body', async () => {
    const client = { createPixCharge: vi.fn().mockResolvedValue({ id: 'pi_1', livemode: false }) };
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, client as unknown as PaymentsApiClient, 'test');
    const result = await registered(server).create_pix_charge.handler({
      wallet: 'wal_1', amount: 4990, buyer_name: 'Maria', buyer_email: 'm@e.com', buyer_document: '123', buyer_phone: '11987654321',
    }, {});
    expect(client.createPixCharge).toHaveBeenCalledWith({
      wallet: 'wal_1', amount: 4990, description: undefined, external_reference: undefined, metadata: undefined,
      buyer: { name: 'Maria', email: 'm@e.com', document: '123', phone: '11987654321' },
    }, undefined);
    expect(JSON.parse(result.content[0].text).livemode).toBe(false);
  });

  describe('gating on GG_PAYMENTS_API_KEY', () => {
    it('registers nothing without the key, even when the ggck_live_ key is set', () => {
      const server = new McpServer({ name: 't', version: '0' });
      const url = registerPaymentsApiToolsFromEnv(server, { GGCHECKOUT_API_KEY: 'ggck_live_x' }, '0.5.0');
      expect(url).toBeUndefined();
      expect(Object.keys(registered(server))).toEqual([]);
    });

    it('registers with the key, on the default URL, and calls it with that key only', async () => {
      const f = vi.fn().mockResolvedValue(new Response('{"data":[]}', { status: 200 }));
      const server = new McpServer({ name: 't', version: '0' });
      const url = registerPaymentsApiToolsFromEnv(
        server, { GG_PAYMENTS_API_KEY: 'ggpk_test_k', GGCHECKOUT_API_KEY: 'ggck_live_x' }, '0.5.0', f);
      expect(url).toBe('https://api.ggcheckout.app/v1');
      expect(Object.keys(registered(server)).sort()).toEqual([...NAMES].sort());
      await registered(server).list_wallets.handler({}, {});
      expect(String(f.mock.calls[0][0])).toBe('https://api.ggcheckout.app/v1/wallets');
      expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer ggpk_test_k');
    });

    it('refuses an insecure GG_PAYMENTS_API_URL', () => {
      const server = new McpServer({ name: 't', version: '0' });
      expect(() => registerPaymentsApiToolsFromEnv(
        server, { GG_PAYMENTS_API_KEY: 'ggpk_test_k', GG_PAYMENTS_API_URL: 'http://evil.example/v1' }, '0.5.0')).toThrow(/https/);
    });

    it('refuses a key that is not ggpk_live_ / ggpk_test_ (never the ggck_ key)', () => {
      for (const bad of ['k', 'ggck_live_abc']) {
        const server = new McpServer({ name: 't', version: '0' });
        expect(() => registerPaymentsApiToolsFromEnv(server, { GG_PAYMENTS_API_KEY: bad }, '0.5.0')).toThrow(/ggpk_live_ or ggpk_test_/);
        expect(Object.keys(registered(server))).toEqual([]);
      }
    });

    it('honors GG_PAYMENTS_API_URL', () => {
      const server = new McpServer({ name: 't', version: '0' });
      expect(registerPaymentsApiToolsFromEnv(
        server, { GG_PAYMENTS_API_KEY: 'ggpk_test_k', GG_PAYMENTS_API_URL: 'https://stg/v1' }, '0.5.0')).toBe('https://stg/v1');
    });
  });
});
