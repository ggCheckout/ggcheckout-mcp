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
  StoreSummary,
  StoreLayout,
  StoreLayoutDraft,
  StoreLayoutUpdate,
} from '../types/store.js';
import { mergeDeep } from '../../shared/merge.js';
import { ValidationError } from '../../shared/errors.js';

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

  async listStores(): Promise<StoreSummary[]> {
    return this.storePort.listStores();
  }

  async getLayout(storeId: string): Promise<{ layout: StoreLayout | null; isNewStore: boolean }> {
    return this.storePort.getLayout(storeId);
  }

  /**
   * Saves the builder draft. The route refuses any top-level key besides theme, blocks, config
   * and pageSettings, while the read carries id, version, status and timestamps — so the stored
   * layout is read, the edit merged in (theme, config and pageSettings key by key; blocks as a
   * whole list), and only the four writable keys are sent. Nothing is public until publish.
   */
  async updateLayout(storeId: string, update: StoreLayoutUpdate): Promise<StoreLayoutDraft> {
    const { layout: stored } = await this.storePort.getLayout(storeId);
    const theme = stored ? mergeDeep(stored.theme, update.theme) : update.theme;
    const blocks = update.blocks ?? stored?.blocks;
    if (!theme || !blocks) {
      throw new ValidationError(
        `Store ${storeId} has no layout yet, so the first save must send both theme and blocks.`,
      );
    }
    const config = mergeDeep(stored?.config, update.config);
    const pageSettings = mergeDeep(stored?.pageSettings, update.pageSettings);
    const draft: StoreLayoutDraft = {
      theme,
      blocks,
      ...(config !== undefined ? { config } : {}),
      ...(pageSettings !== undefined ? { pageSettings } : {}),
    };
    await this.storePort.saveLayoutDraft(storeId, draft);
    return draft;
  }

  async publishLayout(storeId: string): Promise<{ version: number }> {
    return this.storePort.publishLayout(storeId);
  }

  async listLayoutHistory(storeId: string): Promise<Array<{ version: number; publishedAt: unknown }>> {
    return this.storePort.listLayoutHistory(storeId);
  }

  async restoreLayoutVersion(storeId: string, version: number): Promise<StoreLayout> {
    return this.storePort.restoreLayoutVersion(storeId, version);
  }

  async getTheme(storeId: string): Promise<Record<string, unknown>> {
    return this.storePort.getTheme(storeId);
  }
}
