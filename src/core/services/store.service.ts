import type { StorePort } from '../ports/store.port.js';
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
} from '../types/store.js';

export class StoreService {
  constructor(private readonly storePort: StorePort) {}

  async getConfig(storeId: string): Promise<StoreConfig> {
    return this.storePort.getConfig(storeId);
  }

  async getPublic(storeId: string): Promise<{ store: Store; categories: StoreCategory[]; products: StoreProduct[] }> {
    return this.storePort.getPublic(storeId);
  }

  async listProducts(storeId: string, options?: {
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    return this.storePort.listProducts(storeId, options);
  }

  async getProduct(storeId: string, productId: string): Promise<StoreProductDetail> {
    return this.storePort.getProduct(storeId, productId);
  }

  async listCategories(storeId: string): Promise<{ categories: StoreCategory[]; total: number }> {
    return this.storePort.listCategories(storeId);
  }

  async listCustomFields(storeId: string, productId?: string): Promise<{ customFields: CustomField[]; count: number }> {
    return this.storePort.listCustomFields(storeId, productId);
  }

  async getOrder(storeId: string, orderId: string): Promise<StoreOrder> {
    return this.storePort.getOrder(storeId, orderId);
  }

  async listFeedbacks(storeId: string, options?: {
    productId?: string;
    rating?: number;
    page?: number;
    limit?: number;
    includeStats?: boolean;
  }): Promise<{ feedbacks: StoreFeedback[]; pagination: FeedbacksPagination; stats?: FeedbacksStats }> {
    return this.storePort.listFeedbacks(storeId, options);
  }

  async validateCoupon(storeId: string, code: string, orderValue: number): Promise<CouponValidationResult> {
    return this.storePort.validateCoupon(storeId, code, orderValue);
  }
}
