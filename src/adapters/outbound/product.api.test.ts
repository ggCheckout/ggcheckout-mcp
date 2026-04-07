import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductApiAdapter } from './product.api.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';

function createMockHttp(): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as any;
}

describe('ProductApiAdapter', () => {
  let adapter: ProductApiAdapter;
  let http: ReturnType<typeof createMockHttp>;
  let authPort: AuthPort;

  beforeEach(() => {
    http = createMockHttp();
    authPort = { getMyBusinessId: vi.fn().mockResolvedValue('user-1') };
    adapter = new ProductApiAdapter(http, authPort);
  });

  it('list calls GET /api/product-delivery', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.list();
    expect(http.get).toHaveBeenCalledWith('/api/product-delivery');
  });

  it('getById calls GET /api/product-delivery/{id}', async () => {
    vi.mocked(http.get).mockResolvedValue({ uid: 'p1' });
    await adapter.getById('p1');
    expect(http.get).toHaveBeenCalledWith('/api/product-delivery/p1');
  });

  it('create returns { success, productId } from API response', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, productId: 'new-id' });
    const result = await adapter.create({ title: 'Test', price: 1990 });
    expect(http.post).toHaveBeenCalledWith('/api/product-delivery', { title: 'Test', price: 1990 });
    expect(result).toEqual({ success: true, productId: 'new-id' });
  });

  it('update calls PATCH with id and uuidOwner in payload', async () => {
    vi.mocked(http.patch).mockResolvedValue({});
    await adapter.update('p1', { title: 'Updated' });
    expect(authPort.getMyBusinessId).toHaveBeenCalled();
    expect(http.patch).toHaveBeenCalledWith('/api/product-delivery/p1', { title: 'Updated', id: 'p1', uuidOwner: 'user-1' });
  });

  it('createUpsell POSTs to /upsells/{upsellId} with { upsell: input } body', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, upsell: { uid: 'u1' } });
    const input = { upsellProductId: 'prod-2', title: 'Upsell Offer' };
    const result = await adapter.createUpsell('p1', 'u1', input as any);

    expect(http.post).toHaveBeenCalledWith(
      '/api/product-delivery/p1/upsells/u1',
      { upsell: input },
    );
    expect(result).toEqual({ uid: 'u1' });
  });

  it('deleteUpsell calls DELETE /upsells/{upsellId}', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.deleteUpsell('p1', 'u1');
    expect(http.delete).toHaveBeenCalledWith('/api/product-delivery/p1/upsells/u1');
  });

  it('reorderUpsells PATCHes /upsells with { upsells } body', async () => {
    vi.mocked(http.patch).mockResolvedValue({});
    const upsells = [{ uid: 'u1' }, { uid: 'u2' }] as any;
    await adapter.reorderUpsells('p1', upsells);
    expect(http.patch).toHaveBeenCalledWith('/api/product-delivery/p1/upsells', { upsells });
  });

  it('createDownsell POSTs to /downsells/{downsellId} with { downsell: input } body', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, downsell: { uid: 'd1' } });
    const input = { downsellProductId: 'prod-3', title: 'Downsell', price: 990 };
    const result = await adapter.createDownsell('p1', 'd1', input as any);

    expect(http.post).toHaveBeenCalledWith(
      '/api/product-delivery/p1/downsells/d1',
      { downsell: input },
    );
    expect(result).toEqual({ uid: 'd1' });
  });

  it('listDownsells GETs /downsells/list and returns { downsells, count }', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, downsells: [], count: 0 });
    const result = await adapter.listDownsells('p1');
    expect(http.get).toHaveBeenCalledWith('/api/product-delivery/p1/downsells/list');
    expect(result).toEqual({ success: true, downsells: [], count: 0 });
  });

  it('manageTags PATCHes /tags with { name, color }[] format', async () => {
    const tags = [{ name: 'vip', color: '#FF0000' }];
    vi.mocked(http.patch).mockResolvedValue({ message: 'ok', tags });
    const result = await adapter.manageTags('p1', tags);

    expect(http.patch).toHaveBeenCalledWith('/api/product-delivery/p1/tags', { tags });
    expect(result.tags).toEqual(tags);
  });

  it('uploadDeliverable POSTs to /api/products/{id}/deliverable/upload', async () => {
    vi.mocked(http.post).mockResolvedValue({ enabled: true, fileUrl: 'https://...' });
    await adapter.uploadDeliverable('p1', { fileUrl: 'https://file.com/a.pdf', fileName: 'a.pdf' });
    expect(http.post).toHaveBeenCalledWith(
      '/api/products/p1/deliverable/upload',
      { fileUrl: 'https://file.com/a.pdf', fileName: 'a.pdf' },
    );
  });

  it('deleteDeliverable calls DELETE /api/products/{id}/deliverable', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.deleteDeliverable('p1');
    expect(http.delete).toHaveBeenCalledWith('/api/products/p1/deliverable');
  });
});
