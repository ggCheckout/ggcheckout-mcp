import type { StorePort } from '../../core/ports/store.port.js';
import type {
  StoreConfig,
  Store,
  StoreProduct,
  StoreProductDetail,
  StoreCategory,
  StoreOrder,
  CustomField,
  StoreFeedback,
  FeedbacksPagination,
  FeedbacksStats,
  CouponValidationResult,
  StoreSummary,
  StoreLayout,
  StoreLayoutDraft,
} from '../../core/types/store.js';
import { sanitizeStoreConfig, sanitizeCustomer, sanitizeFeedback } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

export class StoreApiAdapter implements StorePort {
  constructor(private readonly http: HttpClient) {}

  async getConfig(storeId: string): Promise<StoreConfig> {
    const data = await this.http.get<{ config: StoreConfig }>(`/api/store/config?${new URLSearchParams({ storeId })}`);
    return sanitizeStoreConfig(data.config);
  }

  async getPublic(storeId: string): Promise<{ store: Store; categories: StoreCategory[]; products: StoreProduct[] }> {
    return this.http.get<{ store: Store; categories: StoreCategory[]; products: StoreProduct[] }>(
      `/api/store/public/${encodeURIComponent(storeId)}`,
    );
  }

  async listProducts(storeId: string, options?: {
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const params = new URLSearchParams({ storeId });
    if (options?.categoryId) params.append('categoryId', options.categoryId);
    if (options?.search) params.append('search', options.search);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);

    return this.http.get<{
      products: StoreProduct[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/store/catalog/products?${params.toString()}`);
  }

  async getProduct(storeId: string, productId: string): Promise<StoreProductDetail> {
    const data = await this.http.get<{ product: StoreProductDetail }>(
      `/api/store/catalog/products/${encodeURIComponent(productId)}?${new URLSearchParams({ storeId })}`,
    );
    return data.product;
  }

  async listCategories(storeId: string): Promise<{ categories: StoreCategory[]; total: number }> {
    return this.http.get<{ categories: StoreCategory[]; total: number }>(
      `/api/store/catalog/categories?${new URLSearchParams({ storeId })}`,
    );
  }

  async listCustomFields(storeId: string, productId?: string): Promise<{ customFields: CustomField[]; count: number }> {
    const params = new URLSearchParams({ storeId });
    if (productId) params.append('productId', productId);
    return this.http.get<{ customFields: CustomField[]; count: number }>(
      `/api/store/custom-fields?${params.toString()}`,
    );
  }

  async getOrder(storeId: string, orderId: string): Promise<StoreOrder> {
    const data = await this.http.get<{ order: StoreOrder }>(
      `/api/store/orders/${encodeURIComponent(orderId)}?${new URLSearchParams({ storeId })}`,
    );
    return { ...data.order, customer: sanitizeCustomer(data.order.customer) };
  }

  async listFeedbacks(storeId: string, options?: {
    productId?: string;
    rating?: number;
    page?: number;
    limit?: number;
    includeStats?: boolean;
  }): Promise<{ feedbacks: StoreFeedback[]; pagination: FeedbacksPagination; stats?: FeedbacksStats }> {
    const params = new URLSearchParams({ storeId });
    if (options?.productId) params.append('productId', options.productId);
    if (options?.rating) params.append('rating', options.rating.toString());
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.includeStats) params.append('includeStats', 'true');

    const data = await this.http.get<{ feedbacks: StoreFeedback[]; pagination: FeedbacksPagination; stats?: FeedbacksStats }>(
      `/api/store/feedbacks?${params.toString()}`,
    );
    return { ...data, feedbacks: data.feedbacks.map(sanitizeFeedback) };
  }

  async validateCoupon(storeId: string, code: string, orderValue: number): Promise<CouponValidationResult> {
    const params = new URLSearchParams({ storeId, orderValue: String(Math.round(orderValue)) });
    return this.http.get<CouponValidationResult>(
      `/api/store/catalog/coupon/${encodeURIComponent(code)}?${params}`,
    );
  }

  async listStores(): Promise<StoreSummary[]> {
    const data = await this.http.get<{ stores?: StoreSummary[] }>('/api/stores');
    return data.stores ?? [];
  }

  async getLayout(storeId: string): Promise<{ layout: StoreLayout | null; isNewStore: boolean }> {
    return this.http.get<{ layout: StoreLayout | null; isNewStore: boolean }>(
      `/api/store/layout?${new URLSearchParams({ storeId })}`,
    );
  }

  async saveLayoutDraft(storeId: string, layout: StoreLayoutDraft): Promise<void> {
    await this.http.put('/api/store/layout', { storeId, layout });
  }

  async publishLayout(storeId: string): Promise<{ version: number }> {
    const data = await this.http.post<{ success: boolean; version: number }>('/api/store/layout/publish', { storeId });
    return { version: data.version };
  }

  async listLayoutHistory(storeId: string): Promise<Array<{ version: number; publishedAt: unknown }>> {
    const data = await this.http.get<{ versions?: Array<{ version: number; publishedAt: unknown }> }>(
      `/api/store/layout/history?${new URLSearchParams({ storeId })}`,
    );
    return data.versions ?? [];
  }

  async restoreLayoutVersion(storeId: string, version: number): Promise<StoreLayout> {
    const data = await this.http.post<{ layout: StoreLayout }>('/api/store/layout/history', { storeId, version });
    return data.layout;
  }

  async getTheme(storeId: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/store/store-theme?${new URLSearchParams({ storeId })}`);
  }
}
