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
  ExternalFlow,
  OfferKind,
} from '../../core/types/product.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';

type ReorderResponse = { success: boolean; message: string; newOrder: ReorderResult[] };

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
   * Step 3: confirm the object landed. It does not link the file to any product — that is a
   * product write, and the service makes it.
   */
  async completeDeliverableUpload(
    input: { filePath: string; fileName: string; fileSize: number; fileType: string },
  ): Promise<DeliverableFile> {
    const completed = await this.http.post<{ success: boolean; data: DeliverableFile }>(
      '/api/deliverables/complete-upload',
      input,
    );
    return completed.data;
  }

  /** Deletes the stored bytes. The API refuses a path outside the caller's own folder. */
  async deleteDeliverableFile(filePath: string): Promise<void> {
    await this.http.delete(`/api/deliverables/upload?filePath=${encodeURIComponent(filePath)}`);
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

  async reorderUpsells(productId: string, upsellIds: string[]): Promise<ReorderResult[]> {
    return this.reorder(productId, 'upsell', upsellIds);
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

  async reorderDownsells(productId: string, downsellIds: string[]): Promise<ReorderResult[]> {
    return this.reorder(productId, 'downsell', downsellIds);
  }

  /**
   * `PUT .../{kind}s/{offerId}/external-flow` writes only the routing, without resending the offer.
   * It lands on the offer's top level, which is the fallback for every product of the offer that has
   * no routing of its own. The answer carries only the routing, as the API stored it.
   */
  async setOfferExternalFlow(
    productId: string,
    kind: OfferKind,
    offerId: string,
    externalFlow: ExternalFlow | null,
  ): Promise<ExternalFlow | null> {
    const data = await this.http.put<{ success: boolean; externalFlow: ExternalFlow | null }>(
      `/api/product-delivery/${encodeURIComponent(productId)}/${kind}s/${encodeURIComponent(offerId)}/external-flow`,
      { externalFlow },
    );
    return data.externalFlow ?? null;
  }

  /**
   * `POST .../{kind}s/reorder` with `{ <kind>Ids }` in the new order; both answer the resulting
   * positions. The upsell side used to PATCH `.../upsells` with whole objects: that route replaces
   * the legacy upsell ARRAY on the product document, and it does not exist at all for a product
   * stored in Postgres, where it failed as an opaque 502.
   */
  private async reorder(productId: string, kind: 'upsell' | 'downsell', ids: string[]): Promise<ReorderResult[]> {
    const data = await this.http.post<ReorderResponse>(
      `/api/product-delivery/${encodeURIComponent(productId)}/${kind}s/reorder`,
      { [`${kind}Ids`]: ids },
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
