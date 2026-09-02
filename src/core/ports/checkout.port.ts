import type {
  Checkout,
  CheckoutTag,
  CreateCheckoutInput,
  UpdateCheckoutPayload,
} from '../types/checkout.js';

export interface CheckoutPort {
  list(uuidOwner: string): Promise<Checkout[]>;
  getById(id: string): Promise<Checkout>;
  create(payload: CreateCheckoutInput): Promise<Checkout>;
  update(id: string, payload: UpdateCheckoutPayload): Promise<Checkout>;
  delete(id: string): Promise<void>;
  manageTags(id: string, tags: CheckoutTag[]): Promise<{ tags: CheckoutTag[] }>;
}
