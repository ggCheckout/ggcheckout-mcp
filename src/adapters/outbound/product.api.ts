import type { ProductPort } from '../../core/ports/product.port.js';
import type {
  Product,
  ProductTag,
  DeliverablePresign,
  DeliverableFile,
  ReorderResult,
  Upsell,
  CreateUpsellPayload,
  DownsellSequenceItem,
  CreateDownsellPayload,
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

  /**
   * Step 1: mint the upload URL. The bytes never pass through this server — the caller PUTs them
   * straight to storage, which is why there is no "upload the file" call here at all.
   */
  async presignDeliverable(
    productId: string,
    input: { fileName: string; fileType: string; fileSize: number },
  ): Promise<DeliverablePresign> {
    const data = await this.http.post<{
      success: boolean;
      data: { uploadUrl: string; filePath: string; fields?: Record<string, string> };
    }>('/api/deliverables/presigned-upload', { ...input, productId });
    return {
      uploadUrl: data.data.uploadUrl,
      filePath: data.data.filePath,
      contentType: data.data.fields?.['Content-Type'] ?? input.fileType,
    };
  }

  /**
   * Step 3 and 4 in one: confirm the object landed, then attach it to the product. They are
   * separate routes upstream and nothing in `deliverables/*` links a file to a product, so a
   * confirm without the PATCH would leave an uploaded file that no buyer can reach.
   */
  async attachDeliverable(
    productId: string,
    input: { filePath: string; fileName: string; fileSize: number; fileType: string },
  ): Promise<DeliverableFile> {
    const completed = await this.http.post<{ success: boolean; data: DeliverableFile }>(
      '/api/deliverables/complete-upload',
      input,
    );
    await this.update(productId, {
      deliverableFile: completed.data,
      deliverableFileId: '',
      deliverableUrl: '',
    });
    return completed.data;
  }

  /**
   * Unlinking is a PATCH on the product: `deliverableFile: null` is how a removal is expressed,
   * and without it the product would keep pointing at the file. Deleting the bytes afterwards is
   * best-effort and only when the caller names the path — same order the dashboard uses, so a
   * failed unlink never destroys a file that is still linked.
   */
  async deleteDeliverable(productId: string, filePath?: string): Promise<void> {
    await this.update(productId, { deliverableFile: null, deliverableFileId: '', deliverableUrl: '' });
    if (filePath) {
      await this.http.delete(`/api/deliverables/upload?filePath=${encodeURIComponent(filePath)}`);
    }
  }

  async listUpsells(productId: string): Promise<Upsell[]> {
    // The route answers `{ success, upsells, count }`; older deployments answered the bare array.
    const data = await this.http.get<Upsell[] | { upsells?: Upsell[] }>(
      `/api/product-delivery/${productId}/upsells/list`,
    );
    return Array.isArray(data) ? data : (data.upsells ?? []);
  }

  async createUpsell(productId: string, upsellId: string, input: CreateUpsellPayload): Promise<Upsell> {
    const data = await this.http.post<{ success: boolean; upsell: Upsell }>(
      `/api/product-delivery/${productId}/upsells/${upsellId}`,
      { upsell: input },
    );
    return data.upsell;
  }

  async deleteUpsell(productId: string, upsellId: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${productId}/upsells/${upsellId}`);
  }

  /**
   * `POST .../upsells/reorder` with the ids, which is the mirror of the downsell reorder.
   * This used to PATCH `.../upsells` with whole objects: that route exists but does something
   * else — it replaces the legacy upsell ARRAY on the product document — and it does not exist
   * at all for a product stored in Postgres, where it failed as an opaque 502.
   */
  async reorderUpsells(productId: string, upsellIds: string[]): Promise<ReorderResult[]> {
    const data = await this.http.post<{ success: boolean; message: string; newOrder: ReorderResult[] }>(
      `/api/product-delivery/${encodeURIComponent(productId)}/upsells/reorder`,
      { upsellIds },
    );
    return data.newOrder ?? [];
  }

  async listDownsells(productId: string): Promise<{ downsells: DownsellSequenceItem[]; count: number }> {
    const data = await this.http.get<{ success?: boolean; downsells?: DownsellSequenceItem[]; count?: number }>(
      `/api/product-delivery/${productId}/downsells/list`,
    );
    const downsells = data.downsells ?? [];
    return { downsells, count: data.count ?? downsells.length };
  }

  async createDownsell(productId: string, downsellId: string, input: CreateDownsellPayload): Promise<DownsellSequenceItem> {
    const data = await this.http.post<{ success: boolean; downsell: DownsellSequenceItem }>(
      `/api/product-delivery/${productId}/downsells/${downsellId}`,
      { downsell: input },
    );
    return data.downsell;
  }

  async deleteDownsell(productId: string, downsellId: string): Promise<void> {
    await this.http.delete(`/api/product-delivery/${productId}/downsells/${downsellId}`);
  }

  async reorderDownsells(productId: string, order: string[]): Promise<ReorderResult[]> {
    const data = await this.http.post<{ success: boolean; message: string; newOrder: ReorderResult[] }>(
      `/api/product-delivery/${encodeURIComponent(productId)}/downsells/reorder`,
      { downsellIds: order },
    );
    return data.newOrder ?? [];
  }

  async manageTags(productId: string, tags: ProductTag[]): Promise<{ tags: ProductTag[] }> {
    return this.http.patch<{ message: string; tags: ProductTag[] }>(
      `/api/product-delivery/${productId}/tags`,
      { tags },
    );
  }
}
