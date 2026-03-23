import type { ProductPort } from '../../core/ports/product.port.js';
import type { Product } from '../../core/types/product.js';
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
}
