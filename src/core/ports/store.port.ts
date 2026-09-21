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
} from '../types/store.js';

export interface StorePort {
  getConfig(storeId: string): Promise<StoreConfig>;
  getPublic(storeId: string): Promise<{ store: Store; categories: StoreCategory[]; products: StoreProduct[] }>;
  listProducts(storeId: string, options?: {
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ products: StoreProduct[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>;
  getProduct(storeId: string, productId: string): Promise<StoreProductDetail>;
  listCategories(storeId: string): Promise<{ categories: StoreCategory[]; total: number }>;
  listCustomFields(storeId: string, productId?: string): Promise<{ customFields: CustomField[]; count: number }>;
  getOrder(storeId: string, orderId: string): Promise<StoreOrder>;
  listFeedbacks(storeId: string, options?: {
    productId?: string;
    rating?: number;
    page?: number;
    limit?: number;
    includeStats?: boolean;
  }): Promise<{ feedbacks: StoreFeedback[]; pagination: FeedbacksPagination; stats?: FeedbacksStats }>;
  validateCoupon(storeId: string, code: string, orderValue: number): Promise<CouponValidationResult>;
  listStores(): Promise<StoreSummary[]>;
  getLayout(storeId: string): Promise<{ layout: StoreLayout | null; isNewStore: boolean }>;
  saveLayoutDraft(storeId: string, layout: StoreLayoutDraft): Promise<void>;
  publishLayout(storeId: string): Promise<{ version: number }>;
  listLayoutHistory(storeId: string): Promise<Array<{ version: number; publishedAt: unknown }>>;
  restoreLayoutVersion(storeId: string, version: number): Promise<StoreLayout>;
  getTheme(storeId: string): Promise<Record<string, unknown>>;
}
