import type { CalculatedShippingOption, CalculateShippingInput, ShippingCartInput } from '../types/shipping.js';

export interface ShippingPort {
  calculate(input: CalculateShippingInput): Promise<{ success: boolean; options?: CalculatedShippingOption[] }>;
  verifyShipping(paymentId: string, businessId: string): Promise<any>;
  createCart(input: ShippingCartInput): Promise<{ success: boolean; cartId: string; protocol: string; price: number }>;
  cancelCart(paymentId: string, businessId: string, cartId: string): Promise<void>;
  checkout(paymentId: string, businessId: string, cartId: string): Promise<{ success: boolean; status: string; generated: boolean }>;
  generateLabel(paymentId: string, businessId: string, orderId: string): Promise<{ success: boolean; generated: boolean; printUrl?: string }>;
  printLabel(businessId: string, orderId: string): Promise<{ success: boolean; url: string }>;
}
