import { describe, it, expect, vi, beforeAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTrackingLinkTools } from './tracking-link.tools.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

describe('build_tracking_link', () => {
  let client: Client;
  const reads = {
    checkouts: { getById: vi.fn().mockResolvedValue({ uid: 'c1', publicId: 'PUB', title: 'Curso', uuidOwner: 'b', price: 1 }) },
    funnels: { getById: vi.fn() },
    stores: { getStore: vi.fn() },
    domains: { list: vi.fn().mockResolvedValue({ domains: [] }) },
  } as any;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerTrackingLinkTools(server, reads, 'https://qa.ggcheckout.app');
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
  });

  it('builds a Meta link on the injected app origin and draws with the app', async () => {
    const tools = await client.listTools();
    expect(tools.tools.find((t) => t.name === 'build_tracking_link')?._meta).toEqual({ ui: { resourceUri: 'ui://ggcheckout/app.html' } });
    const result = await client.callTool({ name: 'build_tracking_link', arguments: { checkoutId: 'c1', platform: 'meta' } });
    expect(result.structuredContent).toMatchObject({
      platform: 'meta',
      destination: { kind: 'checkout', url: 'https://qa.ggcheckout.app/checkout/PUB' },
    });
    expect((result.structuredContent as any).adParameters).toContain('utm_source=FB');
  });

  it('defaults to manual', async () => {
    const result = await client.callTool({ name: 'build_tracking_link', arguments: { url: 'https://example.com', utm_source: 'bio' } });
    expect(result.structuredContent).toMatchObject({ platform: 'manual', finalUrl: 'https://example.com/?utm_source=bio' });
  });

  it('answers a tool error, not a crash, for a missing or double target', async () => {
    const none = await client.callTool({ name: 'build_tracking_link', arguments: {} });
    expect(none.isError).toBe(true);
    const twice = await client.callTool({ name: 'build_tracking_link', arguments: { checkoutId: 'a', url: 'https://example.com' } });
    expect(twice.isError).toBe(true);
  });

  it('rejects strings over the limits', async () => {
    const result = await client.callTool({ name: 'build_tracking_link', arguments: { url: 'https://example.com', utm_source: 'x'.repeat(201) } }).catch((e) => ({ isError: true, e }));
    expect((result as any).isError).toBe(true);
  });

  it('refuses an unknown platform', async () => {
    const result = await client.callTool({ name: 'build_tracking_link', arguments: { url: 'https://example.com', platform: 'x' } }).catch(() => ({ isError: true }));
    expect((result as any).isError).toBe(true);
  });
});
