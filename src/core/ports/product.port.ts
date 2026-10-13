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
} from '../types/product.js';

export interface ProductPort {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product>;
  create(payload: any): Promise<{ success: boolean; productId: string }>;
  update(id: string, payload: any): Promise<void>;
  delete(id: string): Promise<void>;
  presignDeliverable(
    productId: string,
    input: { fileName: string; fileType: string; fileSize: number },
  ): Promise<DeliverablePresign>;
  completeDeliverableUpload(
    input: { filePath: string; fileName: string; fileSize: number; fileType: string },
  ): Promise<DeliverableFile>;
  deleteDeliverableFile(filePath: string): Promise<void>;
  listUpsells(productId: string): Promise<Upsell[]>;
  createUpsell(productId: string, upsellId: string, input: CreateUpsellPayload): Promise<Upsell>;
  deleteUpsell(productId: string, upsellId: string): Promise<void>;
  reorderUpsells(productId: string, upsellIds: string[]): Promise<ReorderResult[]>;
  listDownsells(productId: string): Promise<{ downsells: DownsellSequenceItem[]; count: number }>;
  createDownsell(productId: string, downsellId: string, input: CreateDownsellPayload): Promise<DownsellSequenceItem>;
  deleteDownsell(productId: string, downsellId: string): Promise<void>;
  reorderDownsells(productId: string, downsellIds: string[]): Promise<ReorderResult[]>;
  setOfferExternalFlow(
    productId: string,
    kind: OfferKind,
    offerId: string,
    externalFlow: ExternalFlow | null,
  ): Promise<ExternalFlow | null>;
  manageTags(productId: string, tags: ProductTag[]): Promise<{ tags: ProductTag[] }>;
}
