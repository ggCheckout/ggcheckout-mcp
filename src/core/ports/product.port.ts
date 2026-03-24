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

export interface ProductPort {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product>;
  create(payload: any): Promise<{ success: boolean; productId: string }>;
  update(id: string, payload: any): Promise<void>;
  delete(id: string): Promise<void>;
  uploadDeliverable(productId: string, input: UploadDeliverableInput): Promise<DeliverableConfig>;
  deleteDeliverable(productId: string): Promise<void>;
  listUpsells(productId: string): Promise<Upsell[]>;
  createUpsell(productId: string, upsellId: string, input: CreateUpsellInput): Promise<Upsell>;
  deleteUpsell(productId: string, upsellId: string): Promise<void>;
  reorderUpsells(productId: string, upsells: ReorderUpsellItem[]): Promise<void>;
  listDownsells(productId: string): Promise<{ downsells: DownsellSequenceItem[]; count: number }>;
  createDownsell(productId: string, downsellId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem>;
  deleteDownsell(productId: string, downsellId: string): Promise<void>;
  reorderDownsells(productId: string, order: string[]): Promise<void>;
  manageTags(productId: string, tags: ProductTag[]): Promise<{ tags: ProductTag[] }>;
}
