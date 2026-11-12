import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerPaymentTools } from './payment.tools.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const page = { payments: [{ id: 'p1' }], total: 2852, totalCapped: false, nextCursor: '2026-11-06T19:02:59Z|p1' };

describe('list_payments', () => {
  let client: Client;
  const service = { getPaginated: vi.fn() } as any;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerPaymentTools(server, service);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
  });

  beforeEach(() => service.getPaginated.mockReset().mockResolvedValue(page));

  // The legacy list route stopped at a fixed count with no total and no cursor, so the view told a
  // seller with 2852 payments that there were 100. The first page carries both.
  it('answers the first page of the paginated route, with total and cursor', async () => {
    const result = await client.callTool({ name: 'list_payments', arguments: { businessId: 'biz-1' } });
    expect(service.getPaginated).toHaveBeenCalledWith('biz-1', { pageSize: 10 });
    expect(result.structuredContent).toMatchObject({ total: 2852, nextCursor: page.nextCursor });
  });

  it('passes pageSize through', async () => {
    await client.callTool({ name: 'list_payments', arguments: { businessId: 'biz-1', pageSize: 100 } });
    expect(service.getPaginated).toHaveBeenCalledWith('biz-1', { pageSize: 100 });
  });
});

describe('get_sales_attribution', () => {
  let client: Client;
  const service = { getSalesAttribution: vi.fn() } as any;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerPaymentTools(server, service);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
  });

  beforeEach(() => service.getSalesAttribution.mockReset().mockResolvedValue({ rows: [], totals: {}, truncated: false }));

  it('passes the business and the query to the service', async () => {
    await client.callTool({
      name: 'get_sales_attribution',
      arguments: { businessId: 'biz-1', from: '2026-11-01T00:00:00Z', groupBy: ['utm_campaign', 'utm_content'] },
    });

    expect(service.getSalesAttribution).toHaveBeenCalledWith('biz-1', { from: '2026-11-01T00:00:00Z', groupBy: ['utm_campaign', 'utm_content'] });
  });

  it('refuses an unknown key, a repeated key and more than 3 keys', async () => {
    for (const groupBy of [['utm_x'], ['src', 'src'], ['src', 'sck', 'utm_term', 'utm_source'], []]) {
      const result = await client.callTool({ name: 'get_sales_attribution', arguments: { businessId: 'b', groupBy } });
      expect(result.isError, JSON.stringify(groupBy)).toBe(true);
    }
    expect(service.getSalesAttribution).not.toHaveBeenCalled();
  });
});
