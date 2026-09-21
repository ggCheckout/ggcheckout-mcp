import type { ProductPort } from '../ports/product.port.js';
import type {
  Product,
  ProductTag,
  DeliverableConfig,
  UploadDeliverableInput,
  Upsell,
  ReorderUpsellItem,
  CreateUpsellInput,
  DownsellSequenceItem,
  CreateDownsellInput,
} from '../types/product.js';
import { validateCreateProductInput, validateUpdateProductInput } from '../../shared/validation.js';

export class ProductService {
  constructor(private readonly productPort: ProductPort) {}

  async list(): Promise<Product[]> {
    // delete_product is a soft delete: the API keeps listing the row with `deleted: true`.
    return (await this.productPort.list()).filter((product) => product.deleted !== true);
  }

  async getById(id: string): Promise<Product> {
    return this.productPort.getById(id);
  }

  async create(input: any): Promise<{ success: boolean; productId: string }> {
    const validated = validateCreateProductInput(input);
    return this.productPort.create(validated);
  }

  async update(id: string, input: any): Promise<void> {
    const validated = validateUpdateProductInput(input);
    // The API validates the body as a whole product (a title-only PATCH is rejected for
    // lacking url/deliverable/stockLines), so the stored document is re-sent with the edit
    // on top. uid is the document key and updatedAt is stamped by the server.
    const { uid: _uid, updatedAt: _updatedAt, ...current } = (await this.productPort.getById(id)) as any;
    return this.productPort.update(id, { ...current, ...validated });
  }

  async delete(id: string): Promise<void> {
    return this.productPort.delete(id);
  }

  async uploadDeliverable(productId: string, input: UploadDeliverableInput): Promise<DeliverableConfig> {
    return this.productPort.uploadDeliverable(productId, input);
  }

  async deleteDeliverable(productId: string): Promise<void> {
    return this.productPort.deleteDeliverable(productId);
  }

  async listUpsells(productId: string): Promise<Upsell[]> {
    return this.productPort.listUpsells(productId);
  }

  /**
   * Writes the offer in the shape the dashboard editor does. The Postgres-backed API requires
   * `order` (it becomes `sortOrder`) and reads the offered products from `upsellProductIds`;
   * without them the write is refused, or saved with no product to sell.
   */
  async createUpsell(productId: string, upsellId: string, input: CreateUpsellInput): Promise<Upsell> {
    const order = input.order ?? nextOrder(await this.productPort.listUpsells(productId));
    return this.productPort.createUpsell(productId, upsellId, {
      ...input,
      uid: upsellId,
      id: upsellId,
      upsellProductIds: [input.upsellProductId],
      order,
    });
  }

  async deleteUpsell(productId: string, upsellId: string): Promise<void> {
    return this.productPort.deleteUpsell(productId, upsellId);
  }

  async reorderUpsells(productId: string, upsells: ReorderUpsellItem[]): Promise<void> {
    return this.productPort.reorderUpsells(productId, upsells);
  }

  async listDownsells(productId: string): Promise<{ downsells: DownsellSequenceItem[]; count: number }> {
    return this.productPort.listDownsells(productId);
  }

  /** Same editor shape as {@link createUpsell}: `order` is required, products go in `downsellProductIds`. */
  async createDownsell(productId: string, downsellId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem> {
    const order = input.order ?? nextOrder((await this.productPort.listDownsells(productId)).downsells);
    return this.productPort.createDownsell(productId, downsellId, {
      ...input,
      uid: downsellId,
      id: downsellId,
      downsellProductIds: [input.downsellProductId],
      order,
    });
  }

  async deleteDownsell(productId: string, downsellId: string): Promise<void> {
    return this.productPort.deleteDownsell(productId, downsellId);
  }

  async reorderDownsells(productId: string, order: string[]): Promise<void> {
    return this.productPort.reorderDownsells(productId, order);
  }

  async manageTags(productId: string, tags: ProductTag[]): Promise<{ tags: ProductTag[] }> {
    return this.productPort.manageTags(productId, tags);
  }
}

/** One past the highest stored position; the list length would reuse a slot left by a deletion. */
function nextOrder(items: Array<{ order?: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.order ?? 0), items.length) + 1;
}
