import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { APP_MIME_TYPE, PIX_CHARGE_URI, SALES_DASHBOARD_URI, buildView, registerAppViews } from './apps.js';
import { registerDashboardTools } from '../tools/dashboard.tools.js';
import { registerBillingTools } from '../tools/billing.tools.js';
import { registerPaymentsApiTools } from '../tools/payments-api.tools.js';
import type { DashboardService } from '../../../core/services/dashboard.service.js';
import type { BillingService } from '../../../core/services/billing.service.js';
import type { PaymentsApiClient } from '../../outbound/payments-api.client.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

async function connect() {
  const server = new McpServer({ name: 't', version: '0' });
  registerDashboardTools(server, {} as DashboardService);
  registerBillingTools(server, {} as BillingService);
  registerPaymentsApiTools(server, {} as PaymentsApiClient, 'test');
  registerAppViews(server);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

describe('buildView', () => {
  it.each(['sales-dashboard.html', 'pix-charge.html'])('%s is one self-contained document', (page) => {
    const html = buildView(page);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).not.toContain('<!-- include:');
    expect(html).not.toContain("url('art:");
    expect(html).toContain("url('data:image/avif;base64,");
    // The host's default CSP has no network: anything external would silently fail to load.
    expect(html).not.toMatch(/(src|href)=["']?https?:/i);
    expect(html.match(/<script type="module">/g)).toHaveLength(1);
    expect(html).toContain('ui/initialize');
  });
});

describe('registerAppViews', () => {
  it('serves each view as an MCP App resource', async () => {
    const client = await connect();
    for (const uri of [SALES_DASHBOARD_URI, PIX_CHARGE_URI]) {
      const { contents } = await client.readResource({ uri });
      expect(contents).toHaveLength(1);
      expect(contents[0]).toMatchObject({ uri, mimeType: APP_MIME_TYPE });
      expect(String(contents[0].text)).toMatch(/^<!doctype html>/);
    }
  });

  it('points the tools that answer with a chart or a PIX to their view', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const uriOf = (name: string) => (tools.find((t) => t.name === name)?._meta as any)?.ui?.resourceUri;

    expect(uriOf('get_dashboard_charts')).toBe(SALES_DASHBOARD_URI);
    expect(uriOf('get_dashboard_stats')).toBe(SALES_DASHBOARD_URI);
    for (const name of ['add_credit', 'get_credit_topup', 'pay_invoice', 'create_pix_charge', 'get_payment_intent']) {
      expect(uriOf(name), name).toBe(PIX_CHARGE_URI);
    }
    // Plain data tools stay without a view.
    expect(uriOf('invalidate_dashboard_cache')).toBeUndefined();
    expect(uriOf('list_credits')).toBeUndefined();
  });
});
