import type { DiscountPort } from '../../core/ports/discount.port.js';
import type {
  Discount,
  CreateDiscountInput,
  UpdateDiscountInput,
  ValidateDiscountInput,
  ValidateDiscountResponse,
} from '../../core/types/discount.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';

export class DiscountApiAdapter implements DiscountPort {
  constructor(
    private readonly http: HttpClient,
    private readonly authPort: AuthPort,
  ) {}

  async list(options?: { isActive?: boolean; type?: string }): Promise<Discount[]> {
    const ownerId = await this.authPort.getMyBusinessId();
    const params = new URLSearchParams({ uuidOwner: ownerId });
    if (options?.isActive !== undefined) params.append('isActive', String(options.isActive));
    if (options?.type) params.append('type', options.type);
    return this.http.get<Discount[]>(`/api/discounts?${params.toString()}`);
  }

  async getById(id: string): Promise<Discount> {
    return this.http.get<Discount>(`/api/discounts/${id}`);
  }

  async create(input: CreateDiscountInput): Promise<{ success: boolean; id: string }> {
    return this.http.post<{ success: boolean; id: string }>('/api/discounts', input);
  }

  async update(id: string, input: UpdateDiscountInput): Promise<void> {
    await this.http.put(`/api/discounts/${id}`, { id, ...input });
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/discounts/${id}`);
  }

  async validate(input: ValidateDiscountInput): Promise<ValidateDiscountResponse> {
    return this.http.post<ValidateDiscountResponse>('/api/discounts/validate', input);
  }
}
