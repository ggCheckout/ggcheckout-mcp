import type {
  Payment,
  PaymentsPaginatedResponse,
  PaginationOptions,
  FulfillmentResponse,
  FulfillmentData,
  UpdateFulfillmentInput,
  PaymentStatusCheckResponse,
} from '../types/payment.js';

export interface PaymentPort {
  list(businessId: string): Promise<Payment[]>;
  getPaginated(businessId: string, options?: PaginationOptions): Promise<PaymentsPaginatedResponse | { total: number }>;
  getById(businessId: string, paymentId: string): Promise<Payment>;
  getFulfillment(businessId: string, paymentId: string): Promise<FulfillmentResponse>;
  updateFulfillment(businessId: string, paymentId: string, data: UpdateFulfillmentInput): Promise<{ success: boolean; fulfillment: FulfillmentData }>;
  checkStatus(paymentId: string): Promise<PaymentStatusCheckResponse>;
}
