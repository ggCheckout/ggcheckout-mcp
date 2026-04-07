import type { DiscountPort } from '../ports/discount.port.js';
import type { CreateDiscountInput, UpdateDiscountInput, ValidateDiscountInput } from '../types/discount.js';

export class DiscountService {
  constructor(private readonly discountPort: DiscountPort) {}

  async list(options?: { isActive?: boolean; type?: string }) { return this.discountPort.list(options); }
  async getById(id: string) { return this.discountPort.getById(id); }
  async create(input: CreateDiscountInput) { return this.discountPort.create(input); }
  async update(id: string, input: UpdateDiscountInput) { return this.discountPort.update(id, input); }
  async delete(id: string) { return this.discountPort.delete(id); }
  async validate(input: ValidateDiscountInput) { return this.discountPort.validate(input); }
}
