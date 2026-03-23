import type { Product } from '../types/product.js';

export interface ProductPort {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product>;
  create(payload: any): Promise<Product>;
  update(id: string, payload: any): Promise<Product>;
  delete(id: string): Promise<void>;
}
