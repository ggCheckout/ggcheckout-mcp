import type { ProductPort } from '../../core/ports/product.port.js';
import type {
  Product,
  DeliverableConfig,
  UploadDeliverableInput,
  Upsell,
  CreateUpsellInput,
  DownsellSequenceItem,
  CreateDownsellInput,
} from '../../core/types/product.js';
import type { HttpClient } from './http-client.js';

export class ProductApiAdapter implements ProductPort {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Product[]> {
    return this.http.get<Product[]>('/api/product-delivery');
  }

  async getById(id: string): Promise<Product> {
    return this.http.get<Product>(`/api/product-delivery/${id}`);
  }

  async create(payload: any): Promise<Product> {
    const data = await this.http.post<{ documentId: string }>('/api/product-delivery', payload);
    return { ...payload, uid: data.documentId };
  }

  async update(id: string, payload: any): Promise<Product> {
    await this.http.patch(`/api/product-delivery/${id}`, { ...payload, id });
    return { ...payload, uid: id };
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${id}`);
  }

  async uploadDeliverable(productId: string, input: UploadDeliverableInput): Promise<DeliverableConfig> {
    return this.http.post<DeliverableConfig>(`/api/products/${productId}/deliverable/upload`, input);
  }

  async deleteDeliverable(productId: string): Promise<void> {
    await this.http.delete(`/api/products/${productId}/deliverable`);
  }

  async listUpsells(productId: string): Promise<Upsell[]> {
    return this.http.get<Upsell[]>(`/api/product-delivery/${productId}/upsells/list`);
  }

  async createUpsell(productId: string, input: CreateUpsellInput): Promise<Upsell> {
    return this.http.post<Upsell>(`/api/product-delivery/${productId}/upsells`, input);
  }

  async deleteUpsell(productId: string, upsellId: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${productId}/upsells/${upsellId}`);
  }

  async reorderUpsells(productId: string, order: string[]): Promise<void> {
    await this.http.post(`/api/product-delivery/${productId}/upsells/reorder`, { order });
  }

  async listDownsells(productId: string): Promise<DownsellSequenceItem[]> {
    return this.http.get<DownsellSequenceItem[]>(`/api/product-delivery/${productId}/downsells/list`);
  }

  async createDownsell(productId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem> {
    return this.http.post<DownsellSequenceItem>(`/api/product-delivery/${productId}/downsells`, input);
  }

  async deleteDownsell(productId: string, downsellId: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${productId}/downsells/${downsellId}`);
  }

  async reorderDownsells(productId: string, order: string[]): Promise<void> {
    await this.http.post(`/api/product-delivery/${productId}/downsells/reorder`, { order });
  }

  async manageTags(productId: string, tags: string[]): Promise<void> {
    await this.http.patch(`/api/product-delivery/${productId}/tags`, { tags });
  }
}
