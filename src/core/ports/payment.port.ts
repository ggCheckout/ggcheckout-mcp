import type { Payment, PaymentsPaginatedResponse, PaginationOptions } from '../types/payment.js';

export interface PaymentPort {
  list(businessId: string): Promise<Payment[]>;
  getPaginated(businessId: string, options?: PaginationOptions): Promise<PaymentsPaginatedResponse | { total: number }>;
  getById(businessId: string, paymentId: string): Promise<Payment>;
}
