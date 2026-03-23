import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookApiAdapter } from './webhook.api.js';
import { NotFoundError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('WebhookApiAdapter', () => {
  let adapter: WebhookApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new WebhookApiAdapter(http);
  });

  it('list extracts webhooks from response wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ webhooks: [{ id: 'w1' }] });
    const result = await adapter.list();
    expect(result).toEqual([{ id: 'w1' }]);
  });

  it('getById lists all and filters (no direct GET endpoint)', async () => {
    vi.mocked(http.get).mockResolvedValue({ webhooks: [{ id: 'w1' }, { id: 'w2' }] });
    const result = await adapter.getById('w2');
    expect(result.id).toBe('w2');
  });

  it('getById throws NotFoundError when webhook not in list', async () => {
    vi.mocked(http.get).mockResolvedValue({ webhooks: [{ id: 'w1' }] });
    await expect(adapter.getById('w-missing')).rejects.toThrow(NotFoundError);
  });

  it('update uses PUT with id in query string', async () => {
    vi.mocked(http.put).mockResolvedValue({ id: 'w1' });
    await adapter.update('w1', { name: 'Updated' });
    expect(http.put).toHaveBeenCalledWith('/api/clients-webhook?id=w1', { name: 'Updated' });
  });

  it('delete uses DELETE with id in query string', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.delete('w1');
    expect(http.delete).toHaveBeenCalledWith('/api/clients-webhook?id=w1');
  });
});
