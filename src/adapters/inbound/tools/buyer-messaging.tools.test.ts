import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerBuyerMessagingTools } from './buyer-messaging.tools.js';
import type { BuyerMessagingService } from '../../../core/services/buyer-messaging.service.js';
import { createServer } from '../../../server.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

const OVERVIEW = { url: 'https://app.example.test/settings/whatsapp/funnels', dailyCap: null, rows: [] };

async function connect(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const toolNames = async (apiKey: string): Promise<string[]> => {
  const { server } = createServer({
    apiKey, apiUrl: 'https://qa.example.test', version: '0.8.0', env: { GGCHECKOUT_AGENT_CONTACT: '553199998888' },
  });
  return (await (await connect(server)).listTools()).tools.map((tool): string => tool.name);
};

describe('get_buyer_messaging_overview', () => {
  it('reads the overview, with no input', async () => {
    const service = { getOverview: vi.fn().mockResolvedValue(OVERVIEW) } as unknown as BuyerMessagingService;
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerBuyerMessagingTools(server, service);
    const client = await connect(server);
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'get_buyer_messaging_overview')?.inputSchema.properties ?? {}).toEqual({});
    const result = await client.callTool({ name: 'get_buyer_messaging_overview', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result.content)).toContain('settings/whatsapp/funnels');
    expect(service.getOverview).toHaveBeenCalledOnce();
  });

  it('tells the model that a null dailyCap is no limit, never an assumed one', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerBuyerMessagingTools(server, { getOverview: vi.fn() } as unknown as BuyerMessagingService);
    const { tools } = await (await connect(server)).listTools();
    expect(tools[0]?.description).toContain('null means no limit is stored yet');
  });

  it('a seller key has it, an assistant key does not', async () => {
    expect(await toolNames('ggck_live_' + 'x'.repeat(40))).toContain('get_buyer_messaging_overview');
    expect(await toolNames('ggck_agent_' + 'ab12'.repeat(16))).not.toContain('get_buyer_messaging_overview');
  });
});
