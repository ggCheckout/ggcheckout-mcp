import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutApiAdapter } from './checkout.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('CheckoutApiAdapter', () => {
  let adapter: CheckoutApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new CheckoutApiAdapter(http);
  });

  it('list passes uuidOwner as query param', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.list('owner-1');
    expect(http.get).toHaveBeenCalledWith('/api/checkouts?uuidOwner=owner-1');
  });

  it('create extracts checkout from response wrapper', async () => {
    vi.mocked(http.post).mockResolvedValue({ checkout: { uid: 'ck-1', title: 'Test' } });
    const result = await adapter.create({ title: 'Test', productId: 'prod-1', checkout: {}, paymentMethods: {}, price: 1000 });
    expect(result).toEqual({ uid: 'ck-1', title: 'Test' });
  });

  it('create sends productId as the API `id` field and drops the domain name', async () => {
    vi.mocked(http.post).mockResolvedValue({ checkout: { uid: 'ck-1' } });
    await adapter.create({
      title: 'Test', productId: 'prod-1', uuidOwner: 'owner-1', checkout: {}, paymentMethods: {}, price: 1000,
    });

    const [url, body] = vi.mocked(http.post).mock.calls[0];
    expect(url).toBe('/api/checkouts');
    expect(body).toMatchObject({ id: 'prod-1', uuidOwner: 'owner-1', title: 'Test' });
    expect(body).not.toHaveProperty('productId');
  });

  it('update returns productData from response or fallback', async () => {
    vi.mocked(http.patch).mockResolvedValue({ productData: { uid: 'ck-1', title: 'Updated' } });
    const result = await adapter.update('ck-1', { title: 'Updated' });
    expect(result).toEqual({ uid: 'ck-1', title: 'Updated' });
  });

  it('update falls back to payload when no productData', async () => {
    vi.mocked(http.patch).mockResolvedValue({});
    const result = await adapter.update('ck-1', { title: 'Updated' });
    expect(result).toEqual({ title: 'Updated', uid: 'ck-1' });
  });

  it('delete sends uuidOwner in body of DELETE request', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.delete('ck-1', 'owner-abc');
    expect(http.delete).toHaveBeenCalledWith('/api/checkouts/ck-1', { uuidOwner: 'owner-abc' });
  });

  it('manageTags PATCHes /tags with { name, color }[] and returns result', async () => {
    const tags = [{ name: 'promo', color: '#00FF00' }];
    vi.mocked(http.patch).mockResolvedValue({ message: 'ok', tags });
    const result = await adapter.manageTags('ck-1', tags);
    expect(http.patch).toHaveBeenCalledWith('/api/checkouts/ck-1/tags', { tags });
    expect(result.tags).toEqual(tags);
  });
});
