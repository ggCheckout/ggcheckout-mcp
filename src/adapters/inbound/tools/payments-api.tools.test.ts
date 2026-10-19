import { describe, it, expect, vi } from 'vitest';
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
    registerPaymentsApiTools(server, {} as PaymentsApiClient);
    expect(Object.keys(registered(server)).sort()).toEqual([...NAMES].sort());
  });

  it('says create_pix_charge is real with a live key and simulated with a test key', () => {
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, {} as PaymentsApiClient);
    const d: string = registered(server).create_pix_charge.description;
    expect(d).toMatch(/REAL CHARGE/);
    expect(d).toMatch(/ggpk_test_/);
    expect(d).toMatch(/livemode/);
  });

  it('maps the flat buyer_* arguments into the API body', async () => {
    const client = { createPixCharge: vi.fn().mockResolvedValue({ id: 'pi_1', livemode: false }) };
    const server = new McpServer({ name: 't', version: '0' });
    registerPaymentsApiTools(server, client as unknown as PaymentsApiClient);
    const result = await registered(server).create_pix_charge.handler({
      wallet: 'wal_1', amount: 4990, buyer_name: 'Maria', buyer_email: 'm@e.com', buyer_document: '123',
    }, {});
    expect(client.createPixCharge).toHaveBeenCalledWith({
      wallet: 'wal_1', amount: 4990, description: undefined, external_reference: undefined, metadata: undefined,
      buyer: { name: 'Maria', email: 'm@e.com', document: '123', phone: undefined },
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

    it('honors GG_PAYMENTS_API_URL', () => {
      const server = new McpServer({ name: 't', version: '0' });
      expect(registerPaymentsApiToolsFromEnv(
        server, { GG_PAYMENTS_API_KEY: 'k', GG_PAYMENTS_API_URL: 'https://stg/v1' }, '0.5.0')).toBe('https://stg/v1');
    });
  });
});
