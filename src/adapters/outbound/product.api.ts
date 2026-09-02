import type { ProductPort } from '../../core/ports/product.port.js';
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
} from '../../core/types/product.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';

export class ProductApiAdapter implements ProductPort {
  constructor(private readonly http: HttpClient, private readonly authPort: AuthPort) {}

  async list(): Promise<Product[]> {
    return this.http.get<Product[]>('/api/product-delivery');
  }

  async getById(id: string): Promise<Product> {
    return this.http.get<Product>(`/api/product-delivery/${encodeURIComponent(id)}`);
  }

  async create(payload: any): Promise<{ success: boolean; productId: string }> {
    return this.http.post<{ success: boolean; productId: string }>('/api/product-delivery', payload);
  }

  async update(id: string, payload: any): Promise<void> {
    const uuidOwner = await this.authPort.getMyBusinessId();
    await this.http.patch(`/api/product-delivery/${encodeURIComponent(id)}`, { ...payload, id, uuidOwner });
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${encodeURIComponent(id)}`);
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

  async createUpsell(productId: string, upsellId: string, input: CreateUpsellInput): Promise<Upsell> {
    const data = await this.http.post<{ success: boolean; upsell: Upsell }>(
      `/api/product-delivery/${productId}/upsells/${upsellId}`,
      { upsell: input },
    );
    return data.upsell;
  }

  async deleteUpsell(productId: string, upsellId: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${productId}/upsells/${upsellId}`);
  }

  async reorderUpsells(productId: string, upsells: ReorderUpsellItem[]): Promise<void> {
    await this.http.patch(`/api/product-delivery/${productId}/upsells`, { upsells });
  }

  async listDownsells(productId: string): Promise<{ downsells: DownsellSequenceItem[]; count: number }> {
    return this.http.get<{ success: boolean; downsells: DownsellSequenceItem[]; count: number }>(
      `/api/product-delivery/${productId}/downsells/list`,
    );
  }

  async createDownsell(productId: string, downsellId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem> {
    const data = await this.http.post<{ success: boolean; downsell: DownsellSequenceItem }>(
      `/api/product-delivery/${productId}/downsells/${downsellId}`,
      { downsell: input },
    );
    return data.downsell;
  }

  async deleteDownsell(productId: string, downsellId: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${productId}/downsells/${downsellId}`);
  }

  async reorderDownsells(productId: string, order: string[]): Promise<void> {
    await this.http.post(`/api/product-delivery/${productId}/downsells/reorder`, { downsellIds: order });
  }

  async manageTags(productId: string, tags: ProductTag[]): Promise<{ tags: ProductTag[] }> {
    return this.http.patch<{ message: string; tags: ProductTag[] }>(
      `/api/product-delivery/${productId}/tags`,
      { tags },
    );
  }
}
