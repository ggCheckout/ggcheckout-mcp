import type { ShippingPort } from '../../core/ports/shipping.port.js';
import type { CalculatedShippingOption, CalculateShippingInput, ShippingCartInput } from '../../core/types/shipping.js';
import type { HttpClient } from './http-client.js';

export class ShippingApiAdapter implements ShippingPort {
  constructor(private readonly http: HttpClient) {}

  async calculate(input: CalculateShippingInput) {
    return this.http.post<{ success: boolean; options?: CalculatedShippingOption[] }>('/api/melhorenvio/calculate', input);
  }
  async verifyShipping(paymentId: string, businessId: string) {
    return this.http.get<any>(`/api/melhorenvio/verify-shipping?paymentId=${paymentId}&businessId=${businessId}`);
  }
  async createCart(input: ShippingCartInput) {
    return this.http.post<{ success: boolean; cartId: string; protocol: string; price: number }>('/api/melhorenvio/cart', input);
  }
  async cancelCart(paymentId: string, businessId: string, cartId: string) {
    await this.http.delete('/api/melhorenvio/cart/cancel', { paymentId, businessId, cartId });
  }
  async checkout(paymentId: string, businessId: string, cartId: string) {
    return this.http.post<{ success: boolean; status: string; generated: boolean }>('/api/melhorenvio/checkout', { paymentId, businessId, cartId });
  }
  async generateLabel(paymentId: string, businessId: string, orderId: string) {
    return this.http.post<{ success: boolean; generated: boolean; printUrl?: string }>('/api/melhorenvio/generate', { paymentId, businessId, orderId });
  }
  async printLabel(businessId: string, orderId: string) {
    return this.http.post<{ success: boolean; url: string }>('/api/melhorenvio/print', { businessId, orderId });
  }
}
