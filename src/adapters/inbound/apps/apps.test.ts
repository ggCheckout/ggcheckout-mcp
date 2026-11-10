import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { APP_MIME_TYPE, APP_URI, registerAppViews } from './apps.js';
import { TOOL_VIEWS } from '../../../../ui/src/views.js';
import { registerDashboardTools } from '../tools/dashboard.tools.js';
import { registerBillingTools } from '../tools/billing.tools.js';
import { registerPaymentsApiTools } from '../tools/payments-api.tools.js';
import { registerFunnelTools } from '../tools/funnel.tools.js';
import { registerPaymentTools } from '../tools/payment.tools.js';
import { registerCustomDomainTools } from '../tools/custom-domain.tools.js';
import { registerWhatsAppTools } from '../tools/whatsapp.tools.js';
import { registerGatewayTools } from '../tools/gateway.tools.js';
import { registerRewardsTools } from '../tools/rewards.tools.js';
import { registerProductTools } from '../tools/product.tools.js';
import { registerMembersAreaTools } from '../tools/members-area.tools.js';
import { registerTelegramTools } from '../tools/telegram.tools.js';
import type { DashboardService } from '../../../core/services/dashboard.service.js';
import type { BillingService } from '../../../core/services/billing.service.js';
import type { PaymentsApiClient } from '../../outbound/payments-api.client.js';
import type { FunnelService } from '../../../core/services/funnel.service.js';
import type { PaymentService } from '../../../core/services/payment.service.js';
import type { CustomDomainService } from '../../../core/services/custom-domain.service.js';
import type { WhatsAppService } from '../../../core/services/whatsapp.service.js';
import type { GatewayService } from '../../../core/services/gateway.service.js';
import type { RewardsService } from '../../../core/services/rewards.service.js';
import type { ProductService } from '../../../core/services/product.service.js';
import type { MembersAreaService } from '../../../core/services/members-area.service.js';
import type { TelegramService } from '../../../core/services/telegram.service.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

async function connect(drawsViews = false) {
  const server = new McpServer({ name: 't', version: '0' });
  registerDashboardTools(server, { getStats: async () => ({ totalSales: 1, totalRevenue: 100 }) } as unknown as DashboardService);
  registerBillingTools(server, {} as BillingService);
  registerPaymentsApiTools(server, {} as PaymentsApiClient, 'test');
  registerFunnelTools(server, {} as FunnelService);
  registerPaymentTools(server, {} as PaymentService);
  registerCustomDomainTools(server, {} as CustomDomainService);
  registerWhatsAppTools(server, {} as WhatsAppService);
  registerGatewayTools(server, {} as GatewayService);
  registerRewardsTools(server, {} as RewardsService);
  registerProductTools(server, {} as ProductService);
  registerMembersAreaTools(server, {} as MembersAreaService);
  registerTelegramTools(server, {} as TelegramService);
  registerAppViews(server);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const capabilities = drawsViews ? { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [APP_MIME_TYPE] } } } : {};
  const client = new Client({ name: 'c', version: '0' }, { capabilities });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

describe('registerAppViews', () => {
  it('serves the built app as one self-contained MCP App resource', async () => {
    const client = await connect();
    const { contents } = await client.readResource({ uri: APP_URI });
    expect(contents).toHaveLength(1);
    expect(contents[0]).toMatchObject({ uri: APP_URI, mimeType: APP_MIME_TYPE });
    const html = String(contents[0].text);
    expect(html).toMatch(/^<!doctype html>/i);
    // The host's default CSP has no network: anything external would silently fail to load.
    expect(html).not.toMatch(/(src|href)=["']?https?:/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  it('points every tool with a view to the app', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const uriOf = (name: string) => (tools.find((t) => t.name === name)?._meta as any)?.ui?.resourceUri;

    // Every tool the app draws points to it, and the app draws every tool that points to it.
    const drawn = tools.filter((t) => uriOf(t.name) === APP_URI).map((t) => t.name).sort();
    expect(drawn).toEqual(Object.keys(TOOL_VIEWS).sort());
    // Plain data tools stay without a view.
    expect(uriOf('invalidate_dashboard_cache')).toBeUndefined();
    expect(uriOf('get_billing_history')).toBeUndefined();
    expect(uriOf('get_card_status')).toBeUndefined();
    expect(uriOf('delete_custom_domain')).toBeUndefined();
    expect(uriOf('list_whatsapp_templates')).toBeUndefined();
    expect(uriOf('list_members_areas')).toBeUndefined();
    expect(uriOf('reorder_modules')).toBeUndefined();
    expect(uriOf('list_telegram_leads')).toBeUndefined();
  });

  it('tells the model the card is on screen only to a client that draws it', async () => {
    const texts = async (drawsViews: boolean) => {
      const client = await connect(drawsViews);
      const result = await client.callTool({ name: 'get_dashboard_stats', arguments: {} });
      return (result.content as { text: string }[]).map((c) => c.text);
    };
    const drawn = await texts(true);
    expect(drawn[0]).toMatch(/drawn as an interactive card/);
    expect(JSON.parse(drawn[1])).toMatchObject({ totalSales: 1 });

    const plain = await texts(false);
    expect(plain).toHaveLength(1);
    expect(JSON.parse(plain[0])).toMatchObject({ totalSales: 1 });
  });

  // A host may hand the model structuredContent instead of the text, so the note rides there too.
  it('puts the note in structuredContent as _view only for a client that draws it', async () => {
    const structured = async (drawsViews: boolean) => {
      const client = await connect(drawsViews);
      const result = await client.callTool({ name: 'get_dashboard_stats', arguments: {} });
      return result.structuredContent as Record<string, unknown>;
    };
    const drawn = await structured(true);
    expect(String(drawn._view)).toMatch(/drawn as an interactive card/);
    expect(drawn).toMatchObject({ totalSales: 1, totalRevenue: 100 });

    const plain = await structured(false);
    expect(plain).not.toHaveProperty('_view');
    expect(plain).toMatchObject({ totalSales: 1, totalRevenue: 100 });
  });
});
