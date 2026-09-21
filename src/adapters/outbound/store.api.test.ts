import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreApiAdapter } from './store.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('StoreApiAdapter', () => {
  let adapter: StoreApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new StoreApiAdapter(http);
  });

  it('getConfig extracts config from response wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ config: { theme: {}, settings: {} } });
    const result = await adapter.getConfig('store-1');
    expect(http.get).toHaveBeenCalledWith('/api/store/config?storeId=store-1');
    expect(result).toEqual({ theme: {}, settings: {} });
  });

  it('listProducts builds query string with all options', async () => {
    vi.mocked(http.get).mockResolvedValue({ products: [], pagination: {} });
    await adapter.listProducts('store-1', { categoryId: 'cat-1', search: 'ebook', page: 2, limit: 10, sortBy: 'price', sortOrder: 'asc' });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('storeId=store-1');
    expect(url).toContain('categoryId=cat-1');
    expect(url).toContain('search=ebook');
    expect(url).toContain('page=2');
    expect(url).toContain('sortBy=price');
    expect(url).toContain('sortOrder=asc');
  });

  it('getProduct extracts product from response wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ product: { uid: 'p1', title: 'Test' } });
    const result = await adapter.getProduct('store-1', 'p1');
    expect(http.get).toHaveBeenCalledWith('/api/store/catalog/products/p1?storeId=store-1');
    expect(result.uid).toBe('p1');
  });

  it('getOrder extracts order from response wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ order: { orderId: 'o1' } });
    const result = await adapter.getOrder('store-1', 'o1');
    expect(http.get).toHaveBeenCalledWith('/api/store/orders/o1?storeId=store-1');
    expect(result.orderId).toBe('o1');
  });

  it('validateCoupon passes storeId, code, and orderValue', async () => {
    vi.mocked(http.get).mockResolvedValue({ isValid: true, finalValue: 4500 });
    await adapter.validateCoupon('store-1', 'PROMO10', 5000);
    expect(http.get).toHaveBeenCalledWith('/api/store/catalog/coupon/PROMO10?storeId=store-1&orderValue=5000');
  });

  it('validateCoupon escapes the code so it cannot change the path', async () => {
    vi.mocked(http.get).mockResolvedValue({ isValid: false });
    await adapter.validateCoupon('store 1', 'A/B?x', 99.9);
    expect(http.get).toHaveBeenCalledWith('/api/store/catalog/coupon/A%2FB%3Fx?storeId=store+1&orderValue=100');
  });

  it('listStores unwraps the stores array', async () => {
    vi.mocked(http.get).mockResolvedValue({ stores: [{ storeId: 's1', title: 'Loja', logo: null }] });
    expect(await adapter.listStores()).toEqual([{ storeId: 's1', title: 'Loja', logo: null }]);
    expect(http.get).toHaveBeenCalledWith('/api/stores');
  });

  it('saveLayoutDraft PUTs { storeId, layout }', async () => {
    vi.mocked(http.put).mockResolvedValue({ success: true });
    await adapter.saveLayoutDraft('s1', { theme: {}, blocks: [] });
    expect(http.put).toHaveBeenCalledWith('/api/store/layout', { storeId: 's1', layout: { theme: {}, blocks: [] } });
  });

  it('publishLayout and restoreLayoutVersion post to their routes', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ success: true, version: 4 }).mockResolvedValueOnce({ layout: { blocks: [] } });
    expect(await adapter.publishLayout('s1')).toEqual({ version: 4 });
    expect(await adapter.restoreLayoutVersion('s1', 2)).toEqual({ blocks: [] });
    expect(http.post).toHaveBeenNthCalledWith(1, '/api/store/layout/publish', { storeId: 's1' });
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/store/layout/history', { storeId: 's1', version: 2 });
  });

  it('createStore posts the title, or an empty body without one', async () => {
    vi.mocked(http.post).mockResolvedValue({ storeId: 'new' });
    expect(await adapter.createStore('Minha Loja')).toEqual({ storeId: 'new' });
    await adapter.createStore();
    expect(http.post).toHaveBeenNthCalledWith(1, '/api/stores', { title: 'Minha Loja' });
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/stores', {});
  });

  it('getStore and updateStore unwrap config and strip gateway tokens', async () => {
    const config = { id: 's1', paymentMethods: { pix: { enabled: true, token: 'secret', gateways: ['g1'] } } };
    vi.mocked(http.get).mockResolvedValue({ config });
    vi.mocked(http.patch).mockResolvedValue({ config });

    const read = await adapter.getStore('s/1');
    const written = await adapter.updateStore('s1', { published: true });

    expect(http.get).toHaveBeenCalledWith('/api/stores/s%2F1');
    expect(http.patch).toHaveBeenCalledWith('/api/stores/s1', { published: true });
    for (const result of [read, written]) {
      expect((result.paymentMethods as any).pix).toEqual({ enabled: true, gateways: ['g1'] });
    }
  });

  it('category routes nest under the store', async () => {
    vi.mocked(http.get).mockResolvedValue({ categories: [{ id: 'c1' }] });
    vi.mocked(http.patch).mockResolvedValue({ category: { id: 'c1', name: 'B' } });
    vi.mocked(http.delete).mockResolvedValue({ deletedIds: ['c1', 'c2'] });

    expect(await adapter.listStoreCategories('s1')).toEqual([{ id: 'c1' }]);
    expect(await adapter.updateStoreCategory('s1', 'c1', { name: 'B' })).toEqual({ id: 'c1', name: 'B' });
    expect(await adapter.deleteStoreCategory('s1', 'c1')).toEqual({ deletedIds: ['c1', 'c2'] });
    expect(http.get).toHaveBeenCalledWith('/api/stores/s1/categories');
    expect(http.patch).toHaveBeenCalledWith('/api/stores/s1/categories/c1', { name: 'B' });
    expect(http.delete).toHaveBeenCalledWith('/api/stores/s1/categories/c1');
  });

  it('listStoreReviews passes filters and masks buyer emails', async () => {
    vi.mocked(http.get).mockResolvedValue({
      feedbacks: [{ id: 'f1', customerEmail: 'buyer@example.com' }],
      pagination: {},
      counts: { all: 1, pending: 1, approved: 0 },
    });
    const result = await adapter.listStoreReviews('s1', { status: 'pending', limit: 20 });
    expect(http.get).toHaveBeenCalledWith('/api/stores/s1/feedbacks?status=pending&limit=20');
    expect(result.feedbacks[0].customerEmail).not.toBe('buyer@example.com');
  });

  it('listFeedbacks passes includeStats flag', async () => {
    vi.mocked(http.get).mockResolvedValue({ feedbacks: [], pagination: {} });
    await adapter.listFeedbacks('store-1', { includeStats: true, rating: 5 });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('includeStats=true');
    expect(url).toContain('rating=5');
  });
});
