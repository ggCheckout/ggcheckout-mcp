import type { ShippingPort } from '../ports/shipping.port.js';
import type { CalculateShippingInput, ShippingCartInput } from '../types/shipping.js';

export class ShippingService {
  constructor(private readonly port: ShippingPort) {}
  async calculate(input: CalculateShippingInput) { return this.port.calculate(input); }
  async verifyShipping(paymentId: string, businessId: string) { return this.port.verifyShipping(paymentId, businessId); }
  async createCart(input: ShippingCartInput) { return this.port.createCart(input); }
  async cancelCart(paymentId: string, businessId: string, cartId: string) { return this.port.cancelCart(paymentId, businessId, cartId); }
  async checkout(paymentId: string, businessId: string, cartId: string) { return this.port.checkout(paymentId, businessId, cartId); }
  async generateLabel(paymentId: string, businessId: string, orderId: string) { return this.port.generateLabel(paymentId, businessId, orderId); }
  async printLabel(businessId: string, orderId: string) { return this.port.printLabel(businessId, orderId); }
}
