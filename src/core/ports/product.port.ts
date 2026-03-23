import type {
  Product,
  DeliverableConfig,
  UploadDeliverableInput,
  Upsell,
  CreateUpsellInput,
  DownsellSequenceItem,
  CreateDownsellInput,
} from '../types/product.js';

export interface ProductPort {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product>;
  create(payload: any): Promise<Product>;
  update(id: string, payload: any): Promise<Product>;
  delete(id: string): Promise<void>;
  uploadDeliverable(productId: string, input: UploadDeliverableInput): Promise<DeliverableConfig>;
  deleteDeliverable(productId: string): Promise<void>;
  listUpsells(productId: string): Promise<Upsell[]>;
  createUpsell(productId: string, input: CreateUpsellInput): Promise<Upsell>;
  deleteUpsell(productId: string, upsellId: string): Promise<void>;
  reorderUpsells(productId: string, order: string[]): Promise<void>;
  listDownsells(productId: string): Promise<DownsellSequenceItem[]>;
  createDownsell(productId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem>;
  deleteDownsell(productId: string, downsellId: string): Promise<void>;
  reorderDownsells(productId: string, order: string[]): Promise<void>;
  manageTags(productId: string, tags: string[]): Promise<void>;
}
