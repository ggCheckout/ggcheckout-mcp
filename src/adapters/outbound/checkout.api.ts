import type { CheckoutPort } from '../../core/ports/checkout.port.js';
import type { Checkout, CheckoutTag, CreateCheckoutInput } from '../../core/types/checkout.js';
import type { HttpClient } from './http-client.js';

export class CheckoutApiAdapter implements CheckoutPort {
  constructor(private readonly http: HttpClient) {}

  async list(uuidOwnwer: string): Promise<Checkout[]> {
    return this.http.get<Checkout[]>(`/api/checkouts?uuidOwnwer=${uuidOwnwer}`);
  }

  async getById(id: string): Promise<Checkout> {
    return this.http.get<Checkout>(`/api/checkouts/${id}`);
  }

  async create(payload: CreateCheckoutInput): Promise<Checkout> {
    const data = await this.http.post<{ checkout: Checkout }>('/api/checkouts', payload);
    return data.checkout;
  }

  async update(id: string, payload: any): Promise<Checkout> {
    const data = await this.http.patch<{ productData?: Checkout }>(`/api/checkouts/${id}`, payload);
    return data.productData || { ...payload, uid: id };
  }

  async delete(id: string, uuidOwnwer: string): Promise<void> {
    await this.http.delete(`/api/checkouts/${id}`, { uuidOwnwer });
  }

  async manageTags(id: string, tags: CheckoutTag[]): Promise<{ tags: CheckoutTag[] }> {
    return this.http.patch<{ message: string; tags: CheckoutTag[] }>(
      `/api/checkouts/${id}/tags`,
      { tags },
    );
  }
}
