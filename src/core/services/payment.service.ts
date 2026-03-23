import type { AuthPort } from '../ports/auth.port.js';
import type { PaymentPort } from '../ports/payment.port.js';
import type { Payment, PaymentsPaginatedResponse, PaginationOptions } from '../types/payment.js';

export class PaymentService {
  constructor(
    private readonly paymentPort: PaymentPort,
    private readonly authPort: AuthPort,
  ) {}

  async getMyBusinessId(): Promise<string> {
    return this.authPort.getMyBusinessId();
  }

  async list(businessId: string): Promise<Payment[]> {
    return this.paymentPort.list(businessId);
  }

  async getPaginated(
    businessId: string,
    options?: PaginationOptions,
  ): Promise<PaymentsPaginatedResponse | { total: number }> {
    return this.paymentPort.getPaginated(businessId, options);
  }

  async getById(businessId: string, paymentId: string): Promise<Payment> {
    return this.paymentPort.getById(businessId, paymentId);
  }
}
