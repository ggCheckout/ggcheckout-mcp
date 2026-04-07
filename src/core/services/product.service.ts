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
    return this.productPort.list();
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
    return this.productPort.update(id, validated);
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

  async createUpsell(productId: string, upsellId: string, input: CreateUpsellInput): Promise<Upsell> {
    return this.productPort.createUpsell(productId, upsellId, input);
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

  async createDownsell(productId: string, downsellId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem> {
    return this.productPort.createDownsell(productId, downsellId, input);
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
