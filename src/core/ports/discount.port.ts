import type {
  Discount,
  CreateDiscountInput,
  UpdateDiscountInput,
  ValidateDiscountInput,
  ValidateDiscountResponse,
} from '../types/discount.js';

export interface DiscountPort {
  list(options?: { isActive?: boolean; type?: string }): Promise<Discount[]>;
  getById(id: string): Promise<Discount>;
  create(input: CreateDiscountInput): Promise<{ success: boolean; id: string }>;
  update(id: string, input: UpdateDiscountInput): Promise<void>;
  delete(id: string): Promise<void>;
  validate(input: ValidateDiscountInput): Promise<ValidateDiscountResponse>;
}
