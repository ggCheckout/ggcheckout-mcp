import type {
  Payment,
  PaymentsPaginatedResponse,
  PaginationOptions,
  FulfillmentData,
  PaymentStatusCheck,
} from '../types/payment.js';

export interface PaymentPort {
  list(businessId: string): Promise<Payment[]>;
  getPaginated(businessId: string, options?: PaginationOptions): Promise<PaymentsPaginatedResponse | { total: number }>;
  getById(businessId: string, paymentId: string): Promise<Payment>;
  getFulfillment(businessId: string, paymentId: string): Promise<FulfillmentData>;
  updateFulfillment(businessId: string, paymentId: string, data: Partial<FulfillmentData>): Promise<FulfillmentData>;
  checkStatus(paymentId: string): Promise<PaymentStatusCheck>;
}
