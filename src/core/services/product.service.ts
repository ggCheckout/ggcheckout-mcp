import type { ProductPort } from '../ports/product.port.js';
import type {
  Product,
  DeliverableConfig,
  UploadDeliverableInput,
  Upsell,
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

  async create(input: any): Promise<Product> {
    const validated = validateCreateProductInput(input);
    return this.productPort.create(validated);
  }

  async update(id: string, input: any): Promise<Product> {
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

  async createUpsell(productId: string, input: CreateUpsellInput): Promise<Upsell> {
    return this.productPort.createUpsell(productId, input);
  }

  async deleteUpsell(productId: string, upsellId: string): Promise<void> {
    return this.productPort.deleteUpsell(productId, upsellId);
  }

  async reorderUpsells(productId: string, order: string[]): Promise<void> {
    return this.productPort.reorderUpsells(productId, order);
  }

  async listDownsells(productId: string): Promise<DownsellSequenceItem[]> {
    return this.productPort.listDownsells(productId);
  }

  async createDownsell(productId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem> {
    return this.productPort.createDownsell(productId, input);
  }

  async deleteDownsell(productId: string, downsellId: string): Promise<void> {
    return this.productPort.deleteDownsell(productId, downsellId);
  }

  async reorderDownsells(productId: string, order: string[]): Promise<void> {
    return this.productPort.reorderDownsells(productId, order);
  }

  async manageTags(productId: string, tags: string[]): Promise<void> {
    return this.productPort.manageTags(productId, tags);
  }
}
