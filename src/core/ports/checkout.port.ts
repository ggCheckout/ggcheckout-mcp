import type { Checkout, CheckoutTag, CreateCheckoutInput } from '../types/checkout.js';

export interface CheckoutPort {
  list(uuidOwner: string): Promise<Checkout[]>;
  getById(id: string): Promise<Checkout>;
  create(payload: CreateCheckoutInput): Promise<Checkout>;
  update(id: string, payload: any): Promise<Checkout>;
  delete(id: string, uuidOwner: string): Promise<void>;
  manageTags(id: string, tags: CheckoutTag[]): Promise<{ tags: CheckoutTag[] }>;
}
