import type { AuthPort } from '../ports/auth.port.js';
import type { PaymentPort } from '../ports/payment.port.js';
import type {
  Payment,
  PaymentsPaginatedResponse,
  PaginationOptions,
  FulfillmentResponse,
  FulfillmentData,
  UpdateFulfillmentInput,
  PaymentStatusCheckResponse,
} from '../types/payment.js';

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

  async getFulfillment(businessId: string, paymentId: string): Promise<FulfillmentResponse> {
    return this.paymentPort.getFulfillment(businessId, paymentId);
  }

  async updateFulfillment(
    businessId: string,
    paymentId: string,
    data: UpdateFulfillmentInput,
  ): Promise<{ success: boolean; fulfillment: FulfillmentData }> {
    return this.paymentPort.updateFulfillment(businessId, paymentId, data);
  }

  async checkStatus(paymentId: string): Promise<PaymentStatusCheckResponse> {
    return this.paymentPort.checkStatus(paymentId);
  }
}
