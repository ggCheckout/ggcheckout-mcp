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
  StoreConfigPatch,
  StoreAdminConfig,
  StoreAdminCategory,
  StoreCategoryInput,
  StoreReviewInput,
  StoreReviewUpdate,
  StoreReviewList,
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
    // The PUT answers only { success }, and its schema drops unknown keys and swaps invalid
    // values for defaults, so the draft as sent is not necessarily what was stored.
    const { layout: saved } = await this.storePort.getLayout(storeId);
    return saved ?? draft;
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

  // Store admin. The routes validate strictly and merge a partial config server-side, so these
  // pass through: re-implementing the merge here would diverge from the panel's save.

  async createStore(title?: string): Promise<{ storeId: string }> {
    return this.storePort.createStore(title);
  }

  async getStore(storeId: string): Promise<StoreAdminConfig> {
    return this.storePort.getStore(storeId);
  }

  async updateStore(storeId: string, patch: StoreConfigPatch): Promise<StoreAdminConfig> {
    if (Object.keys(patch).length === 0) {
      throw new ValidationError('Provide at least one field to update.');
    }
    return this.storePort.updateStore(storeId, patch);
  }

  async deleteStore(storeId: string): Promise<void> {
    return this.storePort.deleteStore(storeId);
  }

  async listStoreCategories(storeId: string): Promise<StoreAdminCategory[]> {
    return this.storePort.listStoreCategories(storeId);
  }

  async createStoreCategory(storeId: string, input: StoreCategoryInput): Promise<StoreAdminCategory> {
    return this.storePort.createStoreCategory(storeId, input);
  }

  async updateStoreCategory(storeId: string, categoryId: string, input: StoreCategoryInput): Promise<StoreAdminCategory> {
    if (Object.keys(input).length === 0) {
      throw new ValidationError('Provide at least one field to update.');
    }
    return this.storePort.updateStoreCategory(storeId, categoryId, input);
  }

  async deleteStoreCategory(storeId: string, categoryId: string): Promise<{ deletedIds: string[] }> {
    return this.storePort.deleteStoreCategory(storeId, categoryId);
  }

  async listStoreReviews(
    storeId: string,
    options?: { status?: 'all' | 'approved' | 'pending'; page?: number; limit?: number },
  ): Promise<StoreReviewList> {
    return this.storePort.listStoreReviews(storeId, options);
  }

  async createStoreReview(storeId: string, input: StoreReviewInput): Promise<StoreFeedback> {
    return this.storePort.createStoreReview(storeId, input);
  }

  /**
   * The content fields travel together or not at all: the API rewrites all four at once and has
   * no read by id to complete a partial edit. Checked here so the agent gets the reason, not a 400.
   */
  async updateStoreReview(storeId: string, feedbackId: string, update: StoreReviewUpdate): Promise<void> {
    const contentKeys = ['customerName', 'rating', 'comment', 'createdAt'] as const;
    const present = contentKeys.filter((key) => update[key] !== undefined).length;
    if (present !== 0 && present !== contentKeys.length) {
      throw new ValidationError('To edit a review, send customerName, rating, comment and createdAt together.');
    }
    if (update.approved === undefined && present === 0) {
      throw new ValidationError('Provide approved and/or the review content.');
    }
    return this.storePort.updateStoreReview(storeId, feedbackId, update);
  }

  async deleteStoreReview(storeId: string, feedbackId: string): Promise<void> {
    return this.storePort.deleteStoreReview(storeId, feedbackId);
  }
}
