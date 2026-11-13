import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerCheckoutTools } from './checkout.tools.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

describe('checkout tools input', () => {
  let client: Client;
  const service = { create: vi.fn(), update: vi.fn() } as any;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerCheckoutTools(server, service);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
  });

  beforeEach(() => {
    service.create.mockReset().mockResolvedValue({});
    service.update.mockReset().mockResolvedValue({});
  });

  const update = (args: Record<string, unknown>) =>
    client.callTool({ name: 'update_checkout', arguments: { checkoutId: 'ck-1', ...args } });

  it('passes timer.enabled and salesNotifications.enabled to the service', async () => {
    const result = await update({ timer: { enabled: false, time: '00:10:00' }, salesNotifications: { enabled: true } });

    expect(result.isError).toBeFalsy();
    expect(service.update).toHaveBeenCalledWith('ck-1', {
      timer: { enabled: false, time: '00:10:00' },
      salesNotifications: { enabled: true },
    });
  });

  it('refuses a malformed timer time and an unknown timer key instead of dropping it', async () => {
    expect((await update({ timer: { time: '10 minutes' } })).isError).toBe(true);
    expect((await update({ timer: { timerEnabled: true } })).isError).toBe(true);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('takes a metric token as one id or a list of them', async () => {
    expect((await update({ metricToken: 'tok-1' })).isError).toBeFalsy();
    expect((await update({ metricToken: ['tok-1', 'tok-2'] })).isError).toBeFalsy();
    expect(service.update).toHaveBeenLastCalledWith('ck-1', { metricToken: ['tok-1', 'tok-2'] });
  });

  it('accepts an https URL or an r2-proxy path for the images, and nothing else', async () => {
    expect((await update({ bannerUrl: '/api/r2-proxy/uploads/u/a.webp', image: 'https://cdn.example/a.png' })).isError).toBeFalsy();
    expect((await update({ bannerUrl: 'http://cdn.example/a.png' })).isError).toBe(true);
    expect((await update({ image: '/uploads/a.png' })).isError).toBe(true);
    expect((await update({ bannerUrl: 'javascript:alert(1)' })).isError).toBe(true);
  });

  it('checks the model, the Clarity project id and lets the domain and Clarity be cleared with null', async () => {
    expect((await update({ checkoutModel: 'v6' })).isError).toBeFalsy();
    expect((await update({ checkoutModel: 'v7' })).isError).toBe(true);
    expect((await update({ analytics: { clarity: { projectId: 'BAD id' } } })).isError).toBe(true);
    expect((await update({ analytics: { clarity: { projectId: 'abcdefghij12' } } })).isError).toBeFalsy();
    expect((await update({ analytics: { clarity: null }, customDomainId: null })).isError).toBeFalsy();
    expect(service.update).toHaveBeenLastCalledWith('ck-1', { analytics: { clarity: null }, customDomainId: null });
  });
});
