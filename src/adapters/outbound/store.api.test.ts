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

  it('listFeedbacks passes includeStats flag', async () => {
    vi.mocked(http.get).mockResolvedValue({ feedbacks: [], pagination: {} });
    await adapter.listFeedbacks('store-1', { includeStats: true, rating: 5 });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain('includeStats=true');
    expect(url).toContain('rating=5');
  });
});
