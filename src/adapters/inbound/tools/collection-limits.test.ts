import { describe, it, expect, vi, beforeAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerMembersAreaTools } from './members-area.tools.js';
import { registerTelegramTools } from './telegram.tools.js';
import { registerFunnelTools } from './funnel.tools.js';

vi.mock('../../../shared/logger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Every service method is a spy, so a test can prove the request never reached the service.
function spyService(): any {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, {
    get: (target, key: string) => (target[key] ??= vi.fn().mockResolvedValue({ updated: 0 })),
  });
}

const tooMany = (max: number): number[] => Array.from({ length: max + 1 }, (_, i) => i);

// Oversized collections whose elements are also invalid (numbers, not the expected shape):
// the size limit must reject them, through the real MCP call path the SDK validates.
const cases: Array<{ tool: string; field: string; max: number; args: Record<string, unknown> }> = [
  { tool: 'reorder_modules', field: 'moduleIds', max: 200, args: { areaId: 'a' } },
  { tool: 'reorder_sections', field: 'sectionIds', max: 200, args: { areaId: 'a', moduleId: 'm' } },
  { tool: 'reorder_lessons', field: 'lessonIds', max: 200, args: { areaId: 'a', moduleId: 'm', sectionId: 's' } },
  { tool: 'import_students', field: 'students', max: 100, args: { areaId: 'a' } },
  { tool: 'update_telegram_flow', field: 'nodes', max: 500, args: { flowId: 'f' } },
  { tool: 'update_telegram_flow', field: 'edges', max: 1000, args: { flowId: 'f' } },
  { tool: 'update_telegram_flow', field: 'variables', max: 100, args: { flowId: 'f' } },
];

describe('collection size limits', () => {
  let client: Client;
  const services = { membersArea: spyService(), telegram: spyService(), funnel: spyService() };

  beforeAll(async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerMembersAreaTools(server, services.membersArea);
    registerTelegramTools(server, services.telegram);
    registerFunnelTools(server, services.funnel);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
  });

  async function rejection(name: string, args: Record<string, unknown>): Promise<string> {
    try {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      return JSON.stringify(result.content);
    } catch (error) {
      return String(error);
    }
  }

  it.each(cases)('$tool rejects more than $max $field', async ({ tool, field, max, args }) => {
    const message = await rejection(tool, { ...args, [field]: tooMany(max) });

    expect(message).toMatch(/Input validation error/);
    expect(message).toMatch(new RegExp(`too_big|<=${max}`));
    // The size check runs before the elements are walked: no per-element issue is reported.
    expect(message).not.toMatch(/invalid_type/);
    for (const service of Object.values(services)) {
      for (const spy of Object.values(service)) expect(spy).not.toHaveBeenCalled();
    }
  });

  it('update_funnel rejects a step with more than 100 components', async () => {
    const step = { id: 's', title: 't', order: 0, position: { x: 0, y: 0 }, components: tooMany(100) };

    const message = await rejection('update_funnel', { funnelId: 'f', steps: [step] });

    expect(message).toMatch(/too_big|<=100/);
    expect(message).not.toMatch(/invalid_type/);
    expect(services.funnel.update).not.toHaveBeenCalled();
  });

  it('accepts a list exactly at the limit', async () => {
    const moduleIds = Array.from({ length: 200 }, (_, i) => `m${i}`);

    const result = await client.callTool({ name: 'reorder_modules', arguments: { areaId: 'a', moduleIds } });

    expect(result.isError).toBeFalsy();
    expect(services.membersArea.reorderModules).toHaveBeenCalledWith('a', moduleIds);
  });

  it('advertises the limits in the listed JSON schemas', async () => {
    const { tools } = await client.listTools();
    const schema = (name: string): any => tools.find((t) => t.name === name)?.inputSchema;

    expect(schema('reorder_modules').properties.moduleIds.maxItems).toBe(200);
    expect(schema('update_telegram_flow').properties.nodes.maxItems).toBe(500);
    expect(schema('create_telegram_flow').properties.basicConfig.type).toBe('object');
  });
});
