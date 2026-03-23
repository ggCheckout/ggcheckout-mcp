import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunnelApiAdapter } from './funnel.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('FunnelApiAdapter', () => {
  let adapter: FunnelApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new FunnelApiAdapter(http);
  });

  it('list extracts funnels from response wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ funnels: [{ id: 'f1' }] });
    const result = await adapter.list();
    expect(result).toEqual([{ id: 'f1' }]);
  });

  it('create POSTs to /api/funnels and extracts funnel', async () => {
    vi.mocked(http.post).mockResolvedValue({ funnel: { id: 'f1', title: 'New' } });
    const result = await adapter.create({ title: 'New' });
    expect(http.post).toHaveBeenCalledWith('/api/funnels', { title: 'New' });
    expect(result.id).toBe('f1');
  });

  it('update uses PUT (not PATCH)', async () => {
    vi.mocked(http.put).mockResolvedValue({ funnel: { id: 'f1' } });
    await adapter.update('f1', { title: 'Updated' });
    expect(http.put).toHaveBeenCalledWith('/api/funnels/f1', { title: 'Updated' });
  });

  it('duplicate POSTs to /funnels/{id}/duplicate', async () => {
    vi.mocked(http.post).mockResolvedValue({ funnel: { id: 'f2', title: 'Copy' } });
    const result = await adapter.duplicate('f1');
    expect(http.post).toHaveBeenCalledWith('/api/funnels/f1/duplicate');
    expect(result.id).toBe('f2');
  });

  it('listLeads builds query string with status, limit, offset', async () => {
    vi.mocked(http.get).mockResolvedValue({ leads: [], count: 0, total: 0, limit: 50, offset: 0 });
    await adapter.listLeads('f1', { status: 'completed', limit: 10, offset: 20 });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('/api/funnels/f1/leads');
    expect(url).toContain('status=completed');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });

  it('getLeadStats extracts stats from response wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ stats: { visitors: 100, leads: 50 } });
    const result = await adapter.getLeadStats('f1');
    expect(result).toEqual({ visitors: 100, leads: 50 });
  });
});
