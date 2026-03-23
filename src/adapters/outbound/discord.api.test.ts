import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordApiAdapter } from './discord.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('DiscordApiAdapter', () => {
  let adapter: DiscordApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new DiscordApiAdapter(http);
  });

  it('listConnections extracts connections from wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ connections: [{ id: 'c1' }] });
    const result = await adapter.listConnections();
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('createConnection extracts connection from wrapper', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, connection: { id: 'c1', guildId: 'g1' } });
    const result = await adapter.createConnection({ guildId: 'g1', guildName: 'My Server' });
    expect(result.id).toBe('c1');
  });

  it('updateConnection PATCHes with settings object', async () => {
    vi.mocked(http.patch).mockResolvedValue({});
    await adapter.updateConnection('c1', { language: 'pt' });
    expect(http.patch).toHaveBeenCalledWith('/api/discord/connections/c1', { settings: { language: 'pt' } });
  });

  it('getGuildChannels returns textChannels and categories', async () => {
    vi.mocked(http.get).mockResolvedValue({ textChannels: [{ id: 'ch1' }], categories: [{ id: 'cat1' }] });
    const result = await adapter.getGuildChannels('g1');
    expect(result.textChannels).toHaveLength(1);
    expect(result.categories).toHaveLength(1);
  });

  it('getGuildRoles extracts roles from wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ roles: [{ id: 'r1', name: 'Admin' }] });
    const result = await adapter.getGuildRoles('g1');
    expect(result).toEqual([{ id: 'r1', name: 'Admin' }]);
  });

  it('createPrivateChannel extracts channel from wrapper', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, channel: { id: 'ch1', name: 'Vendas' } });
    const result = await adapter.createPrivateChannel('g1');
    expect(result).toEqual({ id: 'ch1', name: 'Vendas' });
  });
});
