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
} from '../../core/types/store.js';
import { sanitizeStoreConfig, sanitizeCustomer, sanitizeFeedback } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

export class StoreApiAdapter implements StorePort {
  constructor(private readonly http: HttpClient) {}

  async getConfig(storeId: string): Promise<StoreConfig> {
    const data = await this.http.get<{ config: StoreConfig }>(`/api/store/config?storeId=${storeId}`);
    return sanitizeStoreConfig(data.config);
  }

  async getPublic(storeId: string): Promise<{ store: Store; categories: StoreCategory[]; products: StoreProduct[] }> {
    return this.http.get<{ store: Store; categories: StoreCategory[]; products: StoreProduct[] }>(
      `/api/store/public/${storeId}`,
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
      `/api/store/catalog/products/${productId}?storeId=${storeId}`,
    );
    return data.product;
  }

  async listCategories(storeId: string): Promise<{ categories: StoreCategory[]; total: number }> {
    return this.http.get<{ categories: StoreCategory[]; total: number }>(
      `/api/store/catalog/categories?storeId=${storeId}`,
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
      `/api/store/orders/${orderId}?storeId=${storeId}`,
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
    return this.http.get<CouponValidationResult>(
      `/api/store/catalog/coupon/${code}?storeId=${storeId}&orderValue=${orderValue}`,
    );
  }
}
