import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramApiAdapter } from './telegram.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('TelegramApiAdapter', () => {
  let adapter: TelegramApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new TelegramApiAdapter(http);
  });

  // --- Bots ---

  it('listBots GETs /api/telegram/bots and unwraps', async () => {
    vi.mocked(http.get).mockResolvedValue({ bots: [{ id: 'b1', name: 'Bot', token: 'secret' }] });
    const result = await adapter.listBots();
    expect(http.get).toHaveBeenCalledWith('/api/telegram/bots');
    expect(result).toHaveLength(1);
    expect((result[0] as any).token).toBeUndefined(); // sanitized
  });

  it('getBot GETs /api/telegram/bots/{id} and sanitizes token', async () => {
    vi.mocked(http.get).mockResolvedValue({ bot: { id: 'b1', token: 'secret123' } });
    const result = await adapter.getBot('b1');
    expect(http.get).toHaveBeenCalledWith('/api/telegram/bots/b1');
    expect((result as any).token).toBeUndefined();
  });

  it('createBot POSTs name and token', async () => {
    vi.mocked(http.post).mockResolvedValue({ bot: { id: 'b1', name: 'MyBot' } });
    await adapter.createBot({ name: 'MyBot', token: '123:ABC' });
    expect(http.post).toHaveBeenCalledWith('/api/telegram/bots', { name: 'MyBot', token: '123:ABC' });
  });

  it('updateBot uses PUT (not PATCH)', async () => {
    vi.mocked(http.put).mockResolvedValue({ success: true });
    await adapter.updateBot('b1', { name: 'New Name' });
    expect(http.put).toHaveBeenCalledWith('/api/telegram/bots/b1', { name: 'New Name' });
  });

  it('deleteBot DELETEs /api/telegram/bots/{id}', async () => {
    vi.mocked(http.delete).mockResolvedValue({ success: true });
    await adapter.deleteBot('b1');
    expect(http.delete).toHaveBeenCalledWith('/api/telegram/bots/b1');
  });

  it('validateToken POSTs to global endpoint when no botId', async () => {
    vi.mocked(http.post).mockResolvedValue({ valid: true, username: 'mybot' });
    await adapter.validateToken('123:ABC');
    expect(http.post).toHaveBeenCalledWith('/api/telegram/bots/validate-token', { token: '123:ABC' });
  });

  it('validateToken POSTs to bot-specific endpoint when botId given', async () => {
    vi.mocked(http.post).mockResolvedValue({ valid: true, username: 'mybot' });
    await adapter.validateToken('123:ABC', 'b1');
    expect(http.post).toHaveBeenCalledWith('/api/telegram/bots/b1/validate-token', { token: '123:ABC' });
  });

  it('deployFlow POSTs flowId to /api/telegram/bots/{id}/deploy', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true });
    await adapter.deployFlow('b1', 'f1');
    expect(http.post).toHaveBeenCalledWith('/api/telegram/bots/b1/deploy', { flowId: 'f1' });
  });

  it('getBotGroups GETs /api/telegram/bots/{id}/groups', async () => {
    vi.mocked(http.get).mockResolvedValue({ groups: [{ chatId: '123', title: 'My Group' }] });
    const result = await adapter.getBotGroups('b1');
    expect(http.get).toHaveBeenCalledWith('/api/telegram/bots/b1/groups');
    expect(result).toHaveLength(1);
  });

  // --- Flows ---

  it('listFlows GETs without filter when no botId', async () => {
    vi.mocked(http.get).mockResolvedValue({ flows: [] });
    await adapter.listFlows();
    expect(http.get).toHaveBeenCalledWith('/api/telegram/flows');
  });

  it('listFlows GETs with botId filter', async () => {
    vi.mocked(http.get).mockResolvedValue({ flows: [] });
    await adapter.listFlows('b1');
    expect(http.get).toHaveBeenCalledWith('/api/telegram/flows?botId=b1');
  });

  it('getFlow GETs /api/telegram/flows/{id}', async () => {
    vi.mocked(http.get).mockResolvedValue({ id: 'f1', name: 'Flow', nodes: [] });
    await adapter.getFlow('f1');
    expect(http.get).toHaveBeenCalledWith('/api/telegram/flows/f1');
  });

  it('createFlow POSTs and unwraps flow', async () => {
    vi.mocked(http.post).mockResolvedValue({ flow: { id: 'f1', name: 'New Flow' } });
    const result = await adapter.createFlow({ botId: 'b1', name: 'New Flow' });
    expect(http.post).toHaveBeenCalledWith('/api/telegram/flows', { botId: 'b1', name: 'New Flow' });
    expect(result.name).toBe('New Flow');
  });

  it('updateFlow uses PUT', async () => {
    vi.mocked(http.put).mockResolvedValue({ success: true });
    await adapter.updateFlow('f1', { name: 'Updated' });
    expect(http.put).toHaveBeenCalledWith('/api/telegram/flows/f1', { name: 'Updated' });
  });

  it('deleteFlow DELETEs /api/telegram/flows/{id}', async () => {
    vi.mocked(http.delete).mockResolvedValue({ success: true });
    await adapter.deleteFlow('f1');
    expect(http.delete).toHaveBeenCalledWith('/api/telegram/flows/f1');
  });

  // --- Leads ---

  it('listLeads builds query string from params', async () => {
    vi.mocked(http.get).mockResolvedValue({ leads: [], total: 0 });
    await adapter.listLeads({ botId: 'b1', status: 'lead', limit: 10 });
    expect(http.get).toHaveBeenCalledWith('/api/telegram/leads?botId=b1&status=lead&limit=10');
  });

  it('listLeads sanitizes lead PII', async () => {
    vi.mocked(http.get).mockResolvedValue({
      leads: [{ id: 'l1', email: 'john@example.com', phone: '+5511999887766', telegramUserId: '12345678' }],
      total: 1,
    });
    const result = await adapter.listLeads({});
    expect(result.leads[0].email).not.toBe('john@example.com');
    expect(result.leads[0].phone).not.toBe('+5511999887766');
    expect(result.leads[0].telegramUserId).toBe('***5678');
  });

  it('listLeads with empty query has no query string', async () => {
    vi.mocked(http.get).mockResolvedValue({ leads: [], total: 0 });
    await adapter.listLeads({});
    expect(http.get).toHaveBeenCalledWith('/api/telegram/leads');
  });

  // --- Media ---

  it('uploadMedia POSTs and unwraps data', async () => {
    vi.mocked(http.post).mockResolvedValue({
      success: true,
      data: { uploadUrl: 'https://r2.example.com/upload', filePath: 'videos/abc.mp4', publicUrl: '/api/r2-proxy/videos/abc.mp4' },
    });
    const result = await adapter.uploadMedia({ fileName: 'test.mp4', fileType: 'video/mp4', fileSize: 1024 });
    expect(http.post).toHaveBeenCalledWith('/api/telegram/media-upload', { fileName: 'test.mp4', fileType: 'video/mp4', fileSize: 1024 });
    expect(result.uploadUrl).toBe('https://r2.example.com/upload');
  });
});
