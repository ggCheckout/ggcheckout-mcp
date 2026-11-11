import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTrackingTools } from './tracking.tools.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

describe('tracking tools', () => {
  let client: Client;
  const service = { diagnose: vi.fn() } as any;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerTrackingTools(server, service);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
  });

  beforeEach(() => service.diagnose.mockReset().mockResolvedValue({ scope: { kind: 'account' }, findings: [], tokens: [] }));

  it('explains tracking without calling the API', async () => {
    const result = await client.callTool({ name: 'explain_tracking', arguments: {} });
    const guide = result.structuredContent as any;
    expect(guide.topic).toBeNull();
    expect(guide.sections.length).toBeGreaterThan(0);
    expect(service.diagnose).not.toHaveBeenCalled();
  });

  it('narrows the guide to a topic', async () => {
    const result = await client.callTool({ name: 'explain_tracking', arguments: { topic: 'dedup' } });
    expect((result.structuredContent as any).sections.map((s: any) => s.id)).toEqual(['dedup']);
  });

  it('refuses an unknown topic', async () => {
    const result = await client.callTool({ name: 'explain_tracking', arguments: { topic: 'nope' } });
    expect(result.isError).toBe(true);
  });

  it('diagnoses with the ids it was given', async () => {
    const result = await client.callTool({ name: 'diagnose_tracking', arguments: { checkoutId: 'c1', paymentId: 'p1' } });
    expect(service.diagnose).toHaveBeenCalledWith({ checkoutId: 'c1', paymentId: 'p1' });
    expect(result.structuredContent).toMatchObject({ scope: { kind: 'account' } });
  });

  it('is an account overview without ids', async () => {
    await client.callTool({ name: 'diagnose_tracking', arguments: {} });
    expect(service.diagnose).toHaveBeenCalledWith({});
  });
});
