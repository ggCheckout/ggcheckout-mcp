import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscountApiAdapter } from './discount.api.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('DiscountApiAdapter', () => {
  let adapter: DiscountApiAdapter;
  let http: ReturnType<typeof createMockHttp>;
  let authPort: AuthPort;

  beforeEach(() => {
    http = createMockHttp();
    authPort = { getMyBusinessId: vi.fn().mockResolvedValue('owner-123') };
    adapter = new DiscountApiAdapter(http, authPort);
  });

  it('list fetches ownerId from authPort and passes as query param', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.list();
    expect(authPort.getMyBusinessId).toHaveBeenCalled();
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('uuidOwner=owner-123'));
  });

  it('list passes optional filters', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.list({ isActive: true, type: 'percentage' });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('isActive=true');
    expect(url).toContain('type=percentage');
  });

  it('create POSTs to /api/discounts', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, id: 'd-1' });
    const result = await adapter.create({ name: 'Test', type: 'percentage', value: 10 } as any);
    expect(http.post).toHaveBeenCalledWith('/api/discounts', { name: 'Test', type: 'percentage', value: 10 });
    expect(result.id).toBe('d-1');
  });

  it('update uses PUT with id in URL and body', async () => {
    vi.mocked(http.put).mockResolvedValue({});
    await adapter.update('d-1', { isActive: false });
    expect(http.put).toHaveBeenCalledWith('/api/discounts/d-1', { id: 'd-1', isActive: false });
  });

  it('delete uses DELETE /api/discounts/{id}', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.delete('d-1');
    expect(http.delete).toHaveBeenCalledWith('/api/discounts/d-1');
  });

  it('validate POSTs to /api/discounts/validate', async () => {
    vi.mocked(http.post).mockResolvedValue({ isValid: true, discountValue: 500, finalValue: 4500, message: 'ok' });
    const result = await adapter.validate({ checkoutId: 'ck-1', orderValue: 5000, items: [] } as any);
    expect(http.post).toHaveBeenCalledWith('/api/discounts/validate', expect.objectContaining({ checkoutId: 'ck-1' }));
    expect(result.isValid).toBe(true);
  });
});
